export function money(n: number | null | undefined): string {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

// Parse a form value to a number, defaulting to 0.
export function num(v: FormDataEntryValue | null): number {
  if (v === null) return 0;
  const n = parseFloat(String(v));
  return isFinite(n) ? n : 0;
}

export function intNum(v: FormDataEntryValue | null): number {
  if (v === null) return 0;
  const n = parseInt(String(v), 10);
  return isFinite(n) ? n : 0;
}

export function str(v: FormDataEntryValue | null): string {
  return v === null ? "" : String(v).trim();
}

export function optStr(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s.length ? s : null;
}

export function optDate(v: FormDataEntryValue | null): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
