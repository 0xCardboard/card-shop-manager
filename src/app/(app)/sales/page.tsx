import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { fmtDate, money, toDateInput } from "@/lib/utils";
import { createSale, deleteSale } from "./actions";

export default async function SalesPage() {
  await requireSession();
  const [sales, items, customers] = await Promise.all([
    prisma.sale.findMany({
      orderBy: { date: "desc" },
      include: { inventoryItem: true, customer: true },
      take: 200,
    }),
    prisma.inventoryItem.findMany({
      where: { quantity: { gt: 0 } },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);

  const revenue = sales.reduce((s, x) => s + x.salePrice, 0);
  const profit = sales.reduce((s, x) => s + x.profit, 0);

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle="Record sales. Stock and profit (revenue − fees − shipping − cost) update automatically."
      >
        <a href="/api/export/sales" className="btn-secondary">
          Export CSV
        </a>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Sales (shown)" value={sales.length.toString()} />
        <Stat label="Gross revenue" value={money(revenue)} />
        <Stat label="Net profit" value={money(profit)} />
      </div>

      <details className="card mb-6 p-5" open>
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          + Record a sale
        </summary>
        <form
          action={createSale}
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <div>
            <label className="label">Date</label>
            <input name="date" type="date" defaultValue={toDateInput(new Date())} className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Item sold</label>
            <select name="inventoryItemId" className="input">
              <option value="">— not from inventory —</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.quantity} left · cost {money(i.costBasis)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input name="quantity" type="number" defaultValue="1" className="input" />
          </div>
          <div>
            <label className="label">Sale price (total)</label>
            <input name="salePrice" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label">Fees</label>
            <input name="fees" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label">Shipping cost</label>
            <input name="shipping" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label">Platform</label>
            <input name="platform" className="input" placeholder="eBay, Whatnot…" />
          </div>
          <div className="col-span-2">
            <label className="label">Customer (optional)</label>
            <select name="customerId" className="input">
              <option value="">— none —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <label className="label">Notes</label>
            <input name="notes" className="input" />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <button className="btn-primary" type="submit">
              Record sale
            </button>
          </div>
        </form>
      </details>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Date</th>
              <th className="th">Item</th>
              <th className="th">Customer</th>
              <th className="th">Qty</th>
              <th className="th">Price</th>
              <th className="th">Fees</th>
              <th className="th">Cost</th>
              <th className="th">Profit</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={9}>
                  No sales recorded yet.
                </td>
              </tr>
            )}
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="td">{fmtDate(s.date)}</td>
                <td className="td font-medium">
                  {s.inventoryItem?.name || "Misc sale"}
                  {s.platform && (
                    <span className="badge ml-2 bg-slate-100 text-slate-600">
                      {s.platform}
                    </span>
                  )}
                </td>
                <td className="td">{s.customer?.name || "—"}</td>
                <td className="td">{s.quantity}</td>
                <td className="td">{money(s.salePrice)}</td>
                <td className="td">{money(s.fees + s.shipping)}</td>
                <td className="td">{money(s.costBasisAtSale)}</td>
                <td
                  className={`td font-semibold ${
                    s.profit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {money(s.profit)}
                </td>
                <td className="td">
                  <form action={deleteSale}>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
