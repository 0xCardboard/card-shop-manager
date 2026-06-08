"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ItemStatus, InventoryLocation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { intNum, num, optDate, optStr, str } from "@/lib/utils";
import { childInternalSku, ensureInternalSku, nextInternalSku } from "@/lib/sku";

export async function updateItem(formData: FormData) {
  await requireSession();
  const id = str(formData.get("id"));
  await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: str(formData.get("name")),
      setName: optStr(formData.get("setName")),
      year: formData.get("year") ? intNum(formData.get("year")) : null,
      cardNumber: optStr(formData.get("cardNumber")),
      condition: optStr(formData.get("condition")),
      graded: str(formData.get("graded")) === "on",
      gradingCompany: optStr(formData.get("gradingCompany")),
      grade: optStr(formData.get("grade")),
      certNumber: optStr(formData.get("certNumber")),
      quantity: intNum(formData.get("quantity")),
      costBasis: num(formData.get("costBasis")),
      acquisitionDate: optDate(formData.get("acquisitionDate")),
      sku: optStr(formData.get("sku")),
      status: (str(formData.get("status")) as ItemStatus) || "IN_STOCK",
      location:
        (str(formData.get("location")) as InventoryLocation) || "US",
      notes: optStr(formData.get("notes")),
    },
  });
  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function updateStatus(formData: FormData) {
  await requireSession();
  const id = str(formData.get("id"));
  const status = str(formData.get("status")) as ItemStatus;
  await prisma.inventoryItem.update({ where: { id }, data: { status } });
  revalidatePath("/inventory");
}

export async function deleteItem(formData: FormData) {
  await requireSession();
  const id = str(formData.get("id"));
  await prisma.inventoryItem.delete({ where: { id } });
  revalidatePath("/inventory");
}

// Break a parent item (e.g. a sealed case) into child units (e.g. booster
// boxes). The consumed parent cost is conserved: it is distributed evenly
// across the child units, so total inventory cost-basis value never changes.
export async function breakDownItem(formData: FormData) {
  await requireSession();

  const parentId = str(formData.get("parentId"));
  const parentQty = Math.max(1, intNum(formData.get("parentQty")));
  const childQty = Math.max(1, intNum(formData.get("childQty")));
  const targetId = optStr(formData.get("targetId")); // merge into existing item
  const childName = str(formData.get("childName"));

  const parent = await prisma.inventoryItem.findUnique({
    where: { id: parentId },
  });
  if (!parent) throw new Error("Parent item not found.");
  if (parentQty > parent.quantity) {
    throw new Error(
      `You only have ${parent.quantity} of "${parent.name}" to break down.`
    );
  }
  if (!targetId && !childName) {
    throw new Error("Choose an item to merge into, or enter a new item name.");
  }

  const totalCost = parentQty * parent.costBasis;
  const childUnitCost = childQty > 0 ? totalCost / childQty : 0;

  await prisma.$transaction(async (tx) => {
    const remainingParentQty = parent.quantity - parentQty;

    // Ensure the parent has an internal SKU so children can reference it.
    const parentSku = await ensureInternalSku(tx, parent);

    // Consume parent units. If the parent is now fully broken down, move it to
    // history with a BROKEN_DOWN status instead of leaving a 0-qty "in stock"
    // ghost in the inventory list.
    await tx.inventoryItem.update({
      where: { id: parent.id },
      data: {
        quantity: remainingParentQty,
        ...(remainingParentQty === 0
          ? { status: "BROKEN_DOWN", brokenDownAt: new Date() }
          : {}),
      },
    });

    if (targetId) {
      // Merge into an existing item using weighted-average cost.
      const target = await tx.inventoryItem.findUnique({
        where: { id: targetId },
      });
      if (!target) throw new Error("Target item not found.");
      const newQty = target.quantity + childQty;
      const newCost =
        newQty > 0
          ? (target.quantity * target.costBasis + childQty * childUnitCost) /
            newQty
          : childUnitCost;
      await tx.inventoryItem.update({
        where: { id: target.id },
        data: {
          quantity: newQty,
          costBasis: newCost,
          status: "IN_STOCK",
          // Record the lineage if this item isn't already tied to a parent.
          ...(target.parentItemId ? {} : { parentItemId: parent.id }),
        },
      });
    } else {
      // Create a new child item, inheriting some descriptive fields. Its
      // internal SKU is derived from the parent's so the lineage is visible
      // at a glance (e.g. CSM-000123 → CSM-000123-B01).
      const childCount = await tx.inventoryItem.count({
        where: { parentItemId: parent.id },
      });
      await tx.inventoryItem.create({
        data: {
          name: childName,
          setName: optStr(formData.get("childSet")) ?? parent.setName,
          year: parent.year,
          condition: optStr(formData.get("childCondition")),
          quantity: childQty,
          costBasis: childUnitCost,
          acquisitionDate: parent.acquisitionDate,
          status: "IN_STOCK",
          location: parent.location, // children stay where the parent was opened
          internalSku: childInternalSku(parentSku, childCount + 1),
          parentItemId: parent.id,
          notes: `Broken down from "${parent.name}" (${parentSku})`,
        },
      });
    }
  });

  revalidatePath("/inventory");
  redirect("/inventory");
}

