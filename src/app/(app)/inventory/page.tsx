import Link from "next/link";
import { ItemStatus, Prisma } from "@prisma/client";
import PageHeader from "@/components/PageHeader";
import SubmitOnChange from "@/components/SubmitOnChange";
import FilterBar from "@/components/FilterBar";
import Modal, { ModalSubmit } from "@/components/Modal";
import RecordButtons from "./RecordButtons";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { fmtDate, money, toDateInput } from "@/lib/utils";
import { deleteItem, deleteShipment, shipToUS, updateStatus } from "./actions";
import { deletePurchase } from "@/app/(app)/purchases/actions";
import { deleteSale } from "@/app/(app)/sales/actions";
import { deleteTrade } from "@/app/(app)/trades/actions";

type Filters = { q: string; status: string; graded: string; type: string };

// Search across the descriptive/identifier fields shared by every item.
function nameSearch(q: string): Prisma.InventoryItemWhereInput {
  if (!q) return {};
  const contains = { contains: q, mode: "insensitive" as const };
  return {
    OR: [
      { name: contains },
      { setName: contains },
      { cardNumber: contains },
      { sku: contains },
      { internalSku: contains },
    ],
  };
}

const STATUS_FILTER_OPTS = [
  { value: "", label: "All statuses" },
  { value: "IN_STOCK", label: "In stock" },
  { value: "LISTED", label: "Listed" },
  { value: "RESERVED", label: "Reserved" },
];
const GRADED_FILTER_OPTS = [
  { value: "", label: "Graded & raw" },
  { value: "yes", label: "Graded only" },
  { value: "no", label: "Raw only" },
];
const TYPE_FILTER_OPTS = [
  { value: "", label: "All activity" },
  { value: "purchase", label: "Purchases" },
  { value: "sale", label: "Sales" },
  { value: "trade", label: "Trades" },
  { value: "shipment", label: "Shipments" },
  { value: "breakdown", label: "Break downs" },
];
const HISTORY_TYPES = ["purchase", "sale", "trade", "shipment", "breakdown"];

// Statuses an item can be set to manually. SOLD and BROKEN_DOWN are outcomes of
// recording a sale or breaking an item down — they land it in the History tab.
const STATUS_OPTS = [
  { value: "IN_STOCK", label: "In stock" },
  { value: "LISTED", label: "Listed" },
  { value: "RESERVED", label: "Reserved" },
];

const ACTIVE_STATUSES: ItemStatus[] = [
  ItemStatus.IN_STOCK,
  ItemStatus.LISTED,
  ItemStatus.RESERVED,
];

