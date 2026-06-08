import Link from "next/link";
import { ItemStatus } from "@prisma/client";
import PageHeader from "@/components/PageHeader";
import SubmitOnChange from "@/components/SubmitOnChange";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { fmtDate, money, toDateInput } from "@/lib/utils";
import { deleteItem, deleteShipment, shipToUS, updateStatus } from "./actions";

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
const HISTORY_STATUSES: ItemStatus[] = [
  ItemStatus.SOLD,
  ItemStatus.BROKEN_DOWN,
];

type Tab = "brazil" | "us" | "shipments" | "history";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  await requireSession();
  const raw = searchParams?.tab;
  const tab: Tab =
    raw === "brazil" || raw === "shipments" || raw === "history" ? raw : "us";

  const [brazilCount, usCount, shipmentsCount, historyCount] =
    await Promise.all([
      prisma.inventoryItem.count({
        where: { status: { in: ACTIVE_STATUSES }, location: "BRAZIL" },
      }),
      prisma.inventoryItem.count({
        where: { status: { in: ACTIVE_STATUSES }, location: "US" },
      }),
      prisma.shipment.count(),
      prisma.inventoryItem.count({
        where: { status: { in: HISTORY_STATUSES } },
      }),
    ]);

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Track every card through its lifecycle: Brazil → ship to US → sold."
      >
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
        <TabLink href="/inventory?tab=shipments" active={tab === "shipments"}>
          Shipments <Count n={shipmentsCount} />
        </TabLink>
        <TabLink href="/inventory?tab=history" active={tab === "history"}>
          History <Count n={historyCount} />
        </TabLink>
      </div>

      {tab === "brazil" && <BrazilTab />}
      {tab === "us" && <UsTab />}
      {tab === "shipments" && <ShipmentsTab />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}