// Ship selected Brazil items (in whole or in part) to the US. For each selected
// item a ship quantity is read from `qty_<id>` (defaulting to the full stock).
// The shipping + tariff + fee costs are landed costs: spread across the shipped
// units (weighted by cost value) and folded into their cost basis. Shipping the
// full quantity flips the item to the US; shipping part of it leaves the
// remainder in Brazil and creates a new US item for the shipped units. A
// Shipment record snapshots what moved and what it cost.
export async function shipToUS(formData: FormData) {
  await requireSession();

  const itemIds = formData.getAll("itemId").map(str).filter(Boolean);
  if (itemIds.length === 0) {
    throw new Error("Select at least one item in Brazil to ship.");
  }

  const shipping = Math.max(0, num(formData.get("shipping")));
  const tariffs = Math.max(0, num(formData.get("tariffs")));
  const fees = Math.max(0, num(formData.get("fees")));
  const landedTotal = shipping + tariffs + fees;
  const date = optDate(formData.get("date")) ?? new Date();
  const reference = optStr(formData.get("reference"));
  const notes = optStr(formData.get("notes"));

  const dbItems = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds }, location: "BRAZIL" },
  });

  // Resolve the ship quantity per item: default to the full stock, clamp to
  // what's available, and drop anything that resolves to zero.
  const lines = dbItems
    .map((item) => {
      const raw = intNum(formData.get(`qty_${item.id}`));
      const qty = raw > 0 ? Math.min(raw, item.quantity) : item.quantity;
      return { item, qty };
    })
    .filter((l) => l.qty > 0);

  if (lines.length === 0) {
    throw new Error("None of the selected items are available to ship.");
  }

  // Distribute landed cost by shipped cost value (ad-valorem style), falling
  // back to an even per-unit split when there is no cost basis to weight against.
  const totalValue = lines.reduce((s, l) => s + l.qty * l.item.costBasis, 0);
  const totalUnits = lines.reduce((s, l) => s + l.qty, 0);

  await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.create({
      data: { date, reference, shipping, tariffs, fees, notes },
    });

    for (const { item, qty } of lines) {
      const weight =
        totalValue > 0
          ? (qty * item.costBasis) / totalValue
          : totalUnits > 0
            ? qty / totalUnits
            : 0;
      const landed = landedTotal * weight;
      const perUnit = qty > 0 ? landed / qty : 0;
      const shippedBasis = item.costBasis + perUnit;

      let shippedItemId = item.id;

      if (qty >= item.quantity) {
        // Whole line ships: flip it to the US.
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { location: "US", costBasis: shippedBasis },
        });
      } else {
        // Partial: leave the remainder in Brazil (unchanged basis) and create a
        // new US item for the shipped units carrying the landed cost.
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { quantity: item.quantity - qty },
        });
        const created = await tx.inventoryItem.create({
          data: {
            name: item.name,
            setName: item.setName,
            year: item.year,
            cardNumber: item.cardNumber,
            condition: item.condition,
            graded: item.graded,
            gradingCompany: item.gradingCompany,
            grade: item.grade,
            certNumber: item.certNumber,
            quantity: qty,
            costBasis: shippedBasis,
            acquisitionDate: item.acquisitionDate,
            status: "IN_STOCK",
            location: "US",
            sku: item.sku,
            internalSku: await nextInternalSku(tx),
            notes: item.notes,
          },
        });
        shippedItemId = created.id;
      }

      await tx.shipmentItem.create({
        data: {
          shipmentId: shipment.id,
          itemName: item.name,
          quantity: qty,
          landedCost: landed,
          inventoryItemId: shippedItemId,
        },
      });
    }
  });

  revalidatePath("/inventory");
  redirect("/inventory?tab=us");
}

// Delete a shipment and best-effort reverse it: move the items back to Brazil
// and strip the landed cost back out of their cost basis.
export async function deleteShipment(formData: FormData) {
  await requireSession();
  const id = str(formData.get("id"));

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!shipment) return;

  await prisma.$transaction(async (tx) => {
    for (const leg of shipment.items) {
      if (!leg.inventoryItemId) continue;
      const item = await tx.inventoryItem.findUnique({
        where: { id: leg.inventoryItemId },
      });
      // Only reverse items still sitting as active US stock — if an item has
      // already been sold or broken down, leave it (its basis was used
      // downstream and the sale snapshot is already booked).
      if (
        !item ||
        item.location !== "US" ||
        item.status === "SOLD" ||
        item.status === "BROKEN_DOWN"
      ) {
        continue;
      }
      const perUnit = item.quantity > 0 ? leg.landedCost / item.quantity : 0;
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          location: "BRAZIL",
          costBasis: Math.max(0, item.costBasis - perUnit),
        },
      });
    }
    await tx.shipment.delete({ where: { id: shipment.id } });
  });

  revalidatePath("/inventory");
}
