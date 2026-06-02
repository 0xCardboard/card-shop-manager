"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { str } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function createFirstAdmin(
  _prev: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  // Hard guard: this only works when there are no users at all.
  const count = await prisma.user.count();
  if (count > 0) {
    redirect("/login");
  }

  const parsed = schema.safeParse({
    name: str(formData.get("name")),
    email: str(formData.get("email")).toLowerCase(),
    password: str(formData.get("password")),
  });
  if (!parsed.success) {
    return "Enter a name, a valid email, and a password of at least 8 characters.";
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: "ADMIN",
      active: true,
    },
  });

  redirect("/login");
}
