import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SubmitOnChange from "@/components/SubmitOnChange";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { fmtDate, money } from "@/lib/utils";
import { deleteItem, updateStatus } from "./actions";

const STATUS_OPTS = [
  { value: "IN_STOCK", label: "In stock" },
  { value: "LISTED", label: "Listed" },
  { value: "RESERVED", label: "Reserved" },
  { value: "SOLD", label: "Sold" },
];

export default async function InventoryPage() {
  await requireSession();
  const items = await prisma.inventoryItem.findMany({
    orderBy: { createdAt: "desc" },
  });

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = items.reduce((s, i) => s + i.quantity * i.costBasis, 0);
  const lowStock = items.filter(
    (i) => i.status !== "SOLD" && i.quantity <= 1
  ).length;

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
        . Items can&apos;t be added here directly.
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Card</th>
              <th className="th">Details</th>
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
                <td className="td text-slate-400" colSpan={8}>
                  No items yet. Log a purchase to add inventory.
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
