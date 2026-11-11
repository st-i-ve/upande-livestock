import { eventForRoute, isEventEnabled, mapDisabledEvents, visibleActions, visibleSections } from "@/src/beef/events";
import { calvingOutcomes } from "@/src/beef/events";
import { RECORD_SECTIONS } from "@/src/beef/records";
import { SHOAT_RECORD_ITEMS, shoatBreedingModes, shoatEntryOn, shoatHealthTypes, visibleShoatItems } from "@/src/shoats/records";

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

describe("The shoat Record menu follows the switched-off events", () => {
  const shown = (off: string[]) => visibleShoatItems(SHOAT_RECORD_ITEMS, off).map((i) => i.label);

  it("nothing off shows every entry", () => {
    expect(shown([])).toEqual(SHOAT_RECORD_ITEMS.map((i) => i.label));
    expect(visibleShoatItems(SHOAT_RECORD_ITEMS, undefined)).toEqual(SHOAT_RECORD_ITEMS);
  });

  it("each entry goes with its event type", () => {
    expect(shown(["Weight Recording"])).not.toContain("Weigh sample");
    expect(shown(["Feeding"])).not.toContain("Feeding");
    expect(shown(["Feeding"])).toContain("Health");
  });

  it("an entry of several stays while any is on", () => {
    expect(shown(["Treatment", "Vaccination"])).toContain("Health");
    expect(shown(["Treatment", "Vaccination", "Deworming"])).not.toContain("Health");
    expect(shown(["Service"])).toContain("Breeding");
    expect(shown(["Service", "Calving"])).not.toContain("Breeding");
  });

  it("the count ledger is no event type and never goes", () => {
    const all = ["Weight Recording", "Service", "Calving", "Treatment", "Vaccination", "Deworming", "Feeding", "Movement"];
    expect(shown(all)).toEqual(["Count & movements"]);
    expect(shoatEntryOn("count", all)).toBe(true);
    expect(shoatEntryOn("weigh", all)).toBe(false);
  });

  it("maps only to event types the server has", () => {
    const server = [
      "Abortion", "Birth", "Calving", "Check Up", "Cull Review", "Dehorning", "Deworming", "Feeding", "Health Case",
      "Heat Detection", "Hoof Trimming", "Movement", "Pregnancy Diagnosis", "Service", "Treatment", "Vaccination",
      "Weight Recording",
    ];
    for (const it of SHOAT_RECORD_ITEMS) for (const e of it.events ?? []) expect(server).toContain(e);
  });

  it("the screens drop the switched-off modes and types", () => {
    expect(shoatBreedingModes(["Service"])).toEqual(["Birth", "Weaning"]);
    expect(shoatBreedingModes(["Calving"])).toEqual(["Mating", "Weaning"]);
    expect(shoatHealthTypes(["Treatment", "Dipping", "Deworming", "Vaccination"], ["Vaccination"])).toEqual([
      "Treatment", "Dipping", "Deworming",
    ]);
  });
});

describe("The calving screen's Abortion outcome", () => {
  it("is offered while Abortion is on and goes when it is off", () => {
    expect(calvingOutcomes([])).toEqual(["Live Birth", "Still Birth", "Abortion"]);
    expect(calvingOutcomes(undefined)).toContain("Abortion");
    expect(calvingOutcomes(["Abortion"])).toEqual(["Live Birth", "Still Birth"]);
    expect(calvingOutcomes(["Calving"])).toContain("Abortion");
  });
});

describe("Calf separation", () => {
  it("is a Movement on the server, so it goes with Movement", () => {
    expect(eventForRoute("/(tabs)/record/events/separation")).toBe("Movement");
    expect(isEventEnabled(eventForRoute("separation"), ["Movement"])).toBe(false);
  });
});
