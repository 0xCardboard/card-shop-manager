"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { num, optDate, optStr, str } from "@/lib/utils";

export async function createExpense(formData: FormData) {
  await requireSession();
  await prisma.expense.create({
    data: {
      date: optDate(formData.get("date")) ?? new Date(),
      category: str(formData.get("category")) || "Other",
      amount: num(formData.get("amount")),
      vendor: optStr(formData.get("vendor")),
      notes: optStr(formData.get("notes")),
    },
  });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function deleteExpense(formData: FormData) {
  await requireSession();
  await prisma.expense.delete({ where: { id: str(formData.get("id")) } });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}
