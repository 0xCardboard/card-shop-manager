// California + Federal income tax ESTIMATOR for a sole proprietor / single-member LLC.
// Figures below are 2025 tax-year values. This is a planning estimate only and is
// NOT tax advice. Consult a CPA before filing.

export type FilingStatus = "single" | "mfj" | "hoh";

type Bracket = { upTo: number; rate: number }; // upTo = top of bracket (Infinity for last)

// ---------- 2025 FEDERAL ----------
const FED_BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: [
    { upTo: 11925, rate: 0.1 },
    { upTo: 48475, rate: 0.12 },
    { upTo: 103350, rate: 0.22 },
    { upTo: 197300, rate: 0.24 },
    { upTo: 250525, rate: 0.32 },
    { upTo: 626350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  mfj: [
    { upTo: 23850, rate: 0.1 },
    { upTo: 96950, rate: 0.12 },
    { upTo: 206700, rate: 0.22 },
    { upTo: 394600, rate: 0.24 },
    { upTo: 501050, rate: 0.32 },
    { upTo: 751600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  hoh: [
    { upTo: 17000, rate: 0.1 },
    { upTo: 64850, rate: 0.12 },
    { upTo: 103350, rate: 0.22 },
    { upTo: 197300, rate: 0.24 },
    { upTo: 250500, rate: 0.32 },
    { upTo: 626350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
};

const FED_STD_DEDUCTION: Record<FilingStatus, number> = {
  single: 15000,
  mfj: 30000,
  hoh: 22500,
};

// ---------- 2025 CALIFORNIA ----------
const CA_BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: [
    { upTo: 10756, rate: 0.01 },
    { upTo: 25499, rate: 0.02 },
    { upTo: 40245, rate: 0.04 },
    { upTo: 55866, rate: 0.06 },
    { upTo: 70606, rate: 0.08 },
    { upTo: 360659, rate: 0.093 },
    { upTo: 432787, rate: 0.103 },
    { upTo: 721314, rate: 0.113 },
    { upTo: Infinity, rate: 0.123 },
  ],
  mfj: [
    { upTo: 21512, rate: 0.01 },
    { upTo: 50998, rate: 0.02 },
    { upTo: 80490, rate: 0.04 },
    { upTo: 111732, rate: 0.06 },
    { upTo: 141212, rate: 0.08 },
    { upTo: 721318, rate: 0.093 },
    { upTo: 865574, rate: 0.103 },
    { upTo: 1442628, rate: 0.113 },
    { upTo: Infinity, rate: 0.123 },
  ],
  hoh: [
    { upTo: 21527, rate: 0.01 },
    { upTo: 51000, rate: 0.02 },
    { upTo: 65744, rate: 0.04 },
    { upTo: 81364, rate: 0.06 },
    { upTo: 96107, rate: 0.08 },
    { upTo: 490493, rate: 0.093 },
    { upTo: 588593, rate: 0.103 },
    { upTo: 980987, rate: 0.113 },
    { upTo: Infinity, rate: 0.123 },
  ],
};

const CA_STD_DEDUCTION: Record<FilingStatus, number> = {
  single: 5540,
  mfj: 11080,
  hoh: 11080,
};

// ---------- Self-employment tax (2025) ----------
const SE_SS_RATE = 0.124; // Social Security
const SE_MEDICARE_RATE = 0.029; // Medicare
const SE_SS_WAGE_BASE = 176100; // 2025 Social Security wage base
const SE_NET_FACTOR = 0.9235; // net earnings subject to SE tax

function taxFromBrackets(taxable: number, brackets: Bracket[]): number {
  if (taxable <= 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    const slice = Math.min(taxable, b.upTo) - lower;
    if (slice > 0) tax += slice * b.rate;
    lower = b.upTo;
    if (taxable <= b.upTo) break;
  }
  return tax;
}

export interface TaxInput {
  netProfit: number; // business net profit (revenue - COGS - expenses)
  filingStatus: FilingStatus;
  otherHouseholdIncome?: number; // wages/other income to layer brackets on (optional)
  applyQBI?: boolean; // 20% Qualified Business Income deduction (federal only)
}

export interface TaxResult {
  netProfit: number;
  seTax: number;
  halfSeDeduction: number;
  qbiDeduction: number;
  federalTaxableIncome: number;
  federalIncomeTax: number;
  caTaxableIncome: number;
  caIncomeTax: number;
  totalEstimatedTax: number;
  effectiveRate: number; // total tax / netProfit
  setAsidePerSale: number; // suggested % to set aside
}

export function estimateTaxes(input: TaxInput): TaxResult {
  const netProfit = Math.max(0, input.netProfit);
  const other = Math.max(0, input.otherHouseholdIncome || 0);

  // Self-employment tax
  const seBase = netProfit * SE_NET_FACTOR;
  const ssTax = Math.min(seBase, SE_SS_WAGE_BASE) * SE_SS_RATE;
  const medicareTax = seBase * SE_MEDICARE_RATE;
  const seTax = netProfit > 0 ? ssTax + medicareTax : 0;
  const halfSeDeduction = seTax / 2;

  // QBI deduction (simplified 20% of business income; ignores wage/threshold limits)
  const qbiDeduction = input.applyQBI
    ? 0.2 * Math.max(0, netProfit - halfSeDeduction)
    : 0;

  // Federal
  const fedAGI = netProfit + other - halfSeDeduction;
  const federalTaxableIncome = Math.max(
    0,
    fedAGI - FED_STD_DEDUCTION[input.filingStatus] - qbiDeduction
  );
  const federalIncomeTax = taxFromBrackets(
    federalTaxableIncome,
    FED_BRACKETS[input.filingStatus]
  );

  // California (no QBI, but conforms to 1/2 SE-tax adjustment)
  const caAGI = netProfit + other - halfSeDeduction;
  const caTaxableIncome = Math.max(
    0,
    caAGI - CA_STD_DEDUCTION[input.filingStatus]
  );
  const caIncomeTax = taxFromBrackets(
    caTaxableIncome,
    CA_BRACKETS[input.filingStatus]
  );

  // Total business-attributable tax: full SE tax + the marginal income tax on the
  // business portion. For simplicity we attribute all income tax shown here; when
  // other income is supplied, treat that income tax as the incremental amount.
  const totalEstimatedTax = seTax + federalIncomeTax + caIncomeTax;
  const effectiveRate = netProfit > 0 ? totalEstimatedTax / netProfit : 0;

  return {
    netProfit,
    seTax,
    halfSeDeduction,
    qbiDeduction,
    federalTaxableIncome,
    federalIncomeTax,
    caTaxableIncome,
    caIncomeTax,
    totalEstimatedTax,
    effectiveRate,
    setAsidePerSale: Math.round(effectiveRate * 1000) / 10, // percent, 1 decimal
  };
}

export const TAX_YEAR = 2025;
