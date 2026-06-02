import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { fmtDate, money, toDateInput } from "@/lib/utils";
import { createExpense, deleteExpense } from "./actions";

const CATEGORIES = [
  "Supplies",
  "Shipping",
  "Tariffs & Duties",
  "Grading fees",
  "Marketplace fees",
  "Software",
  "Travel",
  "Inventory (COGS)",
  "Salaries & Wages",
  "Commissions",
  "Other",
];

export default async function ExpensesPage() {
  await requireSession();
  const expenses = await prisma.expense.findMany({
    orderBy: { date: "desc" },
    take: 300,
  });
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const byCat = new Map<string, number>();
  for (const e of expenses) {
    byCat.set(e.category, (byCat.get(e.category) || 0) + e.amount);
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Track deductible business expenses by category."
      >
        <a href="/api/export/expenses" className="btn-secondary">
          Export CSV
        </a>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Expenses logged" value={expenses.length.toString()} />
        <Stat label="Total (shown)" value={money(total)} />
        <Stat label="Categories used" value={byCat.size.toString()} />
      </div>

      <details className="card mb-6 p-5" open>
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          + Add an expense
        </summary>
        <form
          action={createExpense}
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <div>
            <label className="label">Date</label>
            <input name="date" type="date" defaultValue={toDateInput(new Date())} className="input" />
          </div>
          <div>
            <label className="label">Category</label>
            <select name="category" className="input">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount</label>
            <input name="amount" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label">Vendor</label>
            <input name="vendor" className="input" />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <label className="label">Notes</label>
            <input name="notes" className="input" />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <button className="btn-primary" type="submit">
              Add expense
            </button>
          </div>
        </form>
      </details>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Date</th>
              <th className="th">Category</th>
              <th className="th">Vendor</th>
              <th className="th">Notes</th>
              <th className="th">Amount</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={6}>
                  No expenses logged yet.
                </td>
              </tr>
            )}
            {expenses.map((e) => (
              <tr key={e.id}>
                <td className="td">{fmtDate(e.date)}</td>
                <td className="td">
                  <span className="badge bg-slate-100 text-slate-600">
                    {e.category}
                  </span>
                </td>
                <td className="td">{e.vendor || "—"}</td>
                <td className="td text-slate-500">{e.notes || "—"}</td>
                <td className="td font-medium">{money(e.amount)}</td>
                <td className="td">
                  <form action={deleteExpense}>
                    <input type="hidden" name="id" value={e.id} />
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
