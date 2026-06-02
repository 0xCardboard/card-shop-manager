import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { fmtDate, money } from "@/lib/utils";
import { updateCustomer } from "../actions";

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireSession();
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      sales: {
        orderBy: { date: "desc" },
        include: { inventoryItem: true },
      },
      leads: { orderBy: { updatedAt: "desc" } },
    },
  });
  if (!customer) notFound();

  const spend = customer.sales.reduce((s, x) => s + x.salePrice, 0);

  return (
    <div>
      <PageHeader title={customer.name} subtitle="Customer profile & history">
        <Link href="/customers" className="btn-secondary">
          Back
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">
              Edit details
            </h2>
            <form action={updateCustomer} className="space-y-3">
              <input type="hidden" name="id" value={customer.id} />
              <Field label="Name" name="name" defaultValue={customer.name} />
              <Field label="Email" name="email" defaultValue={customer.email} />
              <Field label="Phone" name="phone" defaultValue={customer.phone} />
              <div>
                <label className="label">Type</label>
                <select
                  name="type"
                  className="input"
                  defaultValue={customer.type ?? "Collector"}
                >
                  <option>Collector</option>
                  <option>Reseller</option>
                  <option>Wholesale</option>
                  <option>VIP</option>
                </select>
              </div>
              <Field label="Tags" name="tags" defaultValue={customer.tags} />
              <div>
                <label className="label">Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  className="input"
                  defaultValue={customer.notes ?? ""}
                />
              </div>
              <button className="btn-primary w-full" type="submit">
                Save
              </button>
            </form>
          </div>

          <div className="card mt-4 p-5">
            <div className="text-xs text-slate-500">Lifetime spend</div>
            <div className="mt-1 text-2xl font-semibold">{money(spend)}</div>
            <div className="mt-2 text-sm text-slate-500">
              {customer.sales.length} order
              {customer.sales.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">
              Purchase history
            </div>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Item</th>
                  <th className="th">Qty</th>
                  <th className="th">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customer.sales.length === 0 && (
                  <tr>
                    <td className="td text-slate-400" colSpan={4}>
                      No purchases linked to this customer yet. Link them when
                      recording a sale.
                    </td>
                  </tr>
                )}
                {customer.sales.map((s) => (
                  <tr key={s.id}>
                    <td className="td">{fmtDate(s.date)}</td>
                    <td className="td font-medium">
                      {s.inventoryItem?.name || "Misc sale"}
                    </td>
                    <td className="td">{s.quantity}</td>
                    <td className="td">{money(s.salePrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {customer.leads.length > 0 && (
            <div className="card mt-4 overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">
                Linked deals
              </div>
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Deal</th>
                    <th className="th">Stage</th>
                    <th className="th">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.leads.map((l) => (
                    <tr key={l.id}>
                      <td className="td font-medium">{l.title}</td>
                      <td className="td">{l.stage}</td>
                      <td className="td">{money(l.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} className="input" defaultValue={defaultValue ?? ""} />
    </div>
  );
}
