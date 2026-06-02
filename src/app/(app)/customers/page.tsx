import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { money } from "@/lib/utils";
import { createCustomer, deleteCustomer } from "./actions";

export default async function CustomersPage() {
  await requireSession();
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: { sales: true },
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Your CRM — contacts, tags, and lifetime spend from linked sales."
      >
        <a href="/api/export/customers" className="btn-secondary">
          Export CSV
        </a>
      </PageHeader>

      <details className="card mb-6 p-5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          + Add a customer
        </summary>
        <form
          action={createCustomer}
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" />
          </div>
          <div>
            <label className="label">Type</label>
            <select name="type" className="input" defaultValue="Collector">
              <option>Collector</option>
              <option>Reseller</option>
              <option>Wholesale</option>
              <option>VIP</option>
            </select>
          </div>
          <div>
            <label className="label">Tags (comma-separated)</label>
            <input name="tags" className="input" placeholder="vintage, high-value" />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <label className="label">Notes</label>
            <input name="notes" className="input" />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <button className="btn-primary" type="submit">
              Add customer
            </button>
          </div>
        </form>
      </details>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Name</th>
              <th className="th">Contact</th>
              <th className="th">Type</th>
              <th className="th">Tags</th>
              <th className="th">Orders</th>
              <th className="th">Lifetime spend</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={7}>
                  No customers yet.
                </td>
              </tr>
            )}
            {customers.map((c) => {
              const spend = c.sales.reduce((s, x) => s + x.salePrice, 0);
              return (
                <tr key={c.id}>
                  <td className="td font-medium">{c.name}</td>
                  <td className="td text-slate-500">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="td">
                    {c.type && (
                      <span className="badge bg-slate-100 text-slate-600">
                        {c.type}
                      </span>
                    )}
                  </td>
                  <td className="td text-slate-500">{c.tags || "—"}</td>
                  <td className="td">{c.sales.length}</td>
                  <td className="td font-medium">{money(spend)}</td>
                  <td className="td">
                    <div className="flex gap-2">
                      <Link
                        href={`/customers/${c.id}`}
                        className="btn-secondary py-1 text-xs"
                      >
                        View
                      </Link>
                      <form action={deleteCustomer}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn-danger py-1 text-xs">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
