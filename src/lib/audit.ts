import type { Prisma, PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

type Db = PrismaClient | Prisma.TransactionClient;

// The email of the signed-in user, for attributing audit entries.
export async function currentUserEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}

// Record a before/after snapshot of an edit or delete to an activity record.
export async function writeAudit(
  db: Db,
  entry: {
    entity: string;
    entityId: string;
    action: "update" | "delete";
    summary?: string | null;
    before?: unknown;
    after?: unknown;
    userEmail?: string | null;
  }
): Promise<void> {
  await db.auditLog.create({
    data: {
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      summary: entry.summary ?? null,
      before: entry.before == null ? null : JSON.stringify(entry.before),
      after: entry.after == null ? null : JSON.stringify(entry.after),
      userEmail: entry.userEmail ?? null,
    },
  });
}
