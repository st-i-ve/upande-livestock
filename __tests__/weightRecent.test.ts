import {
  RECENT_DAYS,
  daysBetween,
  findRecent,
  recentLine,
  recentMessage,
  recentlyWeighed,
  shortDay,
} from "@/src/weights/recent";

const TODAY = "2026-11-11";
const cow = (name: string, lastWtDate: string | null, lastWt = 309) => ({ id: `982 0910861308${name}`, name, lastWt, lastWtDate });

describe("recently weighed: the 7-day rule", () => {
  it("counts calendar days", () => {
    expect(daysBetween("2026-11-08", TODAY)).toBe(3);
    expect(daysBetween("2026-10-31", "2026-11-01")).toBe(1);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2); // across a DST change
    expect(daysBetween("", TODAY)).toBeNull();
  });

  it("flags today, a few days ago and six days ago", () => {
    expect(recentlyWeighed(TODAY, TODAY)).toBe(0);
    expect(recentlyWeighed("2026-11-08", TODAY)).toBe(3);
    expect(recentlyWeighed("2026-11-05", TODAY)).toBe(6);
  });

  it("leaves a weekly round (exactly 7 days) and older alone", () => {
    expect(RECENT_DAYS).toBe(7);
    expect(recentlyWeighed("2026-11-04", TODAY)).toBeNull();
    expect(recentlyWeighed("2026-10-01", TODAY)).toBeNull();
  });

  it("never weighed, or no date known: no warning", () => {
    expect(recentlyWeighed(null, TODAY)).toBeNull();
    expect(recentlyWeighed(undefined, TODAY)).toBeNull();
  });

  it("backdating: measured from the day being recorded, either side", () => {
    expect(recentlyWeighed("2026-11-08", "2026-11-06")).toBe(-2);
    expect(recentlyWeighed("2026-11-08", "2026-10-30")).toBeNull();
  });

  it("finds only the recent ones in a pick, labelled by her name, not the RFID", () => {
    const r = findRecent([cow("LE151", "2026-11-08"), cow("LE152", "2026-10-01"), cow("LE153", null)], TODAY);
    expect(r).toEqual([{ id: "982 0910861308LE151", label: "LE151", date: "2026-11-08", kg: 309, daysAgo: 3 }]);
  });

  it("says when and what she weighed", () => {
    expect(shortDay("2026-11-08")).toBe("Sun 8 Nov");
    const [one] = findRecent([cow("LE151", "2026-11-08")], TODAY);
    expect(recentLine(one)).toBe("LE151 was weighed 3 days ago (Sun 8 Nov, 309 kg).");
    expect(recentMessage([one])).toBe(
      "LE151 was weighed 3 days ago (Sun 8 Nov, 309 kg). You can skip this animal or weigh it again.",
    );
    const [t] = findRecent([cow("LE151", TODAY, 312)], TODAY);
    expect(recentLine(t)).toBe(`LE151 was weighed today (Wed 11 Nov, 312 kg).`);
    const two = findRecent([cow("A", "2026-11-10"), cow("B", "2026-11-09")], TODAY);
    expect(recentMessage(two)).toMatch(/A was weighed yesterday.*\nB was weighed 2 days ago.*\nYou can skip these 2 animals/);
    expect(recentMessage([])).toBe("");
  });
});
