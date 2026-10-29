import AsyncStorage from "@react-native-async-storage/async-storage";
import fs from "fs";
import path from "path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { ClassCounts } from "@/components/shoats/ClassCounts";
import { RECORD_SECTIONS } from "@/src/beef/records";
import { mapLedger, mapShoatHerd, type HeadClass } from "@/src/shoats/api";
import { ANIMAL_TYPE_KEY, homeOf, isShoats, parseAnimalType, speciesOf, useAnimalType } from "@/src/shoats/animalType";
import {
  allCounts, classSummary, ledgerSummary, cleanCounts, countVariance, expectedBirthFrom, liveWeight, overdrawn, prefillFromLedger, totalOf, varianceText, withdrawalEnd,
} from "@/src/shoats/logic";
import { SHOAT_RECORD_ITEMS } from "@/src/shoats/records";

const root = path.resolve(__dirname, "..");
const classes: HeadClass[] = [
  { key: "females", label: "Ewes", head: 62 },
  { key: "males", label: "Rams", head: 3 },
  { key: "young", label: "Lambs", head: 24 },
];
const labels = { females: "Ewes", males: "Rams", young: "Lambs", others: "Others" };

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
    expect(cleanCounts({ females: "12", males: "0", young: "", others: "3.9" })).toEqual({ females: 12, others: 3 });
    expect(totalOf({ females: 12, others: 3 })).toBe(15);
  });
  it("sends every class on a head count, zeros included", () => {
    expect(allCounts({ females: "60", males: "0" }, classes)).toEqual({ females: 60, males: 0, young: 0 });
    expect(prefillFromLedger(classes)).toEqual({ females: "62", males: "3", young: "24" });
  });
  it("reads variance against the books", () => {
    expect(countVariance(87, 89)).toBe(-2);
    expect(varianceText(-2)).toBe("2 fewer than the books");
    expect(varianceText(3)).toBe("+3 more than the books");
    expect(varianceText(0)).toBe("matches the books");
  });
  it("flags a removal larger than a class holds", () => {
    expect(overdrawn({ males: 4, females: 10 }, classes).map((k) => k.key)).toEqual(["males"]);
    expect(overdrawn({ males: 3 }, classes)).toEqual([]);
  });
  it("works out expected birth, withdrawal end and live weight", () => {
    expect(expectedBirthFrom("2026-03-01", 150)).toBe("2026-07-29");
    expect(withdrawalEnd("2026-10-29", 14)).toBe("2026-11-12");
    expect(liveWeight(31.4, 89)).toBe(2795);
  });
  it("summarises the classes that hold head", () => {
    expect(classSummary([...classes, { key: "others", label: "Others", head: 0 }])).toBe("62 ewes · 3 rams · 24 lambs");
  });
});

describe("server shapes", () => {
  it("maps a herd card with head by class, weight, withdrawal and the next birth", () => {
    const h = mapShoatHerd({
      name: "Sheep Flock 1", label: "Dorper Flock", species: "Sheep", breed: "Dorper", paddock: "Paddock B1",
      labels: { females: "Ewes", males: "Rams", young: "Lambs", others: "Others" },
      head: { females: 62, males: 3, young: 24, others: 0, total: 89 },
      live_weight_kg: 2795, avg_weight_kg: 31.4, weight_date: "2026-10-01", weight_basis: "class samples",
      withdrawal_until: "2026-11-12", in_withdrawal: true, has_ration: true,
      next_due: { mating: "HCE-1", expected_birth_date: "2027-01-20", days_to_due: 83, females_served: 40 },
    });
    expect(h).toMatchObject({ name: "Sheep Flock 1", label: "Dorper Flock", head: 89, avgKg: 31.4, liveWeightKg: 2795, inWithdrawal: true, hasRation: true, paddock: "Paddock B1" });
    expect(h.classes.map((k) => [k.key, k.label, k.head])).toEqual([["females", "Ewes", 62], ["males", "Rams", 3], ["young", "Lambs", 24], ["others", "Others", 0]]);
    expect(h.nextDue).toEqual({ mating: "HCE-1", expectedBirthDate: "2027-01-20", daysToDue: 83, femalesServed: 40 });
  });
  it("uses the goat words the server sends", () => {
    const h = mapShoatHerd({ name: "G1", species: "Goat", labels: { females: "Does", males: "Bucks", young: "Kids", others: "Others" }, head: { females: 5, total: 5 } });
    expect(h.classes.map((k) => k.label)).toEqual(["Does", "Bucks", "Kids", "Others"]);
  });
  it("reads a ledger line and writes its summary in the herd's words", () => {
    const birth = mapLedger({ name: "E1", event_date: "2026-10-01", event_type: "Birth", young: 12, born_dead: 1, head_after: 100 });
    expect(ledgerSummary(birth, labels)).toBe("12 lambs born alive, 1 born dead");
    const death = mapLedger({ name: "E2", event_date: "2026-10-02", event_type: "Death", females: 2, cause: "Disease", head_after: 98 });
    expect(ledgerSummary(death, labels)).toBe("2 ewes died of Disease");
    const count = mapLedger({ name: "E3", event_date: "2026-10-03", event_type: "Head Count", females: 60, males: 3, young: 33, variance: { females: -1, males: 0, young: -1, others: 0 }, head_after: 96 });
    expect(ledgerSummary(count, labels)).toBe("Counted 96 (2 fewer than the books)");
    const out = mapLedger({ name: "E4", event_date: "2026-10-04", event_type: "Transfer Out", females: 5, other_herd: "Sheep Flock 2" });
    expect(ledgerSummary(out, labels)).toBe("5 ewes out to Sheep Flock 2");
    const mating = mapLedger({ name: "E5", event_date: "2026-03-01", event_type: "Mating", females: 40, males: 2, expected_birth_date: "2026-07-29" });
    expect(ledgerSummary(mating, labels)).toBe("40 ewes put to 2 rams, due 2026-07-29");
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
    act(() => { r.root.findByProps({ testID: "count-females" }).props.onChangeText("12a"); });
    expect(onChange).toHaveBeenCalledWith({ females: "12" });
  });
});
