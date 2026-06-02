import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { fmtDate, money, toDateInput } from "@/lib/utils";
import { createPurchase, deletePurchase } from "./actions";

export default async function PurchasesPage() {
  await requireSession();
  const [purchases, items] = await Promise.all([
    prisma.purchase.findMany({
      orderBy: { date: "desc" },
      include: { inventoryItem: true },
      take: 200,
    }),
    prisma.inventoryItem.findMany({ orderBy: { name: "asc" } }),
  ]);

  const total = purchases.reduce((s, p) => s + p.total, 0);

  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle="Log what you buy. Linked items update inventory and cost basis automatically."
      >
        <a href="/api/export/purchases" className="btn-secondary">
          Export CSV
        </a>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Purchases logged" value={purchases.length.toString()} />
        <Stat label="Total spent (shown)" value={money(total)} />
      </div>

      <details className="card mb-6 p-5" open>
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          + Log a purchase
        </summary>
        <form
          action={createPurchase}
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <div>
            <label className="label">Date</label>
            <input
              name="date"
              type="date"
              defaultValue={toDateInput(new Date())}
              className="input"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Item name</label>
            <input name="itemName" required className="input" />
          </div>
          <div>
            <label className="label">Source</label>
            <input name="source" className="input" placeholder="eBay, show…" />
          </div>
          <div>
            <label className="label">Quantity</label>
            <input name="quantity" type="number" defaultValue="1" className="input" />
          </div>
          <div>
            <label className="label">Cost / unit</label>
            <input name="unitCost" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label">Fees</label>
            <input name="fees" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label">Shipping</label>
            <input name="shipping" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Link to existing inventory item (optional)</label>
            <select name="inventoryItemId" className="input">
              <option value="">— none —</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.quantity} in stock)
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 flex items-end">
            <label className="flex items-center gap-2 py-2 text-sm">
              <input type="checkbox" name="addToInventory" defaultChecked />
              If not linked, create a new inventory item
            </label>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <label className="label">Notes</label>
            <input name="notes" className="input" />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <button className="btn-primary" type="submit">
              Log purchase
            </button>
          </div>
        </form>
      </details>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Date</th>
              <th className="th">Item</th>
              <th className="th">Source</th>
              <th className="th">Qty</th>
              <th className="th">Unit</th>
              <th className="th">Fees</th>
              <th className="th">Ship</th>
              <th className="th">Total</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={9}>
                  No purchases logged yet.
                </td>
              </tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id}>
                <td className="td">{fmtDate(p.date)}</td>
                <td className="td font-medium">
                  {p.itemName}
                  {p.inventoryItem && (
                    <span className="badge ml-2 bg-brand-50 text-brand-700">
                      linked
                    </span>
                  )}
                </td>
                <td className="td">{p.source || "—"}</td>
                <td className="td">{p.quantity}</td>
                <td className="td">{money(p.unitCost)}</td>
                <td className="td">{money(p.fees)}</td>
                <td className="td">{money(p.shipping)}</td>
                <td className="td font-medium">{money(p.total)}</td>
                <td className="td">
                  <form action={deletePurchase}>
                    <input type="hidden" name="id" value={p.id} />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
