import { eventForRoute, isEventEnabled, mapDisabledEvents, visibleActions, visibleSections } from "@/src/beef/events";
import { RECORD_SECTIONS } from "@/src/beef/records";

const labels = (sections: typeof RECORD_SECTIONS) => sections.flatMap((s) => s.items.map((i) => i.label));

describe("Events a farm switched off", () => {
  it("PD off removes the Pregnancy diagnosis entry and keeps every other", () => {
    const shown = visibleSections(RECORD_SECTIONS, ["Pregnancy Diagnosis"]);
    expect(labels(shown)).not.toContain("Pregnancy diagnosis");
    expect(labels(shown)).toEqual(labels(RECORD_SECTIONS).filter((l) => l !== "Pregnancy diagnosis"));
    expect(shown.map((s) => s.title)).toEqual(RECORD_SECTIONS.map((s) => s.title));
  });

  it("a missing or odd disabled_events hides nothing", () => {
    expect(mapDisabledEvents(undefined)).toEqual([]);
    expect(mapDisabledEvents(null)).toEqual([]);
    expect(mapDisabledEvents("Pregnancy Diagnosis")).toEqual([]);
    expect(visibleSections(RECORD_SECTIONS, mapDisabledEvents(undefined))).toEqual(RECORD_SECTIONS);
    expect(visibleSections(RECORD_SECTIONS, undefined)).toEqual(RECORD_SECTIONS);
  });

  it("a section left empty goes; stock is no event and stays", () => {
    const shown = visibleSections(RECORD_SECTIONS, ["Weight Recording", "Movement"]);
    expect(shown.map((s) => s.title)).toEqual(["Breeding", "Health", "Husbandry", "Stores"]);
    expect(labels(shown)).toContain("Stock (read only)");
  });

  it("every Record entry but Stock maps to a server event type", () => {
    const server = [
      "Abortion", "Birth", "Calving", "Check Up", "Cull Review", "Dehorning", "Deworming", "Feeding", "Health Case",
      "Heat Detection", "Hoof Trimming", "Movement", "Pregnancy Diagnosis", "Service", "Treatment", "Vaccination", "Weight Recording",
    ];
    for (const it of RECORD_SECTIONS.flatMap((s) => s.items)) {
      const ev = eventForRoute(it.href);
      if (it.href.endsWith("/stock")) expect(ev).toBeNull();
      else expect({ href: it.href, ok: server.includes(ev ?? "") }).toEqual({ href: it.href, ok: true });
    }
  });

  it("filters an animal's quick actions the same way", () => {
    const actions = [
      { label: "Weigh", route: "weight" },
      { label: "Service", route: "service" },
      { label: "PD", route: "pd" },
      { label: "Move", route: "movement" },
    ];
    expect(visibleActions(actions, ["Pregnancy Diagnosis"]).map((a) => a.label)).toEqual(["Weigh", "Service", "Move"]);
    expect(visibleActions(actions, [])).toEqual(actions);
  });

  it("isEventEnabled: off only when named", () => {
    expect(isEventEnabled("Service", ["Pregnancy Diagnosis"])).toBe(true);
    expect(isEventEnabled("Pregnancy Diagnosis", ["Pregnancy Diagnosis"])).toBe(false);
    expect(isEventEnabled(null, ["Pregnancy Diagnosis"])).toBe(true);
  });
});
