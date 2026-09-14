/**
 * Sunday→Saturday week bucketing in America/New_York.
 * A "week" is identified by its Sunday as a YYYY-MM-DD date string.
 */

export const WEEK_TZ = "America/New_York";

const dtf = new Intl.DateTimeFormat("en-US", {
  timeZone: WEEK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Offset (ms) of the NY wall clock ahead of UTC at the given instant. */
function tzOffsetMs(instant: Date): number {
  const parts = Object.fromEntries(
    dtf.formatToParts(instant).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instant.getTime();
}

/** UTC instant of midnight (00:00) in New York on the given YYYY-MM-DD date. */
export function nyMidnightUtc(dateStr: string): Date {
  const guess = new Date(`${dateStr}T00:00:00.000Z`);
  return new Date(guess.getTime() - tzOffsetMs(guess));
}

function parseDay(dateStr: string): Date {
  // Noon UTC avoids any DST edge when doing pure calendar math.
  return new Date(`${dateStr}T12:00:00.000Z`);
}

function fmtDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDay(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDay(d);
}

/** Today's date (YYYY-MM-DD) in New York. */
export function todayInNy(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: WEEK_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** The Sunday (YYYY-MM-DD) of the week containing dateStr. */
export function sundayOfWeek(dateStr: string): string {
  const dow = parseDay(dateStr).getUTCDay(); // 0 = Sunday
  return addDays(dateStr, -dow);
}

export function isSunday(dateStr: string): boolean {
  return parseDay(dateStr).getUTCDay() === 0;
}

/** Most recent `count` Sundays, current week first. */
export function listRecentSundays(count: number): string[] {
  const current = sundayOfWeek(todayInNy());
  return Array.from({ length: count }, (_, i) => addDays(current, -7 * i));
}

/** [from, to) UTC ISO bounds for the NY week starting on `sunday`. */
export function weekRangeUtc(sunday: string): { from: string; to: string } {
  return {
    from: nyMidnightUtc(sunday).toISOString(),
    to: nyMidnightUtc(addDays(sunday, 7)).toISOString(),
  };
}

const shortFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** "Aug 23 – Aug 29" */
export function weekLabel(sunday: string): string {
  const start = parseDay(sunday);
  const end = parseDay(addDays(sunday, 6));
  const sameYear = true; // labels stay short; year shown only on the end when useful
  void sameYear;
  return `${shortFmt.format(start)} – ${shortFmt.format(end)}, ${end.getUTCFullYear()}`;
}
