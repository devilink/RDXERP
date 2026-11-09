// Hosting servers usually run on UTC, so the school's day is computed explicitly.
const TIME_ZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";

/** The school's current date as YYYY-MM-DD, whatever timezone the server runs in. */
export function today(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function money(n: number, currency = "₹") {
  return `${currency}${(Math.round(n * 100) / 100).toLocaleString("en-IN")}`;
}

export function fmtDate(s?: string | Date | null) {
  if (!s) return "—";
  const dateOnly = typeof s === "string" && s.length === 10;
  const d = new Date(dateOnly ? s + "T00:00:00" : s);
  // Date-only values have no timezone to convert; real timestamps show in the school's.
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", ...(dateOnly ? {} : { timeZone: TIME_ZONE }) });
}

export function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 1000) / 10;
}

export function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, k: string) {
  const v = str(fd, k);
  return v === "" ? null : v;
}

export function num(fd: FormData, k: string, fallback = 0) {
  const v = Number(str(fd, k));
  return Number.isFinite(v) && str(fd, k) !== "" ? v : fallback;
}

export function cls(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Days in a YYYY-MM month as YYYY-MM-DD strings. */
export function monthDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function fullName(s: { firstName: string; lastName: string }) {
  return `${s.firstName} ${s.lastName}`.trim();
}

export type ActionState = { ok: boolean; message: string } | null;

export function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

/** Convert a thrown error into a user-facing action result. */
export function failed(e: unknown): { ok: false; message: string } {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Unique constraint")) return { ok: false, message: "A record with these details already exists." };
  if (msg.includes("NEXT_REDIRECT")) throw e;
  return { ok: false, message: msg.split("\n").filter(Boolean).pop() || "Something went wrong." };
}