// ── In Brazil ───────────────────────────────────────────────────────────────
// Items just purchased, sitting in Brazil. Select any number, enter the
// shipping + tariff costs for the pack, and ship them to the US in one click.
async function BrazilTab() {
  const items = await prisma.inventoryItem.findMany({
    where: { status: { in: ACTIVE_STATUSES }, location: "BRAZIL" },
    orderBy: { createdAt: "desc" },
  });

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = items.reduce((s, i) => s + i.quantity * i.costBasis, 0);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Items in Brazil" value={items.length.toString()} />
        <Stat label="Total units" value={totalUnits.toString()} />
        <Stat label="Cost value" value={money(totalValue)} />
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          No inventory in Brazil. Items appear here when you{" "}
          <a href="/purchases" className="font-medium text-brand-700">
            log a purchase
          </a>{" "}
          with location set to Brazil.
        </div>
      ) : (
        <form action={shipToUS}>
          <div className="card mb-4 overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th w-10"></th>
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
                    <td className="td">
                      <input
                        type="checkbox"
                        name="itemId"
                        value={i.id}
                        defaultChecked
                        className="h-4 w-4"
                      />
                    </td>
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

          <div className="card p-5">
            <p className="mb-4 text-sm font-semibold text-slate-700">
              Ship checked items to the US
            </p>
            <p className="mb-4 text-xs text-slate-500">
              Shipping, tariffs and fees are split across the shipped items (by
              cost value) and added to their cost basis, so profit math stays
              accurate when they sell.
            </p>
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
              <div>
                <label className="label">Reference (optional)</label>
                <input
                  name="reference"
                  className="input"
                  placeholder="Tracking # / pack name"
                />
              </div>
              <div className="hidden sm:block" />
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
            <button className="btn-primary mt-4" type="submit">
              Ship selected to US
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── In US ───────────────────────────────────────────────────────────────────
// Landed inventory, ready to sell (wholesale) or break down (for Whatnot).
async function UsTab() {
  const items = await prisma.inventoryItem.findMany({
    where: { status: { in: ACTIVE_STATUSES }, location: "US" },
    orderBy: { createdAt: "desc" },
    include: { parentItem: { select: { internalSku: true, name: true } } },
  });

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = items.reduce((s, i) => s + i.quantity * i.costBasis, 0);
  const lowStock = items.filter((i) => i.quantity <= 1).length;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Distinct items" value={items.length.toString()} />
        <Stat label="Total units" value={totalUnits.toString()} />
        <Stat label="Inventory value (cost)" value={money(totalValue)} />
        <Stat label="Low stock (≤1)" value={lowStock.toString()} />
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Landed US inventory. Record a{" "}
        <a href="/sales" className="font-medium text-brand-700">
          sale
        </a>{" "}
        (wholesale or Whatnot), or <strong>break down</strong> a sealed item
        into singles for Whatnot. Sold and broken-down items move to{" "}
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
                  No US inventory yet. Ship items from Brazil to land them here.
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
async function ShipmentsTab() {
  const shipments = await prisma.shipment.findMany({
    orderBy: { date: "desc" },
    include: { items: true },
  });

  const totalLanded = shipments.reduce(
    (s, x) => s + x.shipping + x.tariffs + x.fees,
    0
  );

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Shipments" value={shipments.length.toString()} />
        <Stat label="Total landed cost" value={money(totalLanded)} />
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Each shipment moved a batch of items from Brazil to the US. The landed
        cost (shipping + tariffs + fees) was folded into those items&apos; cost
        basis. Deleting a shipment moves its items back to Brazil and reverses
        the cost.
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Date</th>
              <th className="th">Reference</th>
              <th className="th">Items</th>
              <th className="th">Shipping</th>
              <th className="th">Tariffs</th>
              <th className="th">Fees</th>
              <th className="th">Landed total</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shipments.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={8}>
                  No shipments yet. Ship items from the In Brazil tab.
                </td>
              </tr>
            )}
            {shipments.map((s) => (
              <tr key={s.id}>
                <td className="td">{fmtDate(s.date)}</td>
                <td className="td">{s.reference || "—"}</td>
                <td className="td text-slate-600">
                  <div className="text-sm">
                    {s.items.reduce((a, x) => a + x.quantity, 0)} units ·{" "}
                    {s.items.length} {s.items.length === 1 ? "item" : "items"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {s.items.map((x) => x.itemName).slice(0, 4).join(", ")}
                    {s.items.length > 4 ? "…" : ""}
                  </div>
                </td>
                <td className="td">{money(s.shipping)}</td>
                <td className="td">{money(s.tariffs)}</td>
                <td className="td">{money(s.fees)}</td>
                <td className="td font-medium">
                  {money(s.shipping + s.tariffs + s.fees)}
                </td>
                <td className="td">
                  <form action={deleteShipment}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn-danger py-1 text-xs">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── History ─────────────────────────────────────────────────────────────────
async function HistoryTab() {
  const items = await prisma.inventoryItem.findMany({
    where: { status: { in: HISTORY_STATUSES } },
    orderBy: [{ brokenDownAt: "desc" }, { updatedAt: "desc" }],
    include: {
      sales: { include: { customer: true }, orderBy: { date: "desc" } },
      childItems: {
        select: { id: true, name: true, internalSku: true, quantity: true },
      },
    },
  });

  const soldItems = items.filter((i) => i.status === "SOLD");
  const brokenItems = items.filter((i) => i.status === "BROKEN_DOWN");
  const realizedProfit = soldItems.reduce(
    (s, i) => s + i.sales.reduce((a, x) => a + x.profit, 0),
    0
  );

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Sold items" value={soldItems.length.toString()} />
        <Stat label="Broken down" value={brokenItems.length.toString()} />
        <Stat label="Realized profit" value={money(realizedProfit)} />
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Items that have left active stock. Sold items show the sale details;
        broken-down items show the units they were opened into. Nothing here
        counts toward your on-hand inventory value.
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Card</th>
              <th className="th">Internal SKU</th>
              <th className="th">Outcome</th>
              <th className="th">Details</th>
              <th className="th">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={5}>
                  Nothing here yet. Sold and broken-down items will appear in
                  this history.
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
                  <div className="text-xs font-normal text-slate-400">
                    {[i.setName, i.year, i.cardNumber ? `#${i.cardNumber}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </td>
                <td className="td">
                  <span className="font-mono text-xs text-slate-600">
                    {i.internalSku || "—"}
                  </span>
                </td>
                <td className="td">
                  {i.status === "SOLD" ? (
                    <span className="badge bg-green-100 text-green-700">Sold</span>
                  ) : (
                    <span className="badge bg-amber-100 text-amber-700">
                      Broken down
                    </span>
                  )}
                </td>
                <td className="td text-slate-600">
                  {i.status === "SOLD" ? (
                    <SoldDetails sales={i.sales} />
                  ) : (
                    <BrokenDetails units={i.childItems} />
                  )}
                </td>
                <td className="td">
                  {i.status === "SOLD"
                    ? fmtDate(i.sales[0]?.date ?? i.updatedAt)
                    : fmtDate(i.brokenDownAt ?? i.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SoldDetails({
  sales,
}: {
  sales: {
    quantity: number;
    salePrice: number;
    profit: number;
    platform: string | null;
    customer: { name: string } | null;
  }[];
}) {
  if (sales.length === 0) {
    return <span className="text-slate-400">Marked sold (no sale record)</span>;
  }
  const qty = sales.reduce((s, x) => s + x.quantity, 0);
  const gross = sales.reduce((s, x) => s + x.salePrice, 0);
  const profit = sales.reduce((s, x) => s + x.profit, 0);
  const platforms = Array.from(
    new Set(sales.map((s) => s.platform).filter(Boolean))
  ).join(", ");
  const customers = Array.from(
    new Set(sales.map((s) => s.customer?.name).filter(Boolean))
  ).join(", ");

  return (
    <div className="text-sm">
      <div>
        <span className="font-medium">{money(gross)}</span> for {qty}{" "}
        {qty === 1 ? "unit" : "units"}
        {sales.length > 1 && (
          <span className="text-slate-400"> · {sales.length} sales</span>
        )}{" "}
        ·{" "}
        <span className={profit >= 0 ? "text-green-600" : "text-red-600"}>
          {money(profit)} profit
        </span>
      </div>
      {(platforms || customers) && (
        <div className="text-xs text-slate-400">
          {[platforms, customers].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
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
