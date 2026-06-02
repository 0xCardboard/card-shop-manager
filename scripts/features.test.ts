import { csvEscape, toCsv } from "../src/lib/csv";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : " — " + (detail ?? "")}`);
  if (!cond) failures++;
}

console.log("CSV writer\n");
check("plain value unchanged", csvEscape("hello") === "hello");
check("comma gets quoted", csvEscape("a,b") === '"a,b"');
check("quote is doubled + wrapped", csvEscape('he said "hi"') === '"he said ""hi"""');
check("newline gets quoted", csvEscape("line1\nline2") === '"line1\nline2"');
check("null => empty", csvEscape(null) === "");
const csv = toCsv(["A", "B"], [["1", "x,y"], ["2", "z"]]);
check(
  "row assembled with CRLF + quoting",
  csv.endsWith('A,B\r\n1,"x,y"\r\n2,z'),
  JSON.stringify(csv)
);

console.log("\nBreak-down cost conservation\n");
// Simulate: case cost $1000, open 1 case into 10 boxes.
function breakdown(parentCost: number, parentQty: number, childQty: number) {
  const totalCost = parentQty * parentCost;
  const childUnitCost = totalCost / childQty;
  return { totalCost, childUnitCost };
}
const b1 = breakdown(1000, 1, 10);
check("1 case ($1000) -> 10 boxes @ $100", b1.childUnitCost === 100);
check(
  "total value conserved (10 * 100 == 1000)",
  10 * b1.childUnitCost === b1.totalCost
);

// Weighted-average merge: existing 5 boxes @ $90 + 10 new @ $100
function mergeAvg(qA: number, cA: number, qB: number, cB: number) {
  const q = qA + qB;
  return { q, cost: (qA * cA + qB * cB) / q };
}
const m = mergeAvg(5, 90, 10, 100);
check("merge qty = 15", m.q === 15);
check(
  "weighted-avg cost ≈ $96.67",
  Math.abs(m.cost - 96.6667) < 0.01,
  m.cost.toString()
);
check(
  "merge conserves total cost (5*90 + 10*100 == 15*avg)",
  Math.abs(m.q * m.cost - (5 * 90 + 10 * 100)) < 1e-6
);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
