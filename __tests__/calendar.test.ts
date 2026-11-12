import {
  addMonths,
  clampDay,
  isDayDisabled,
  isMonthDisabled,
  isTimeDisabled,
  monthGrid,
  quickChips,
  weekdayFromMonday,
  yearRange,
} from "@/src/ui/calendar";

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);
const ymd = (x: Date) => [x.getFullYear(), x.getMonth() + 1, x.getDate()];

describe("month grid", () => {
  it("starts the week on Monday and pads with the neighbouring months", () => {
    // 1 November 2026 is a Sunday: the first row is Mon 26 Oct … Sun 1 Nov.
    const g = monthGrid({ year: 2026, month: 10 });
    expect(g).toHaveLength(6);
    g.forEach((w) => {
      expect(w).toHaveLength(7);
      expect(weekdayFromMonday(w[0].date)).toBe(0);
      expect(weekdayFromMonday(w[6].date)).toBe(6);
    });
    expect(ymd(g[0][0].date)).toEqual([2026, 10, 26]);
    expect(g[0][0].inMonth).toBe(false);
    expect(ymd(g[0][6].date)).toEqual([2026, 11, 1]);
    expect(g[0][6].inMonth).toBe(true);
    const inMonth = g.flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(30);
    expect(ymd(inMonth[29].date)).toEqual([2026, 11, 30]);
  });

  it("begins on the 1st when the month starts on a Monday", () => {
    // 1 February 2027 is a Monday.
    const g = monthGrid({ year: 2027, month: 1 });
    expect(ymd(g[0][0].date)).toEqual([2027, 2, 1]);
    expect(g.flat().filter((c) => c.inMonth)).toHaveLength(28);
  });

  it("moves across years", () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(addMonths({ year: 2026, month: 5 }, -18)).toEqual({ year: 2024, month: 11 });
  });
});

describe("minimum and maximum", () => {
  const min = d(2026, 8, 15, 17, 30); // a bound allows its whole day
  const max = d(2026, 11, 12, 9, 0);

  it("greys the days outside the bounds, whole days only", () => {
    expect(isDayDisabled(d(2026, 8, 14, 23, 59), min, max)).toBe(true);
    expect(isDayDisabled(d(2026, 8, 15, 0, 0), min, max)).toBe(false);
    expect(isDayDisabled(d(2026, 11, 12, 23, 0), min, max)).toBe(false);
    expect(isDayDisabled(d(2026, 11, 13), min, max)).toBe(true);
    expect(isDayDisabled(d(1990, 1, 1))).toBe(false);
  });

  it("clamps a value into the bounds, keeping its time of day", () => {
    expect(clampDay(d(2026, 12, 25, 8, 15), min, max)).toEqual(d(2026, 11, 12, 8, 15));
    expect(clampDay(d(2026, 1, 1, 6, 0), min, max)).toEqual(d(2026, 8, 15, 6, 0));
    expect(clampDay(d(2026, 10, 1, 6, 0), min, max)).toEqual(d(2026, 10, 1, 6, 0));
    expect(clampDay(d(2026, 10, 1), null, null)).toEqual(d(2026, 10, 1));
  });

  it("closes the month arrows at months with no day allowed", () => {
    expect(isMonthDisabled({ year: 2026, month: 6 }, min, max)).toBe(true); // July
    expect(isMonthDisabled({ year: 2026, month: 7 }, min, max)).toBe(false); // August (from the 15th)
    expect(isMonthDisabled({ year: 2026, month: 10 }, min, max)).toBe(false); // November (to the 12th)
    expect(isMonthDisabled({ year: 2026, month: 11 }, min, max)).toBe(true); // December
  });

  it("offers Today and Yesterday only where allowed", () => {
    const today = d(2026, 11, 12, 10);
    expect(quickChips(today).map((c) => c.label)).toEqual(["Today", "Yesterday"]);
    expect(quickChips(today, null, d(2026, 11, 11)).map((c) => c.label)).toEqual(["Yesterday"]);
    expect(quickChips(today, d(2026, 11, 12)).map((c) => c.label)).toEqual(["Today"]);
    expect(quickChips(today, d(2026, 1, 1), d(2026, 6, 1))).toEqual([]);
    expect(ymd(quickChips(today)[1].date)).toEqual([2026, 11, 11]);
  });

  it("lists the bounded years, or a farm's span around today", () => {
    const today = d(2026, 11, 12);
    expect(yearRange(today, today, d(2024, 3, 1), max)).toEqual([2024, 2025, 2026]);
    const open = yearRange(d(1980, 1, 1), today);
    expect(open[0]).toBe(1980);
    expect(open[open.length - 1]).toBe(2031);
  });

  it("bounds a time only on the bound's own day", () => {
    const tmin = d(2026, 11, 12, 6, 30);
    expect(isTimeDisabled(d(2026, 11, 12, 6, 29), tmin)).toBe(true);
    expect(isTimeDisabled(d(2026, 11, 12, 6, 30), tmin)).toBe(false);
    expect(isTimeDisabled(d(2026, 11, 13, 1, 0), tmin)).toBe(false);
  });
});
