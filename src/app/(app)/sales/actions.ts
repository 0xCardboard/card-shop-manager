"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { intNum, num, optDate, optStr, str } from "@/lib/utils";
import { writeAudit } from "@/lib/audit";

export async function createSale(formData: FormData) {
  await requireSession();

  const quantity = Math.max(1, intNum(formData.get("quantity")));
  const salePrice = num(formData.get("salePrice"));
  const fees = num(formData.get("fees"));
  const shipping = num(formData.get("shipping"));
  const date = optDate(formData.get("date")) ?? new Date();
  const inventoryItemId = optStr(formData.get("inventoryItemId"));
  const customerId = optStr(formData.get("customerId"));

  let costBasisAtSale = 0;

  if (inventoryItemId) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    });
    if (item) {
      costBasisAtSale = item.costBasis * quantity;
      const newQty = Math.max(0, item.quantity - quantity);
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          quantity: newQty,
          status: newQty === 0 ? "SOLD" : item.status,
        },
      });
    }
  }

  const profit = salePrice - fees - shipping - costBasisAtSale;

  await prisma.sale.create({
    data: {
      date,
      quantity,
      salePrice,
      fees,
      shipping,
      platform: optStr(formData.get("platform")),
      costBasisAtSale,
      profit,
      notes: optStr(formData.get("notes")),
      inventoryItemId,
      customerId,
    },
  });

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

// Edit a sale. Quantity changes are reconciled against stock by returning the
// old quantity to the linked item and deducting the new one (mirroring
// delete-then-create). Profit and COGS are recomputed from the item's current
// cost basis.
export async function updateSale(formData: FormData) {
  const session = await requireSession();
  const id = str(formData.get("id"));
  const before = await prisma.sale.findUnique({ where: { id } });
  if (!before) throw new Error("Sale not found.");

  const quantity = Math.max(1, intNum(formData.get("quantity")));
  const salePrice = num(formData.get("salePrice"));
  const fees = num(formData.get("fees"));
  const shipping = num(formData.get("shipping"));
  const date = optDate(formData.get("date")) ?? before.date;
  const customerId = optStr(formData.get("customerId"));

  let costBasisAtSale = before.costBasisAtSale;

  if (before.inventoryItemId) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: before.inventoryItemId },
    });
    if (item) {
      // Return the old sale's units, then deduct the new quantity.
      const available = item.quantity + before.quantity;
      const newQty = Math.max(0, available - quantity);
      costBasisAtSale = item.costBasis * quantity;
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          quantity: newQty,
          status:
            newQty === 0
              ? "SOLD"
              : item.status === "SOLD"
                ? "IN_STOCK"
                : item.status,
        },
      });
    }
  }

  const profit = salePrice - fees - shipping - costBasisAtSale;

  const after = await prisma.sale.update({
    where: { id },
    data: {
      date,
      quantity,
      salePrice,
      fees,
      shipping,
      platform: optStr(formData.get("platform")),
      costBasisAtSale,
      profit,
      notes: optStr(formData.get("notes")),
      customerId,
    },
  });

  await writeAudit(prisma, {
    entity: "Sale",
    entityId: id,
    action: "update",
    summary: `Sale of ${after.quantity}`,
    before,
    after,
    userEmail: session.user?.email ?? null,
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function deleteSale(formData: FormData) {
  const session = await requireSession();
  const id = str(formData.get("id"));
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) return;
  if (sale.inventoryItemId) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: sale.inventoryItemId },
    });
    if (item) {
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          quantity: item.quantity + sale.quantity,
          status: item.status === "SOLD" ? "IN_STOCK" : item.status,
        },
      });
    }
  }
  await prisma.sale.delete({ where: { id } });
  await writeAudit(prisma, {
    entity: "Sale",
    entityId: id,
    action: "delete",
    summary: `Sale of ${sale.quantity}`,
    before: sale,
    userEmail: session.user?.email ?? null,
  });
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}
