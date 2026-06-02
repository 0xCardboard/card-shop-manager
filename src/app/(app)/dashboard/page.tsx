import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { fmtDate, money } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await requireSession();
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [salesYTD, expensesYTD, inventory, customers, upcomingLeads] =
    await Promise.all([
      prisma.sale.findMany({ where: { date: { gte: yearStart } } }),
      prisma.expense.findMany({ where: { date: { gte: yearStart } } }),
      prisma.inventoryItem.findMany(),
      prisma.customer.findMany({ include: { sales: true } }),
      prisma.lead.findMany({
        where: { stage: { notIn: ["WON", "LOST"] } },
        orderBy: { followUpDate: "asc" },
        include: { customer: true },
        take: 6,
      }),
    ]);

  const revenue = salesYTD.reduce((s, x) => s + x.salePrice, 0);
  const cogs = salesYTD.reduce((s, x) => s + x.costBasisAtSale, 0);
  const selling = salesYTD.reduce((s, x) => s + x.fees + x.shipping, 0);
  const opex = expensesYTD.reduce((s, x) => s + x.amount, 0);
  const grossProfit = revenue - cogs - selling;
  const netProfit = grossProfit - opex;
  const invValue = inventory.reduce(
    (s, i) => (i.status === "SOLD" ? s : s + i.quantity * i.costBasis),
    0
  );
  const invUnits = inventory.reduce(
    (s, i) => (i.status === "SOLD" ? s : s + i.quantity),
    0
  );

  // Monthly revenue for the current year
  const months = Array.from({ length: 12 }, () => 0);
  for (const s of salesYTD) {
    months[new Date(s.date).getMonth()] += s.salePrice;
  }
  const maxMonth = Math.max(1, ...months);
  const monthLabels = [
    "J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D",
  ];

  const topCustomers = customers
    .map((c) => ({
      name: c.name,
      spend: c.sales.reduce((s, x) => s + x.salePrice, 0),
    }))
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${session.user.name?.split(" ")[0] || ""}`}
        subtitle={`Year-to-date snapshot · ${now.getFullYear()}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Revenue (YTD)" value={money(revenue)} accent />
        <Kpi label="Gross profit" value={money(grossProfit)} />
        <Kpi label="Net profit" value={money(netProfit)} />
        <Kpi label="Inventory value" value={money(invValue)} sub={`${invUnits} units`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Monthly revenue
          </h2>
          <div className="flex h-44 items-end gap-2">
            {months.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-brand-500"
                  style={{ height: `${(v / maxMonth) * 100}%`, minHeight: v > 0 ? 4 : 0 }}
                  title={money(v)}
                />
                <span className="text-[10px] text-slate-400">
                  {monthLabels[i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Top customers
          </h2>
          {topCustomers.length === 0 ? (
            <p className="text-sm text-slate-400">No sales linked to customers yet.</p>
          ) : (
            <ul className="space-y-3">
              {topCustomers.map((c) => (
                <li key={c.name} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{c.name}</span>
                  <span className="text-slate-500">{money(c.spend)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Follow-ups & open deals
          </h2>
          <Link href="/leads" className="text-sm text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        {upcomingLeads.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No open leads.</p>
        ) : (
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              {upcomingLeads.map((l) => {
                const overdue =
                  l.followUpDate && new Date(l.followUpDate) < new Date();
                return (
                  <tr key={l.id}>
                    <td className="td font-medium">{l.title}</td>
                    <td className="td text-slate-500">
                      {l.customer?.name || l.contactName || "—"}
                    </td>
                    <td className="td">{money(l.value)}</td>
                    <td className={`td ${overdue ? "font-semibold text-red-600" : "text-slate-500"}`}>
                      {l.followUpDate ? fmtDate(l.followUpDate) : "no date"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card p-4 ${accent ? "ring-1 ring-brand-200" : ""}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
