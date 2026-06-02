"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { intNum, num, optDate, optStr, str } from "@/lib/utils";

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

export async function deleteSale(formData: FormData) {
  await requireSession();
  const id = str(formData.get("id"));
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (sale?.inventoryItemId) {
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
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}
