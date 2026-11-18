import { feedingTabs, isFeedRouteOn, mapFeedTypes, visibleFeedSections } from "@/src/beef/feedTypes";
import { RECORD_SECTIONS } from "@/src/beef/records";

const labels = (sections: typeof RECORD_SECTIONS) => sections.flatMap((s) => s.items.map((i) => i.label));

describe("Feed types on the phone", () => {
  it("a server that sends nothing means System and Day sheet on, Manual off", () => {
    expect(mapFeedTypes(undefined)).toEqual({ system: true, manual: false, day_sheet: true });
    expect(mapFeedTypes(null)).toEqual({ system: true, manual: false, day_sheet: true });
    expect(feedingTabs(mapFeedTypes(undefined))).toEqual(["system"]);
  });

  it("reads the server's flags, as booleans or 0/1", () => {
    expect(mapFeedTypes({ system: 0, manual: 1, day_sheet: false })).toEqual({ system: false, manual: true, day_sheet: false });
  });

  it("day sheet off removes the Feeding day and Daily feed report entries and keeps the rest", () => {
    const shown = visibleFeedSections(RECORD_SECTIONS, { system: true, manual: false, day_sheet: false });
    expect(labels(shown)).not.toContain("Feeding day: plan and amend");
    expect(labels(shown)).not.toContain("Daily feed report");
    expect(labels(shown)).toContain("Animal feeding");
  });

  it("Animal feeding stays while System or Manual is on, and goes when both are off", () => {
    expect(isFeedRouteOn("/(tabs)/record/events/animal-feed", { system: false, manual: true, day_sheet: true })).toBe(true);
    expect(isFeedRouteOn("/(tabs)/record/events/animal-feed", { system: false, manual: false, day_sheet: true })).toBe(false);
    expect(isFeedRouteOn("/(tabs)/record/events/weight", { system: false, manual: false, day_sheet: false })).toBe(true);
  });

  it("tabs follow the flags", () => {
    expect(feedingTabs({ system: true, manual: true, day_sheet: true })).toEqual(["system", "manual"]);
    expect(feedingTabs({ system: false, manual: true, day_sheet: true })).toEqual(["manual"]);
  });
});
