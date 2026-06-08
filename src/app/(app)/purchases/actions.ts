"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { InventoryLocation } from "@prisma/client";
import { intNum, num, optDate, optStr, str } from "@/lib/utils";
import { nextInternalSku } from "@/lib/sku";
import { writeAudit } from "@/lib/audit";

export async function createPurchase(formData: FormData) {
  await requireSession();

  const quantity = Math.max(1, intNum(formData.get("quantity")));
  const unitCost = num(formData.get("unitCost"));
  const fees = num(formData.get("fees"));
  const shipping = num(formData.get("shipping"));
  const total = quantity * unitCost + fees + shipping;
  const itemName = str(formData.get("itemName"));
  const date = optDate(formData.get("date")) ?? new Date();
  const linkId = optStr(formData.get("inventoryItemId"));
  const addToInventory = str(formData.get("addToInventory")) === "on";
  const location =
    (str(formData.get("location")) as InventoryLocation) || "BRAZIL";

  let inventoryItemId: string | null = linkId;

  if (linkId) {
    // Update existing item: increment qty, recompute weighted-average cost.
    const item = await prisma.inventoryItem.findUnique({ where: { id: linkId } });
    if (item) {
      const newQty = item.quantity + quantity;
      const newCost =
        newQty > 0
          ? (item.quantity * item.costBasis + quantity * unitCost) / newQty
          : unitCost;
      await prisma.inventoryItem.update({
        where: { id: linkId },
        data: { quantity: newQty, costBasis: newCost },
      });
    }
  } else if (addToInventory && itemName) {
    const created = await prisma.inventoryItem.create({
      data: {
        name: itemName,
        quantity,
        costBasis: unitCost,
        acquisitionDate: date,
        status: "IN_STOCK",
        location,
        internalSku: await nextInternalSku(prisma),
      },
    });
    inventoryItemId = created.id;
  }

  await prisma.purchase.create({
    data: {
      date,
      source: optStr(formData.get("source")),
      itemName,
      quantity,
      unitCost,
      fees,
      shipping,
      total,
      notes: optStr(formData.get("notes")),
      inventoryItemId,
    },
  });

  revalidatePath("/purchases");
  revalidatePath("/inventory");
}

// Edit the label/cost-of-acquisition fields of a purchase. Quantity and
// per-unit cost are NOT editable here because they were baked into the linked
// item's weighted-average cost basis; to change those, delete and re-add.
export async function updatePurchase(formData: FormData) {
  const session = await requireSession();
  const id = str(formData.get("id"));
  const before = await prisma.purchase.findUnique({ where: { id } });
  if (!before) throw new Error("Purchase not found.");

  const fees = num(formData.get("fees"));
  const shipping = num(formData.get("shipping"));
  const total = before.quantity * before.unitCost + fees + shipping;

  const after = await prisma.purchase.update({
    where: { id },
    data: {
      date: optDate(formData.get("date")) ?? before.date,
      source: optStr(formData.get("source")),
      itemName: str(formData.get("itemName")) || before.itemName,
      fees,
      shipping,
      total,
      notes: optStr(formData.get("notes")),
    },
  });

  await writeAudit(prisma, {
    entity: "Purchase",
    entityId: id,
    action: "update",
    summary: after.itemName,
    before,
    after,
    userEmail: session.user?.email ?? null,
  });

  revalidatePath("/inventory");
}

export async function deletePurchase(formData: FormData) {
  const session = await requireSession();
  const id = str(formData.get("id"));
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase) return;
  if (purchase.inventoryItemId) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: purchase.inventoryItemId },
    });
    if (item) {
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: Math.max(0, item.quantity - purchase.quantity) },
      });
    }
  }
  await prisma.purchase.delete({ where: { id } });
  await writeAudit(prisma, {
    entity: "Purchase",
    entityId: id,
    action: "delete",
    summary: purchase.itemName,
    before: purchase,
    userEmail: session.user?.email ?? null,
  });
  revalidatePath("/inventory");
}
