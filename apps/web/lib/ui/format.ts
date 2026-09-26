/** Date and text formatting. Malaysian conventions: "3 Oct 2026", 24-hour time, MYT. */

const MYT = "Asia/Kuala_Lumpur";

export function formatDate(iso: string, opts: { timeZone?: string } = {}): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: iso.length === 10 ? undefined : (opts.timeZone ?? MYT) }).format(d);
}

export function formatDateTime(iso: string, timeZone: string = MYT): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", timeZone }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(d);
  return `${date}, ${time}`;
}

export function formatTime(iso: string, timeZone: string = MYT, withSeconds = true): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: withSeconds ? "2-digit" : undefined, hour12: false, timeZone }).format(new Date(iso));
}

/** Short timezone label for a buyer, e.g. "Sydney time". */
export function localTimeLabel(timeZone: string): string {
  const city = timeZone.split("/").pop()?.replace(/_/g, " ") ?? timeZone;
  return `${city} time`;
}

/** Whole days between an ISO date and now (positive = in the future). */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const due = new Date(`${isoDate}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** "Due in 3 days" / "Due today" / "4 days overdue" */
export function dueLabel(isoDate: string, now: Date = new Date()): string {
  const n = daysUntil(isoDate, now);
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  if (n > 1) return `Due in ${n} days`;
  if (n === -1) return "1 day overdue";
  return `${-n} days overdue`;
}

/** "3 min ago", "2 h ago", "yesterday", else a date */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return formatDate(iso);
}

/** "7Xk4…q9Zc" */
export function shortAddress(key: string, edge = 4): string {
  if (key.length <= edge * 2 + 1) return key;
  return `${key.slice(0, edge)}…${key.slice(-edge)}`;
}

export function solscanTx(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

export function solscanAccount(address: string): string {
  return `https://solscan.io/account/${address}`;
}

export function confidenceLabel(c: number): string {
  return `${Math.round(c * 100)}%`;
}