type Tab = "brazil" | "us" | "history";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: {
    tab?: string;
    q?: string;
    status?: string;
    graded?: string;
    type?: string;
  };
}) {
  await requireSession();
  const raw = searchParams?.tab;
  const tab: Tab = raw === "brazil" || raw === "history" ? raw : "us";
  // Sanitize filter params against their allowed values so a stale/hand-edited
  // URL can't push an invalid enum into Prisma (which would throw a 500).
  const oneOf = (v: string | undefined, allowed: string[]) =>
    v && allowed.includes(v) ? v : "";
  const filters: Filters = {
    q: (searchParams.q ?? "").trim(),
    status: oneOf(searchParams.status, ["IN_STOCK", "LISTED", "RESERVED"]),
    graded: oneOf(searchParams.graded, ["yes", "no"]),
    type: oneOf(searchParams.type, HISTORY_TYPES),
  };

  const [brazilCount, usCount, purchaseItems, saleItems, tradeItems, customers] =
    await Promise.all([
      prisma.inventoryItem.count({
        where: { status: { in: ACTIVE_STATUSES }, location: "BRAZIL" },
      }),
      prisma.inventoryItem.count({
        where: { status: { in: ACTIVE_STATUSES }, location: "US" },
      }),
      // Data for the record-activity popups in the header.
      prisma.inventoryItem.findMany({
        where: { status: { in: ACTIVE_STATUSES } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, quantity: true },
      }),
      prisma.inventoryItem.findMany({
        where: { quantity: { gt: 0 }, location: "US" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, quantity: true, costBasis: true },
      }),
      prisma.inventoryItem.findMany({
        where: { quantity: { gt: 0 } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, quantity: true, costBasis: true },
      }),
      prisma.customer.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Track every card through its lifecycle: Brazil → ship to US → sold."
      >
        <RecordButtons
          purchaseItems={purchaseItems}
          saleItems={saleItems}
          customers={customers}
          tradeItems={tradeItems}
        />
        <a href="/api/export/inventory" className="btn-secondary">
          Export CSV
        </a>
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
        <TabLink href="/inventory?tab=brazil" active={tab === "brazil"}>
          In Brazil <Count n={brazilCount} />
        </TabLink>
        <TabLink href="/inventory?tab=us" active={tab === "us"}>
          In US <Count n={usCount} />
        </TabLink>
        <TabLink href="/inventory?tab=history" active={tab === "history"}>
          History
        </TabLink>
      </div>

      {tab === "brazil" && <BrazilTab filters={filters} />}
      {tab === "us" && <UsTab filters={filters} />}
      {tab === "history" && <HistoryTab filters={filters} />}
    </div>
  );
}

// ── In Brazil ───────────────────────────────────────────────────────────────
// Items just purchased, sitting in Brazil. Use "Ship to US" to move some or all
// of them — picking a quantity per item — and record the shipment's costs.
async function BrazilTab({ filters }: { filters: Filters }) {
  const { q, status, graded } = filters;
  const [items, shippable] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: {
        location: "BRAZIL",
        status: status ? (status as ItemStatus) : { in: ACTIVE_STATUSES },
        ...(graded ? { graded: graded === "yes" } : {}),
        ...nameSearch(q),
      },
      orderBy: { createdAt: "desc" },
    }),
    // Everything shippable, regardless of the on-page filter, for the modal.
    prisma.inventoryItem.findMany({
      where: { location: "BRAZIL", status: { in: ACTIVE_STATUSES } },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = items.reduce((s, i) => s + i.quantity * i.costBasis, 0);
  const filtered = Boolean(q || status || graded);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Items in Brazil" value={items.length.toString()} />
        <Stat label="Total units" value={totalUnits.toString()} />
        <Stat label="Cost value" value={money(totalValue)} />
      </div>

      {shippable.length > 0 && (
        <div className="mb-4 flex justify-end">
          <Modal triggerLabel="+ Ship to US" title="Ship items to the US">
            <form action={shipToUS} className="space-y-4">
              <p className="text-xs text-slate-500">
                Choose how many of each item to ship. Shipping, tariffs and fees
                are split across the shipped units (by cost value) and added to
                their cost basis, so profit math stays accurate when they sell.
              </p>

              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="th w-8"></th>
                      <th className="th">Item</th>
                      <th className="th">Available</th>
                      <th className="th">Ship qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shippable.map((i) => (
                      <tr key={i.id}>
                        <td className="td">
                          <input
                            type="checkbox"
                            name="itemId"
                            value={i.id}
                            defaultChecked
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="td">
                          <div className="font-medium">{i.name}</div>
                          <div className="text-xs text-slate-400">
                            {[i.setName, i.year, i.internalSku]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </td>
                        <td className="td text-slate-500">{i.quantity}</td>
                        <td className="td">
                          <input
                            type="number"
                            name={`qty_${i.id}`}
                            min={1}
                            max={i.quantity}
                            defaultValue={i.quantity}
                            className="input w-24 py-1"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">Ship date</label>
                  <input
                    name="date"
                    type="date"
                    defaultValue={toDateInput(new Date())}
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Reference (optional)</label>
                  <input
                    name="reference"
                    className="input"
                    placeholder="Tracking # / pack name"
                  />
                </div>
                <div>
                  <label className="label">Shipping cost</label>
                  <input name="shipping" type="number" step="0.01" defaultValue="0" className="input" />
                </div>
                <div>
                  <label className="label">Tariffs / duties</label>
                  <input name="tariffs" type="number" step="0.01" defaultValue="0" className="input" />
                </div>
                <div>
                  <label className="label">Other fees</label>
                  <input name="fees" type="number" step="0.01" defaultValue="0" className="input" />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <label className="label">Notes</label>
                  <input name="notes" className="input" />
                </div>
              </div>

              <ModalSubmit>Ship selected to US</ModalSubmit>
            </form>
          </Modal>
        </div>
      )}

      <FilterBar
        action="/inventory"
        q={q}
        placeholder="Search name, set, SKU…"
        hidden={{ tab: "brazil" }}
        selects={[
          { name: "status", value: status, options: STATUS_FILTER_OPTS },
          { name: "graded", value: graded, options: GRADED_FILTER_OPTS },
        ]}
        clearHref="/inventory?tab=brazil"
      />

      {items.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          {filtered ? (
            "No items in Brazil match your filters."
          ) : (
            <>
              No inventory in Brazil. Items appear here when you record a
              purchase (button above) with location set to Brazil.
            </>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Card</th>
                <th className="th">Details</th>
                <th className="th">Internal SKU</th>
                <th className="th">Qty</th>
                <th className="th">Cost/unit</th>
                <th className="th">Value</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="td font-medium">
                    {i.name}
                    {i.graded && (
                      <span className="badge ml-2 bg-amber-100 text-amber-700">
                        {i.gradingCompany || "Graded"} {i.grade}
                      </span>
                    )}
                  </td>
                  <td className="td text-slate-500">
                    {[i.setName, i.year, i.cardNumber ? `#${i.cardNumber}` : null, i.condition]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="td font-mono text-xs text-slate-600">
                    {i.internalSku || "—"}
                  </td>
                  <td className="td">{i.quantity}</td>
                  <td className="td">{money(i.costBasis)}</td>
                  <td className="td">{money(i.quantity * i.costBasis)}</td>
                  <td className="td">
                    <Link
                      href={`/inventory/${i.id}/edit`}
                      className="btn-secondary py-1 text-xs"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── In US ───────────────────────────────────────────────────────────────────
// Landed inventory, ready to sell (wholesale) or break down (for Whatnot).
async function UsTab({ filters }: { filters: Filters }) {
  const { q, status, graded } = filters;
  const items = await prisma.inventoryItem.findMany({
    where: {
      location: "US",
      status: status ? (status as ItemStatus) : { in: ACTIVE_STATUSES },
      ...(graded ? { graded: graded === "yes" } : {}),
      ...nameSearch(q),
    },
    orderBy: { createdAt: "desc" },
    include: { parentItem: { select: { internalSku: true, name: true } } },
  });

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = items.reduce((s, i) => s + i.quantity * i.costBasis, 0);
  const lowStock = items.filter((i) => i.quantity <= 1).length;
  const filtered = Boolean(q || status || graded);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Distinct items" value={items.length.toString()} />
        <Stat label="Total units" value={totalUnits.toString()} />
        <Stat label="Inventory value (cost)" value={money(totalValue)} />
        <Stat label="Low stock (≤1)" value={lowStock.toString()} />
      </div>

      <FilterBar
        action="/inventory"
        q={q}
        placeholder="Search name, set, SKU…"
        hidden={{ tab: "us" }}
        selects={[
          { name: "status", value: status, options: STATUS_FILTER_OPTS },
          { name: "graded", value: graded, options: GRADED_FILTER_OPTS },
        ]}
        clearHref="/inventory?tab=us"
      />

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Landed US inventory. Use <strong>+ Sale</strong> above to record a sale
        (wholesale or Whatnot), or <strong>Break down</strong> a sealed item
        into singles for Whatnot. Every sale, trade, shipment and break down is
        logged in{" "}
        <Link href="/inventory?tab=history" className="font-medium text-brand-700">
          History
        </Link>
        .
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[940px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Card</th>
              <th className="th">Details</th>
              <th className="th">Internal SKU</th>
              <th className="th">Qty</th>
              <th className="th">Cost/unit</th>
              <th className="th">Value</th>
              <th className="th">Status</th>
              <th className="th">Acquired</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={9}>
                  {filtered
                    ? "No US inventory matches your filters."
                    : "No US inventory yet. Ship items from Brazil to land them here."}
                </td>
              </tr>
            )}
            {items.map((i) => (
              <tr key={i.id}>
                <td className="td font-medium">
                  {i.name}
                  {i.graded && (
                    <span className="badge ml-2 bg-amber-100 text-amber-700">
                      {i.gradingCompany || "Graded"} {i.grade}
                    </span>
                  )}
                </td>
                <td className="td text-slate-500">
                  {[i.setName, i.year, i.cardNumber ? `#${i.cardNumber}` : null, i.condition]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="td">
                  <span className="font-mono text-xs text-slate-600">
                    {i.internalSku || "—"}
                  </span>
                  {i.parentItem?.internalSku && (
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      from {i.parentItem.internalSku}
                    </div>
                  )}
                </td>
                <td className="td">{i.quantity}</td>
                <td className="td">{money(i.costBasis)}</td>
                <td className="td">{money(i.quantity * i.costBasis)}</td>
                <td className="td">
                  <form action={updateStatus}>
                    <input type="hidden" name="id" value={i.id} />
                    <SubmitOnChange
                      name="status"
                      value={i.status}
                      options={STATUS_OPTS}
                    />
                  </form>
                </td>
                <td className="td">{fmtDate(i.acquisitionDate)}</td>
                <td className="td">
                  <div className="flex gap-2">
                    <Link
                      href={`/inventory/${i.id}/edit`}
                      className="btn-secondary py-1 text-xs"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/inventory/${i.id}/breakdown`}
                      className="btn-secondary py-1 text-xs"
                    >
                      Break down
                    </Link>
                    <form action={deleteItem}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="btn-danger py-1 text-xs">Delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Shipments ───────────────────────────────────────────────────────────────
// ── History (unified activity feed) ─────────────────────────────────────────
// Every event — purchase, sale, trade, shipment, break down — in one timeline,
// each tagged with its type. Sales appear per-sale as they happen, even while
// stock remains.
const TAGS: Record<string, { label: string; cls: string }> = {
  purchase: { label: "Purchase", cls: "bg-blue-100 text-blue-700" },
  sale: { label: "Sale", cls: "bg-green-100 text-green-700" },
  trade: { label: "Trade", cls: "bg-purple-100 text-purple-700" },
  shipment: { label: "Shipment", cls: "bg-sky-100 text-sky-700" },
  breakdown: { label: "Break down", cls: "bg-amber-100 text-amber-700" },
};

async function HistoryTab({ filters }: { filters: Filters }) {
  const { q, type } = filters;
  const want = (t: string) => !type || type === t;
  const TAKE = 200;
  const contains = q
    ? { contains: q, mode: "insensitive" as const }
    : undefined;

  const [purchases, sales, trades, shipments, broken] = await Promise.all([
    want("purchase")
      ? prisma.purchase.findMany({
          where: contains
            ? {
                OR: [
                  { itemName: contains },
                  { source: contains },
                  { notes: contains },
                ],
              }
            : {},
          orderBy: { date: "desc" },
          take: TAKE,
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
          take: TAKE,
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
          take: TAKE,
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
          take: TAKE,
          include: { items: true },
        })
      : [],
    want("breakdown")
      ? prisma.inventoryItem.findMany({
          where: { status: "BROKEN_DOWN", ...nameSearch(q) },
          orderBy: [{ brokenDownAt: "desc" }, { updatedAt: "desc" }],
          take: TAKE,
          include: {
            childItems: {
              select: { id: true, name: true, internalSku: true, quantity: true },
            },
          },
        })
      : [],
  ]);

  type Ev = {
    key: string;
    date: Date;
    type: string;
    name: string;
    sku: string | null;
    details: React.ReactNode;
    del?: React.ReactNode;
  };
  const events: Ev[] = [];

  for (const p of purchases) {
    events.push({
      key: `p-${p.id}`,
      date: p.date,
      type: "purchase",
      name: p.itemName,
      sku: p.inventoryItem?.internalSku ?? null,
      details: (
        <span>
          +{p.quantity} {p.quantity === 1 ? "unit" : "units"} · cost{" "}
          {money(p.total)}
          {p.source ? ` · ${p.source}` : ""}
        </span>
      ),
      del: <DeleteForm action={deletePurchase} id={p.id} />,
    });
  }
  for (const s of sales) {
    events.push({
      key: `s-${s.id}`,
      date: s.date,
      type: "sale",
      name: s.inventoryItem?.name ?? "Misc sale",
      sku: s.inventoryItem?.internalSku ?? null,
      details: (
        <div className="text-sm">
          <div>
            <span className="font-medium">{money(s.salePrice)}</span> for{" "}
            {s.quantity} {s.quantity === 1 ? "unit" : "units"} ·{" "}
            <span className={s.profit >= 0 ? "text-green-600" : "text-red-600"}>
              {money(s.profit)} profit
            </span>
          </div>
          {(s.platform || s.customer?.name) && (
            <div className="text-xs text-slate-400">
              {[s.platform, s.customer?.name].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      ),
      del: <DeleteForm action={deleteSale} id={s.id} />,
    });
  }
  for (const t of trades) {
    const gave = t.legs.filter((l) => l.direction === "GAVE");
    const recv = t.legs.filter((l) => l.direction === "RECEIVED");
    events.push({
      key: `t-${t.id}`,
      date: t.date,
      type: "trade",
      name: t.counterparty || "Trade",
      sku: null,
      details: (
        <div className="text-sm">
          <div className="text-xs">
            <span className="text-slate-400">Gave:</span>{" "}
            {gave.map((l) => `${l.quantity}× ${l.itemName}`).join(", ") ||
              (t.cashOut > 0 ? `cash ${money(t.cashOut)}` : "—")}
          </div>
          <div className="text-xs">
            <span className="text-slate-400">Received:</span>{" "}
            {recv.map((l) => `${l.quantity}× ${l.itemName}`).join(", ") ||
              (t.cashIn > 0 ? `cash ${money(t.cashIn)}` : "—")}
          </div>
          {t.realizedGain > 0 && (
            <div className="text-xs text-emerald-600">
              Realized gain {money(t.realizedGain)}
            </div>
          )}
        </div>
      ),
      del: <DeleteForm action={deleteTrade} id={t.id} />,
    });
  }
  for (const sh of shipments) {
    const units = sh.items.reduce((a, x) => a + x.quantity, 0);
    const landed = sh.shipping + sh.tariffs + sh.fees;
    events.push({
      key: `h-${sh.id}`,
      date: sh.date,
      type: "shipment",
      name: sh.reference || "Shipment to US",
      sku: null,
      details: (
        <span>
          {units} {units === 1 ? "unit" : "units"} → US · landed {money(landed)}{" "}
          <span className="text-xs text-slate-400">
            (ship {money(sh.shipping)} · tariffs {money(sh.tariffs)}
            {sh.fees ? ` · fees ${money(sh.fees)}` : ""})
          </span>
        </span>
      ),
      del: <DeleteForm action={deleteShipment} id={sh.id} />,
    });
  }
  for (const b of broken) {
    events.push({
      key: `b-${b.id}`,
      date: b.brokenDownAt ?? b.updatedAt,
      type: "breakdown",
      name: b.name,
      sku: b.internalSku,
      details: <BrokenDetails units={b.childItems} />,
    });
  }

  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  const unitsSold = sales.reduce((s, x) => s + x.quantity, 0);
  const realizedProfit = sales.reduce((s, x) => s + x.profit, 0);
  const filtered = Boolean(q || type);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Activity (shown)" value={events.length.toString()} />
        <Stat label="Units sold (shown)" value={unitsSold.toString()} />
        <Stat label="Realized profit (shown)" value={money(realizedProfit)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <FilterBar
          action="/inventory"
          q={q}
          placeholder="Search item, source, platform, customer…"
          hidden={{ tab: "history" }}
          selects={[{ name: "type", value: type, options: TYPE_FILTER_OPTS }]}
          clearHref="/inventory?tab=history"
        />
        <div className="flex gap-2">
          <a href="/api/export/sales" className="btn-secondary py-1 text-xs">
            Export sales
          </a>
          <a href="/api/export/purchases" className="btn-secondary py-1 text-xs">
            Export purchases
          </a>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Date</th>
              <th className="th">Type</th>
              <th className="th">Item</th>
              <th className="th">Details</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={5}>
                  {filtered
                    ? "No activity matches your filters."
                    : "Nothing here yet. Purchases, sales, trades, shipments and break downs will appear in this timeline."}
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.key}>
                <td className="td whitespace-nowrap">{fmtDate(e.date)}</td>
                <td className="td">
                  <span className={`badge ${TAGS[e.type].cls}`}>
                    {TAGS[e.type].label}
                  </span>
                </td>
                <td className="td font-medium">
                  {e.name}
                  {e.sku && (
                    <div className="font-mono text-[11px] font-normal text-slate-400">
                      {e.sku}
                    </div>
                  )}
                </td>
                <td className="td text-slate-600">{e.details}</td>
                <td className="td">{e.del}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeleteForm({
  action,
  id,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="btn-danger py-1 text-xs">Delete</button>
    </form>
  );
}

function BrokenDetails({
  units,
}: {
  units: {
    id: string;
    name: string;
    internalSku: string | null;
    quantity: number;
  }[];
}) {
  if (units.length === 0) {
    return <span className="text-slate-400">Broken down into units</span>;
  }
  return (
    <div className="text-sm">
      <span className="text-slate-500">Broken down into:</span>
      <ul className="mt-1 space-y-0.5">
        {units.map((c) => (
          <li key={c.id} className="text-xs">
            {c.quantity}× {c.name}
            {c.internalSku && (
              <span className="ml-1 font-mono text-slate-400">
                {c.internalSku}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </Link>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
      {n}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
