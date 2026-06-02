"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { str } from "@/lib/utils";

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "STAFF"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function createUser(formData: FormData) {
  await requireAdmin();
  const parsed = userSchema.safeParse({
    email: str(formData.get("email")).toLowerCase(),
    name: str(formData.get("name")),
    role: str(formData.get("role")) || "STAFF",
    password: str(formData.get("password")),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message || "Invalid input");
  }
  const data = parsed.data;
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) throw new Error("A user with that email already exists.");

  const passwordHash = await bcrypt.hash(data.password, 10);
  await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      role: data.role,
      passwordHash,
    },
  });
  revalidatePath("/settings/users");
}

export async function setUserActive(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("id"));
  const active = str(formData.get("active")) === "true";
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/settings/users");
}

export async function resetPassword(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("id"));
  const password = str(formData.get("password"));
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  revalidatePath("/settings/users");
}

export async function deleteUser(formData: FormData) {
  const session = await requireAdmin();
  const id = str(formData.get("id"));
  if (id === session.user.id) {
    throw new Error("You cannot delete your own account.");
  }
  await prisma.user.delete({ where: { id } });
  revalidatePath("/settings/users");
}
