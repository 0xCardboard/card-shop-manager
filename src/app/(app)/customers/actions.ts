"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { optStr, str } from "@/lib/utils";

function readCustomer(formData: FormData) {
  return {
    name: str(formData.get("name")),
    email: optStr(formData.get("email")),
    phone: optStr(formData.get("phone")),
    type: optStr(formData.get("type")),
    tags: optStr(formData.get("tags")),
    notes: optStr(formData.get("notes")),
  };
}

export async function createCustomer(formData: FormData) {
  await requireSession();
  await prisma.customer.create({ data: readCustomer(formData) });
  revalidatePath("/customers");
}

export async function updateCustomer(formData: FormData) {
  await requireSession();
  const id = str(formData.get("id"));
  await prisma.customer.update({ where: { id }, data: readCustomer(formData) });
  revalidatePath("/customers");
  redirect("/customers");
}

export async function deleteCustomer(formData: FormData) {
  await requireSession();
  await prisma.customer.delete({ where: { id: str(formData.get("id")) } });
  revalidatePath("/customers");
}
