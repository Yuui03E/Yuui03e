import { MONTHS } from "./constants";

export function fmtSize(b: number) {
  if (!b) return "0 B";
  if (b >= 1024 ** 4) return `${(b / 1024 ** 4).toFixed(2)} TB`;
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.round(b / 1024)} KB`;
}
export function fmtDate(d?: { year: number | null; month: number | null; day: number | null } | null) {
  if (!d || !d.year) return "—";
  const m = d.month ? MONTHS[d.month - 1] : "";
  return `${m ? m + " " : ""}${d.day ? d.day + ", " : ""}${d.year}`;
}
export function fmtNum(n?: number | null) {
  if (n == null) return "—";
  return n.toLocaleString();
}
