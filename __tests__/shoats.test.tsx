import AsyncStorage from "@react-native-async-storage/async-storage";
import fs from "fs";
import path from "path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { ClassCounts } from "@/components/shoats/ClassCounts";
import { RECORD_SECTIONS } from "@/src/beef/records";
import { mapLedger, mapShoatHerd } from "@/src/shoats/api";
import { ANIMAL_TYPE_KEY, homeOf, isShoats, parseAnimalType, speciesOf, useAnimalType } from "@/src/shoats/animalType";
import {
  allCounts, classSummary, cleanCounts, countVariance, expectedBirthFrom, liveWeight, overdrawn, prefillFromLedger, totalOf, varianceText, withdrawalEnd,
} from "@/src/shoats/logic";
import { SHOAT_RECORD_ITEMS } from "@/src/shoats/records";

const root = path.resolve(__dirname, "..");
const classes = [
  { key: "ewes", label: "Ewes", head: 62 },
  { key: "rams", label: "Rams", head: 3 },
  { key: "lambs", label: "Lambs", head: 24 },
];

describe("animal type", () => {
  it("opens the right place for each type, and asks when none is remembered", () => {
    expect(homeOf(null)).toBe("/choose");
    expect(homeOf("cattle")).toBe("/(tabs)/animals");
    expect(homeOf("sheep")).toBe("/(shoats)/herds");
    expect(homeOf("goats")).toBe("/(shoats)/herds");
  });
  it("maps shoat types to the server's species and tells shoats from cattle", () => {
    expect(speciesOf("sheep")).toBe("Sheep");
    expect(speciesOf("goats")).toBe("Goat");
    expect(speciesOf("cattle")).toBeNull();
    expect(isShoats("goats")).toBe(true);
    expect(isShoats("cattle")).toBe(false);
    expect(isShoats(null)).toBe(false);
  });
  it("ignores a stored value it does not know", () => {
    expect(parseAnimalType("pigs")).toBeNull();
    expect(parseAnimalType("goats")).toBe("goats");
  });
  it("remembers the choice on the device and restores it", async () => {
    act(() => useAnimalType.getState().setType("sheep"));
    expect(await AsyncStorage.getItem(ANIMAL_TYPE_KEY)).toBe("sheep");
    useAnimalType.setState({ type: null, hydrated: false });
    await act(async () => { await useAnimalType.getState().hydrate(); });
    expect(useAnimalType.getState().type).toBe("sheep");
    expect(useAnimalType.getState().hydrated).toBe(true);
  });
});

describe("head maths", () => {
  it("keeps whole positive figures only", () => {
    expect(cleanCounts({ ewes: "12", rams: "0", lambs: "", x: "3.9" })).toEqual({ ewes: 12, x: 3 });
    expect(totalOf({ ewes: 12, x: 3 })).toBe(15);
  });
  it("sends every class on a head count, zeros included", () => {
    expect(allCounts({ ewes: "60", rams: "0" }, classes)).toEqual({ ewes: 60, rams: 0, lambs: 0 });
    expect(prefillFromLedger(classes)).toEqual({ ewes: "62", rams: "3", lambs: "24" });
  });
  it("reads variance against the books", () => {
    expect(countVariance(87, 89)).toBe(-2);
    expect(varianceText(-2)).toBe("2 fewer than the books");
    expect(varianceText(3)).toBe("+3 more than the books");
    expect(varianceText(0)).toBe("matches the books");
  });
  it("flags a removal larger than a class holds", () => {
    expect(overdrawn({ rams: 4, ewes: 10 }, classes).map((k) => k.key)).toEqual(["rams"]);
    expect(overdrawn({ rams: 3 }, classes)).toEqual([]);
  });
  it("works out expected birth, withdrawal end and live weight", () => {
    expect(expectedBirthFrom("2026-03-01", 150)).toBe("2026-07-29");
    expect(withdrawalEnd("2026-10-29", 14)).toBe("2026-11-12");
    expect(liveWeight(31.4, 89)).toBe(2795);
  });
  it("summarises the classes that hold head", () => {
    expect(classSummary([...classes, { key: "o", label: "Others", head: 0 }])).toBe("62 ewes · 3 rams · 24 lambs");
  });
});

describe("server shapes", () => {
  it("maps a herd row with its classes and weight", () => {
    const h = mapShoatHerd({
      name: "SF1", label: "Sheep Flock 1", species: "Sheep", head: "89", classes: [{ key: "ewes", label: "Ewes", head: 62 }],
      avg_kg: "31.4", live_weight_kg: 2795, withdrawal_until: "2026-11-12",
    });
    expect(h).toMatchObject({ name: "SF1", head: 89, avgKg: 31.4, liveWeightKg: 2795, withdrawalUntil: "2026-11-12", paddock: null });
    expect(h.classes[0]).toEqual({ key: "ewes", label: "Ewes", head: 62 });
  });
  it("maps a ledger entry", () => {
    expect(mapLedger({ name: "E1", date: "2026-10-01", event_type: "Death", summary: "2 ewes died", head: 87 })).toMatchObject({ eventType: "Death", head: 87, variance: null });
  });
});

describe("Shoats record menu", () => {
  it("opens with Weigh sample, then count, breeding, health, feeding", () => {
    expect(SHOAT_RECORD_ITEMS.map((i) => i.label)).toEqual(["Weigh sample", "Count & movements", "Breeding", "Health", "Feeding"]);
  });
  it("every entry points at a screen that exists", () => {
    for (const i of SHOAT_RECORD_ITEMS) {
      const rel = i.href.replace(/^\//, "");
      expect({ href: i.href, ok: fs.existsSync(path.join(root, `app/${rel}.tsx`)) }).toEqual({ href: i.href, ok: true });
    }
  });
  it("leaves the cattle record menu as it was", () => {
    expect(RECORD_SECTIONS.map((s) => s.title)).toEqual(["Weight", "Breeding", "Movement", "Health", "Husbandry", "Stores"]);
  });
  it("has a herds list, a herd page, the animal type choice and both tab groups", () => {
    for (const f of ["app/choose.tsx", "app/(shoats)/_layout.tsx", "app/(shoats)/herds/index.tsx", "app/(shoats)/herds/[name].tsx", "app/(tabs)/_layout.tsx"]) {
      expect({ f, ok: fs.existsSync(path.join(root, f)) }).toEqual({ f, ok: true });
    }
  });
});

describe("ClassCounts", () => {
  it("shows what the books hold per class and reports whole-number entries", () => {
    const onChange = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<ClassCounts classes={classes} value={{}} onChange={onChange} />); });
    const json = JSON.stringify(r.toJSON());
    expect(json).toContain('"62"');
    expect(json).toContain(" on the books");
    act(() => { r.root.findByProps({ testID: "count-ewes" }).props.onChangeText("12a"); });
    expect(onChange).toHaveBeenCalledWith({ ewes: "12" });
  });
});
