import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { money, pct } from "@/lib/utils";
import { estimateTaxes, FilingStatus, TAX_YEAR } from "@/lib/tax";

type SP = { [key: string]: string | string[] | undefined };

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : v ?? "";
}

export default async function TaxesPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await requireSession();

  const now = new Date();
  const yearParam = one(searchParams.year) || now.getFullYear().toString();
  const allTime = yearParam === "all";
  const filingStatus = (one(searchParams.filing) || "single") as FilingStatus;
  const otherIncome = parseFloat(one(searchParams.other)) || 0;
  const applyQBI = one(searchParams.qbi) === "on";

  // Date window
  let dateFilter = {};
  if (!allTime) {
    const y = parseInt(yearParam, 10);
    dateFilter = {
      date: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) },
    };
  }

  const [sales, expenses, trades] = await Promise.all([
    prisma.sale.findMany({ where: dateFilter }),
    prisma.expense.findMany({ where: dateFilter }),
    prisma.trade.findMany({ where: dateFilter }),
  ]);

  const grossRevenue = sales.reduce((s, x) => s + x.salePrice, 0);
  const cogs = sales.reduce((s, x) => s + x.costBasisAtSale, 0);
  const sellingCosts = sales.reduce((s, x) => s + x.fees + x.shipping, 0);
  const operatingExpenses = expenses.reduce((s, x) => s + x.amount, 0);
  const tradeGains = trades.reduce((s, x) => s + x.realizedGain, 0);
  const netProfit =
    grossRevenue - cogs - sellingCosts + tradeGains - operatingExpenses;

  const r = estimateTaxes({
    netProfit,
    filingStatus,
    otherHouseholdIncome: otherIncome,
    applyQBI,
  });

  const years: string[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
    years.push(y.toString());
  }

  return (
    <div>
      <PageHeader
        title="Tax estimate (California)"
        subtitle={`Planning estimate using ${TAX_YEAR} federal + CA figures.`}
      />

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Estimate only — not tax advice.</strong> This applies{" "}
        {TAX_YEAR} federal income tax, self-employment tax (15.3%), and
        California state income tax to your business net profit, assuming a sole
        proprietor / single-member LLC (Schedule C). Confirm with a CPA before
        filing or making estimated payments.
      </div>

      <form
        method="get"
        className="card mb-6 grid grid-cols-2 gap-3 p-5 sm:grid-cols-4"
      >
        <div>
          <label className="label">Tax year</label>
          <select name="year" className="input" defaultValue={yearParam}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
            <option value="all">All-time</option>
          </select>
        </div>
        <div>
          <label className="label">Filing status</label>
          <select name="filing" className="input" defaultValue={filingStatus}>
            <option value="single">Single</option>
            <option value="mfj">Married filing jointly</option>
            <option value="hoh">Head of household</option>
          </select>
        </div>
        <div>
          <label className="label">Other household income</label>
          <input
            name="other"
            type="number"
            step="100"
            defaultValue={otherIncome || ""}
            placeholder="W-2 wages, etc."
            className="input"
          />
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 py-2 text-sm">
            <input type="checkbox" name="qbi" defaultChecked={applyQBI} />
            Apply 20% QBI
          </label>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <button className="btn-primary" type="submit">
            Recalculate
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Profit &amp; loss {allTime ? "(all-time)" : `(${yearParam})`}
          </h2>
          <Row label="Gross revenue" value={money(grossRevenue)} />
          <Row label="− Cost of goods sold" value={money(-cogs)} />
          <Row label="− Selling costs (fees + shipping)" value={money(-sellingCosts)} />
          {tradeGains > 0 && (
            <Row label="+ Trade gains (cash over basis)" value={money(tradeGains)} />
          )}
          <Row label="− Operating expenses" value={money(-operatingExpenses)} />
          <div className="my-2 border-t border-slate-200" />
          <Row label="Business net profit" value={money(netProfit)} bold />
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Estimated taxes
          </h2>
          <Row label="Self-employment tax (15.3%)" value={money(r.seTax)} />
          <Row
            label="½ SE-tax deduction"
            value={money(-r.halfSeDeduction)}
            muted
          />
          {applyQBI && (
            <Row label="QBI deduction (federal)" value={money(-r.qbiDeduction)} muted />
          )}
          <Row label="Federal income tax" value={money(r.federalIncomeTax)} />
          <Row label="California income tax" value={money(r.caIncomeTax)} />
          <div className="my-2 border-t border-slate-200" />
          <Row label="Total estimated tax" value={money(r.totalEstimatedTax)} bold />
          <Row
            label="Effective rate on profit"
            value={pct(r.effectiveRate)}
            muted
          />
        </div>
      </div>

      <div className="card mt-6 flex flex-col items-start gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-slate-500">
            Suggested set-aside from each sale&apos;s profit
          </div>
          <div className="text-3xl font-semibold text-brand-700">
            {r.setAsidePerSale}%
          </div>
        </div>
        <div className="max-w-md text-sm text-slate-500">
          Park roughly this share of every profitable sale in a separate account
          so quarterly estimated taxes don&apos;t surprise you. California and
          the IRS both expect quarterly payments from the self-employed.
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 text-sm ${
        bold ? "font-semibold text-slate-900" : ""
      } ${muted ? "text-slate-400" : "text-slate-700"}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
