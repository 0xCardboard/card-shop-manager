import { prisma } from "@/lib/prisma";
import { isoDate } from "@/lib/csv";

export type HistoryFilters = { q: string; type: string };

// Fetch the raw records behind the History activity feed, honouring the type
// and search filters. Shared by the History tab and the History CSV export so
// the two never drift apart.
export async function fetchHistoryRaw(
  { q, type }: HistoryFilters,
  take = 300
) {
  const want = (t: string) => !type || type === t;
  const contains = q ? { contains: q, mode: "insensitive" as const } : undefined;

  const [purchases, sales, trades, shipments, broken] = await Promise.all([
    want("purchase")
      ? prisma.purchase.findMany({
          where: contains
            ? { OR: [{ itemName: contains }, { source: contains }, { notes: contains }] }
            : {},
          orderBy: { date: "desc" },
          take,
          include: { inventoryItem: { select: { internalSku: true } } },
        })
      : [],
    want("sale")
      ? prisma.sale.findMany({
          where: contains
            ? {
                OR: [
                  { platform: contains },
                  { notes: contains },
                  { inventoryItem: { name: contains } },
                  { customer: { name: contains } },
                ],
              }
            : {},
          orderBy: { date: "desc" },
          take,
          include: {
            inventoryItem: { select: { name: true, internalSku: true } },
            customer: { select: { name: true } },
          },
        })
      : [],
    want("trade")
      ? prisma.trade.findMany({
          where: contains
            ? {
                OR: [
                  { counterparty: contains },
                  { notes: contains },
                  { legs: { some: { itemName: contains } } },
                ],
              }
            : {},
          orderBy: { date: "desc" },
          take,
          include: { legs: true },
        })
      : [],
    want("shipment")
      ? prisma.shipment.findMany({
          where: contains
            ? {
                OR: [
                  { reference: contains },
                  { notes: contains },
                  { items: { some: { itemName: contains } } },
                ],
              }
            : {},
          orderBy: { date: "desc" },
          take,
          include: { items: true },
        })
      : [],
    want("breakdown")
      ? prisma.inventoryItem.findMany({
          where: {
            status: "BROKEN_DOWN",
            ...(contains
              ? {
                  OR: [
                    { name: contains },
                    { setName: contains },
                    { internalSku: contains },
                  ],
                }
              : {}),
          },
          orderBy: [{ brokenDownAt: "desc" }, { updatedAt: "desc" }],
          take,
          include: {
            childItems: {
              select: { id: true, name: true, internalSku: true, quantity: true },
            },
          },
        })
      : [],
  ]);

  return { purchases, sales, trades, shipments, broken };
}

// Flatten the raw history into a single CSV-ready table (one schema for all
// activity types) for export.
export function historyToCsv(raw: Awaited<ReturnType<typeof fetchHistoryRaw>>) {
  const headers = [
    "Date",
    "Type",
    "Item / Name",
    "Internal SKU",
    "Quantity",
    "Amount",
    "Profit",
    "Party",
    "Notes",
  ];

  type Row = {
    date: Date;
    cells: (string | number)[];
  };
  const rows: Row[] = [];

  for (const p of raw.purchases) {
    rows.push({
      date: p.date,
      cells: [
        isoDate(p.date), "Purchase", p.itemName,
        p.inventoryItem?.internalSku ?? "", p.quantity, p.total.toFixed(2),
        "", p.source ?? "", p.notes ?? "",
      ],
    });
  }
  for (const s of raw.sales) {
    rows.push({
      date: s.date,
      cells: [
        isoDate(s.date), "Sale", s.inventoryItem?.name ?? "Misc sale",
        s.inventoryItem?.internalSku ?? "", s.quantity, s.salePrice.toFixed(2),
        s.profit.toFixed(2),
        [s.platform, s.customer?.name].filter(Boolean).join(" / "),
        s.notes ?? "",
      ],
    });
  }
  for (const t of raw.trades) {
    const gave = t.legs.filter((l) => l.direction === "GAVE");
    const recv = t.legs.filter((l) => l.direction === "RECEIVED");
    const detail =
      `Gave: ${gave.map((l) => `${l.quantity}x ${l.itemName}`).join(", ") || "—"}` +
      ` | Received: ${recv.map((l) => `${l.quantity}x ${l.itemName}`).join(", ") || "—"}` +
      (t.cashIn ? ` | cash in ${t.cashIn.toFixed(2)}` : "") +
      (t.cashOut ? ` | cash out ${t.cashOut.toFixed(2)}` : "");
    rows.push({
      date: t.date,
      cells: [
        isoDate(t.date), "Trade", t.counterparty ?? "Trade", "", "",
        t.realizedGain ? t.realizedGain.toFixed(2) : "", t.realizedGain.toFixed(2),
        t.counterparty ?? "", [detail, t.notes].filter(Boolean).join(" — "),
      ],
    });
  }
  for (const sh of raw.shipments) {
    const units = sh.items.reduce((a, x) => a + x.quantity, 0);
    rows.push({
      date: sh.date,
      cells: [
        isoDate(sh.date), "Shipment", sh.reference ?? "Shipment to US", "",
        units, (sh.shipping + sh.tariffs + sh.fees).toFixed(2), "", "",
        [
          `ship ${sh.shipping.toFixed(2)}`,
          `tariffs ${sh.tariffs.toFixed(2)}`,
          `fees ${sh.fees.toFixed(2)}`,
          sh.notes,
        ]
          .filter(Boolean)
          .join(" · "),
      ],
    });
  }
  for (const b of raw.broken) {
    const units = b.childItems.reduce((a, x) => a + x.quantity, 0);
    rows.push({
      date: b.brokenDownAt ?? b.updatedAt,
      cells: [
        isoDate(b.brokenDownAt ?? b.updatedAt), "Break down", b.name,
        b.internalSku ?? "", units, "", "", "",
        `Broken into: ${b.childItems
          .map((c) => `${c.quantity}x ${c.name}`)
          .join(", ")}`,
      ],
    });
  }

  rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  return { headers, rows: rows.map((r) => r.cells) };
}
