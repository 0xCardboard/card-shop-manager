"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ItemStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { intNum, num, optDate, optStr, str } from "@/lib/utils";
import { childInternalSku, ensureInternalSku } from "@/lib/sku";

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
