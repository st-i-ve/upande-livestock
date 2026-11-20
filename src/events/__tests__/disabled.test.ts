import { describe, expect, it } from "../../__tests__/jestLike.ts";
import { calvingOutcomes, eventForRoute, isEventEnabled, mapDisabledEvents, visibleActions, visibleSections } from "../disabled.ts";
import { RECORD_SECTIONS } from "../../recordSections.ts";

describe("events a farm switched off", () => {
  it("reads the server's list, tolerating anything odd", () => {
    expect(mapDisabledEvents(["Heat Detection", "", 3])).toEqual(["Heat Detection"]);
    expect(mapDisabledEvents(undefined)).toEqual([]);
  });

  it("maps record routes to event types, milk and dry off included", () => {
    expect(eventForRoute("/(tabs)/record/events/heat")).toBe("Heat Detection");
    expect(eventForRoute("/(tabs)/record/events/milk")).toBe("Milking");
    expect(eventForRoute("/(tabs)/record/events/dryoff")).toBe("Drying Off");
    expect(eventForRoute("/(tabs)/record/stock")).toBeNull();
    expect(isEventEnabled("Service", ["Service"])).toBe(false);
    expect(isEventEnabled(null, ["Service"])).toBe(true);
  });

  it("the Record menu drops them and an emptied section goes too", () => {
    const sections = visibleSections(RECORD_SECTIONS, ["Heat Detection", "Weight Recording"]);
    const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs.some((h) => h.endsWith("/heat"))).toBe(false);
    expect(hrefs.some((h) => h.endsWith("/weight"))).toBe(false);
    expect(hrefs.some((h) => h.endsWith("/service"))).toBe(true);
    expect(visibleSections(RECORD_SECTIONS, null)).toHaveLength(RECORD_SECTIONS.length);
  });

  it("quick actions and calving outcomes follow", () => {
    const actions = [{ route: "pd" }, { route: "heat" }];
    expect(visibleActions(actions, ["Pregnancy Diagnosis"])).toEqual([{ route: "heat" }]);
    expect(calvingOutcomes(["Abortion"])).toEqual(["Live Birth", "Still Birth"]);
    expect(calvingOutcomes([])).toEqual(["Live Birth", "Still Birth", "Abortion"]);
  });
});
