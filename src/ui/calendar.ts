/**
 * Date maths for the app's own calendar (components/DatePickerHost.tsx).
 * Everything is in the phone's local time and works on whole days: a bound
 * (`min`/`max`) allows its whole day, whatever its time of day.
 */

export type YM = { year: number; month: number }; // month 0–11

export type DayCell = { date: Date; inMonth: boolean };

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Outside the allowed days (before `min`'s day or after `max`'s day). */
export function isDayDisabled(d: Date, min?: Date | null, max?: Date | null): boolean {
  const t = startOfDay(d).getTime();
  if (min && t < startOfDay(min).getTime()) return true;
  if (max && t > startOfDay(max).getTime()) return true;
  return false;
}

/** `d` moved into the allowed days, keeping its time of day. A range given
 *  back to front (min after max) settles on `max`. */
export function clampDay(d: Date, min?: Date | null, max?: Date | null): Date {
  if (max && startOfDay(d).getTime() > startOfDay(max).getTime()) return withTimeOf(max, d);
  if (min && startOfDay(d).getTime() < startOfDay(min).getTime()) return withTimeOf(min, d);
  return new Date(d.getTime());
}

/** `day`'s date with `time`'s hours, minutes, seconds. */
export function withTimeOf(day: Date, time: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds());
}

export function addMonths({ year, month }: YM, delta: number): YM {
  const m = year * 12 + month + delta;
  return { year: Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
}

/** Monday = 0 … Sunday = 6. */
export const weekdayFromMonday = (d: Date): number => (d.getDay() + 6) % 7;

/**
 * The month as six weeks of seven days, Monday first; days before the 1st and
 * after the last belong to the neighbouring months (`inMonth` false). Always six
 * rows, so the sheet does not change height from month to month.
 */
export function monthGrid({ year, month }: YM): DayCell[][] {
  const first = new Date(year, month, 1);
  const lead = weekdayFromMonday(first);
  const weeks: DayCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(year, month, 1 - lead + w * 7 + i);
      week.push({ date, inMonth: date.getMonth() === month });
    }
    weeks.push(week);
  }
  return weeks;
}

/** No day of the month can be chosen. */
export function isMonthDisabled({ year, month }: YM, min?: Date | null, max?: Date | null): boolean {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  if (min && last.getTime() < startOfDay(min).getTime()) return true;
  if (max && first.getTime() > startOfDay(max).getTime()) return true;
  return false;
}

/** The years offered in the year list: the bounds when given, otherwise a
 *  farm's span around today (30 years back, 5 ahead), always including the
 *  value's year. Newest last. */
export function yearRange(value: Date, today: Date, min?: Date | null, max?: Date | null): number[] {
  let from = min ? min.getFullYear() : today.getFullYear() - 30;
  let to = max ? max.getFullYear() : today.getFullYear() + 5;
  if (!min) from = Math.min(from, value.getFullYear());
  if (!max) to = Math.max(to, value.getFullYear());
  if (from > to) [from, to] = [to, from];
  const out: number[] = [];
  for (let y = from; y <= to; y++) out.push(y);
  return out;
}

export type QuickChip = { label: "Today" | "Yesterday"; date: Date };

/** "Today" and "Yesterday", each only when it can be chosen. */
export function quickChips(today: Date, min?: Date | null, max?: Date | null): QuickChip[] {
  const t = startOfDay(today);
  const y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
  const chips: QuickChip[] = [];
  if (!isDayDisabled(t, min, max)) chips.push({ label: "Today", date: t });
  if (!isDayDisabled(y, min, max)) chips.push({ label: "Yesterday", date: y });
  return chips;
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "Thursday 12 November 2026" — for screen readers. */
export const longLabel = (d: Date): string => `${WEEKDAYS_LONG[weekdayFromMonday(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** "Thu, 12 Nov 2026" — the sheet's heading. */
export const shortLabel = (d: Date): string => `${WEEKDAYS[weekdayFromMonday(d)]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;

/** A time is allowed when its minute of `day` is within the bounds (the time
 *  picker's own min/max, honoured only on the bound's day). */
export function isTimeDisabled(at: Date, min?: Date | null, max?: Date | null): boolean {
  const minute = (d: Date) => Math.floor(d.getTime() / 60000);
  if (min && sameDay(at, min) && minute(at) < minute(min)) return true;
  if (max && sameDay(at, max) && minute(at) > minute(max)) return true;
  return false;
}
