import PageHeader from "@/components/PageHeader";
import SubmitOnChange from "@/components/SubmitOnChange";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { fmtDate, money, toDateInput } from "@/lib/utils";
import { createLead, deleteLead, updateStage } from "./actions";

const STAGES = [
  { value: "PROSPECT", label: "Prospect" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "NEGOTIATING", label: "Negotiating" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

const STAGE_COLOR: Record<string, string> = {
  PROSPECT: "bg-slate-100 text-slate-600",
  CONTACTED: "bg-blue-100 text-blue-700",
  NEGOTIATING: "bg-amber-100 text-amber-700",
  WON: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-600",
};

export default async function LeadsPage() {
  await requireSession();
  const [leads, customers] = await Promise.all([
    prisma.lead.findMany({
      orderBy: [{ followUpDate: "asc" }, { createdAt: "desc" }],
      include: { customer: true },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);

  const openValue = leads
    .filter((l) => l.stage !== "WON" && l.stage !== "LOST")
    .reduce((s, l) => s + l.value, 0);
  const wonValue = leads
    .filter((l) => l.stage === "WON")
    .reduce((s, l) => s + l.value, 0);

  return (
    <div>
      <PageHeader
        title="Leads & deals"
        subtitle="Track prospects, what they want, and follow-ups."
      >
        <a href="/api/export/leads" className="btn-secondary">
          Export CSV
        </a>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Open deals" value={leads.filter((l) => l.stage !== "WON" && l.stage !== "LOST").length.toString()} />
        <Stat label="Open pipeline value" value={money(openValue)} />
        <Stat label="Won value" value={money(wonValue)} />
      </div>

      <details className="card mb-6 p-5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          + Add a lead
        </summary>
        <form
          action={createLead}
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <div className="col-span-2">
            <label className="label">Title</label>
            <input name="title" required className="input" placeholder="Wants 1999 holo Charizard" />
          </div>
          <div>
            <label className="label">Stage</label>
            <select name="stage" className="input" defaultValue="PROSPECT">
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Est. value</label>
            <input name="value" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label">Contact name</label>
            <input name="contactName" className="input" />
          </div>
          <div>
            <label className="label">Contact info</label>
            <input name="contactInfo" className="input" placeholder="email / phone" />
          </div>
          <div className="col-span-2">
            <label className="label">Existing customer (optional)</label>
            <select name="customerId" className="input">
              <option value="">— none —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Follow-up date</label>
            <input name="followUpDate" type="date" className="input" />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <label className="label">Interested in</label>
            <input name="interestedIn" className="input" />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <label className="label">Notes</label>
            <input name="notes" className="input" />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <button className="btn-primary" type="submit">
              Add lead
            </button>
          </div>
        </form>
      </details>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[780px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Deal</th>
              <th className="th">Contact</th>
              <th className="th">Interested in</th>
              <th className="th">Value</th>
              <th className="th">Follow-up</th>
              <th className="th">Stage</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={7}>
                  No leads yet.
                </td>
              </tr>
            )}
            {leads.map((l) => {
              const overdue =
                l.followUpDate &&
                l.stage !== "WON" &&
                l.stage !== "LOST" &&
                new Date(l.followUpDate) < new Date();
              return (
                <tr key={l.id}>
                  <td className="td font-medium">
                    {l.title}
                    <span
                      className={`badge ml-2 ${STAGE_COLOR[l.stage]}`}
                    >
                      {l.stage}
                    </span>
                  </td>
                  <td className="td text-slate-500">
                    {l.customer?.name ||
                      [l.contactName, l.contactInfo]
                        .filter(Boolean)
                        .join(" · ") ||
                      "—"}
                  </td>
                  <td className="td text-slate-500">{l.interestedIn || "—"}</td>
                  <td className="td">{money(l.value)}</td>
                  <td className={`td ${overdue ? "font-semibold text-red-600" : ""}`}>
                    {fmtDate(l.followUpDate)}
                    {overdue ? " ⚠" : ""}
                  </td>
                  <td className="td">
                    <form action={updateStage}>
                      <input type="hidden" name="id" value={l.id} />
                      <SubmitOnChange name="stage" value={l.stage} options={STAGES} />
                    </form>
                  </td>
                  <td className="td">
                    <form action={deleteLead}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="btn-danger py-1 text-xs">Delete</button>
                    </form>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
