// Startup diagnostic: reports which required env vars the container actually
// received, WITHOUT printing any secret values. Runs automatically as the npm
// `prestart` hook (before `prisma migrate deploy`). Safe to keep in place.

const REQUIRED = ["DATABASE_URL", "AUTH_SECRET", "AUTH_URL"];

console.log("── env check ─────────────────────────────");
for (const name of REQUIRED) {
  const val = process.env[name];
  if (val === undefined || val === "") {
    console.log(`  ${name}: MISSING (not set / empty)`);
    continue;
  }
  // Detect an unresolved Railway reference left as a literal string.
  if (val.includes("${{")) {
    console.log(`  ${name}: UNRESOLVED REFERENCE -> ${val}`);
    continue;
  }
  const hint =
    name === "DATABASE_URL"
      ? ` (len ${val.length}, scheme "${val.split(":")[0]}")`
      : ` (len ${val.length})`;
  console.log(`  ${name}: present${hint}`);
}
console.log("──────────────────────────────────────────");
