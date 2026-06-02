"use server";

import { revalidatePath } from "next/cache";
import { LeadStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { num, optDate, optStr, str } from "@/lib/utils";

export async function createLead(formData: FormData) {
  await requireSession();
  await prisma.lead.create({
    data: {
      title: str(formData.get("title")),
      contactName: optStr(formData.get("contactName")),
      contactInfo: optStr(formData.get("contactInfo")),
      interestedIn: optStr(formData.get("interestedIn")),
      stage: (str(formData.get("stage")) as LeadStage) || "PROSPECT",
      value: num(formData.get("value")),
      followUpDate: optDate(formData.get("followUpDate")),
      notes: optStr(formData.get("notes")),
      customerId: optStr(formData.get("customerId")),
    },
  });
  revalidatePath("/leads");
}

export async function updateStage(formData: FormData) {
  await requireSession();
  const id = str(formData.get("id"));
  const stage = str(formData.get("stage")) as LeadStage;
  await prisma.lead.update({ where: { id }, data: { stage } });
  revalidatePath("/leads");
}

export async function deleteLead(formData: FormData) {
  await requireSession();
  await prisma.lead.delete({ where: { id: str(formData.get("id")) } });
  revalidatePath("/leads");
}
