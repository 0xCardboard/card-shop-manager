import Link from "next/link";
import { ItemStatus } from "@prisma/client";
import PageHeader from "@/components/PageHeader";
import SubmitOnChange from "@/components/SubmitOnChange";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { fmtDate, money } from "@/lib/utils";
import { deleteItem, updateStatus } from "./actions";

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

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  await requireSession();
  const tab = searchParams?.tab === "history" ? "history" : "active";

  const [activeCount, historyCount] = await Promise.all([
    prisma.inventoryItem.count({
      where: { status: { in: ACTIVE_STATUSES } },
    }),
    prisma.inventoryItem.count({
      where: { status: { in: HISTORY_STATUSES } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Every card, single or graded, with cost basis and stock status."
      >
        <a href="/api/export/inventory" className="btn-secondary">
          Export CSV
        </a>
      </PageHeader>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <Tab href="/inventory" active={tab === "active"}>
          In stock <Count n={activeCount} />
        </Tab>
        <Tab href="/inventory?tab=history" active={tab === "history"}>
          History <Count n={historyCount} />
        </Tab>
      </div>

      {tab === "history" ? <HistoryTab /> : <ActiveTab />}
    </div>
  );
}

async function ActiveTab() {
  const items = await prisma.inventoryItem.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
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
        Inventory is created automatically when you{" "}
        <a href="/purchases" className="font-medium text-brand-700">
          log a purchase
        </a>
        , break an item down, or receive items in a{" "}
        <a href="/trades" className="font-medium text-brand-700">
          trade
        </a>
        . Sold and broken-down items move to the{" "}
        <Link href="/inventory?tab=history" className="font-medium text-brand-700">
          History
        </Link>{" "}
        tab.
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
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
                  No items in stock. Log a purchase to add inventory.
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

function Tab({
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
