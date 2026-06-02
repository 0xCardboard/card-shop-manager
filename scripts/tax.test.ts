import { estimateTaxes } from "../src/lib/tax";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}
function approx(a: number, b: number, tol = 1) {
  return Math.abs(a - b) <= tol;
}

console.log("Tax estimator sanity checks (2025 figures)\n");

// 1) Zero profit -> zero tax everywhere.
const zero = estimateTaxes({ netProfit: 0, filingStatus: "single" });
check("zero profit => zero total tax", zero.totalEstimatedTax === 0);

// 2) SE tax on $50k profit, single. seBase = 50000*0.9235 = 46175.
// SS 12.4% + Medicare 2.9% = 15.3% of 46175 = 7064.78
const p50 = estimateTaxes({ netProfit: 50000, filingStatus: "single" });
check(
  "SE tax on $50k ≈ $7,064.78",
  approx(p50.seTax, 7064.78, 0.5),
  `got ${p50.seTax.toFixed(2)}`
);
// half SE deduction
check("half-SE deduction = seTax/2", approx(p50.halfSeDeduction, p50.seTax / 2, 0.01));

// 3) Federal taxable for $50k single:
// AGI = 50000 - 3532.39 = 46467.61; minus std 15000 = 31467.61 taxable
// fed tax: 10% of 11925 = 1192.50; 12% of (31467.61-11925)=19542.61 => 2345.11; total ≈ 3537.62
check(
  "federal taxable income ≈ $31,468",
  approx(p50.federalTaxableIncome, 31467.61, 2),
  `got ${p50.federalTaxableIncome.toFixed(2)}`
);
check(
  "federal income tax ≈ $3,537.61",
  approx(p50.federalIncomeTax, 3537.61, 2),
  `got ${p50.federalIncomeTax.toFixed(2)}`
);

// 4) CA taxable for $50k single: AGI 46467.61 - CA std 5540 = 40927.61
// CA: 1% to 10756 =107.56; 2% (25499-10756=14743)=294.86; 4%(40245-25499=14746)=589.84;
// 6% of (40927.61-40245=682.61)=40.96 => total ≈ 1033.22
check(
  "CA income tax ≈ $1,033.22",
  approx(p50.caIncomeTax, 1033.22, 2),
  `got ${p50.caIncomeTax.toFixed(2)}`
);

// 5) Monotonic: more profit => more total tax
const p100 = estimateTaxes({ netProfit: 100000, filingStatus: "single" });
check("higher profit => higher total tax", p100.totalEstimatedTax > p50.totalEstimatedTax);

// 6) QBI reduces federal tax
const p100qbi = estimateTaxes({ netProfit: 100000, filingStatus: "single", applyQBI: true });
check("QBI lowers federal tax", p100qbi.federalIncomeTax < p100.federalIncomeTax);

// 7) SS cap: very high profit caps SS portion
const big = estimateTaxes({ netProfit: 500000, filingStatus: "single" });
// SS portion capped at 176100*0.124 = 21836.40; medicare = 500000*0.9235*0.029=13390.75
// seTax ≈ 35227.15
check(
  "SE tax respects SS wage base cap at high income",
  approx(big.seTax, 35227.15, 1),
  `got ${big.seTax.toFixed(2)}`
);

// 8) effective rate between 0 and 1
check("effective rate in (0,1)", p50.effectiveRate > 0 && p50.effectiveRate < 1);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
