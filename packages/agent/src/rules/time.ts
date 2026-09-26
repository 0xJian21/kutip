/** Buyer-local calendar maths on top of Intl. No LLM ever produces a date the engine acts on. */

export type LocalDate = { y: number; m: number; d: number };

const HOUR = 3_600_000;
export const HOURS_48 = 48 * HOUR;

export function parseIsoDate(s: string): LocalDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) throw new Error(`Expected YYYY-MM-DD, got "${s}"`);
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) throw new Error(`Not a calendar date: "${s}"`);
  return { y, m, d };
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const t = new Date(Date.UTC(date.y, date.m - 1, date.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function formatIsoDate({ y, m, d }: LocalDate): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Wall-clock parts of `at` in `timeZone`. */
export function localParts(at: Date, timeZone: string): LocalDate & { h: number; mi: number } {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    formatters.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), mi: Number(p.minute) };
}

function offsetMs(at: Date, timeZone: string): number {
  const p = localParts(at, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
  return asUtc - Math.floor(at.getTime() / 60_000) * 60_000;
}

/** The instant when the wall clock in `timeZone` reads `date` `hour`:00. */
export function zonedTime(date: LocalDate, hour: number, timeZone: string): Date {
  const guess = Date.UTC(date.y, date.m - 1, date.d, hour);
  let t = guess - offsetMs(new Date(guess), timeZone);
  t = guess - offsetMs(new Date(t), timeZone); // re-check across a DST edge
  return new Date(t);
}

/** Sending window is [open, close) in buyer-local hours; it may wrap midnight. */
export function inWindow(hour: number, open: number, close: number): boolean {
  return open < close ? hour >= open && hour < close : hour >= open || hour < close;
}

/** `at` if it falls in the window, else the next time the window opens. */
export function snapToWindow(at: Date, timeZone: string, open: number, close: number): Date {
  const p = localParts(at, timeZone);
  if (inWindow(p.h, open, close)) return at;
  const today = zonedTime(p, open, timeZone);
  return today.getTime() > at.getTime() ? today : zonedTime(addDays(p, 1), open, timeZone);
}
