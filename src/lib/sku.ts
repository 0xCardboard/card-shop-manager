import type { Prisma, PrismaClient } from "@prisma/client";

// Works with either the base client or a transaction client.
type Db = PrismaClient | Prisma.TransactionClient;

const PREFIX = "CSM";
const PAD = 6;

function pad(n: number): string {
  return String(n).padStart(PAD, "0");
}

// Generate the next free sequential internal SKU, e.g. "CSM-000123".
// Walks forward from the highest existing number until it finds an unused one,
// so it stays collision-free even alongside child SKUs (CSM-000123-B01).
export async function nextInternalSku(db: Db): Promise<string> {
  const last = await db.inventoryItem.findFirst({
    where: { internalSku: { startsWith: `${PREFIX}-` } },
    orderBy: { internalSku: "desc" },
    select: { internalSku: true },
  });

  let n = 1;
  if (last?.internalSku) {
    const m = last.internalSku.match(/^CSM-(\d+)/);
    if (m) n = parseInt(m[1], 10) + 1;
  }

  // Guard against any collision with an exact base SKU already in use.
  while (
    await db.inventoryItem.findFirst({
      where: { internalSku: `${PREFIX}-${pad(n)}` },
      select: { id: true },
    })
  ) {
    n++;
  }

  return `${PREFIX}-${pad(n)}`;
}

// Derive a child SKU from its parent's internal SKU, e.g. "CSM-000123-B01".
// Ties broken-down units back to the parent they were opened from.
export function childInternalSku(parentSku: string, index: number): string {
  return `${parentSku}-B${String(index).padStart(2, "0")}`;
}

// Ensure an item has an internal SKU, generating one if missing. Returns the
// SKU. Used so a parent always has a base SKU before its children derive from it.
export async function ensureInternalSku(
  db: Db,
  item: { id: string; internalSku: string | null }
): Promise<string> {
  if (item.internalSku) return item.internalSku;
  const sku = await nextInternalSku(db);
  await db.inventoryItem.update({
    where: { id: item.id },
    data: { internalSku: sku },
  });
  return sku;
}
