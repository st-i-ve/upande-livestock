import {
  countOffspring,
  localFamily,
  measuresFor,
  sectionsFor,
  sortOffspring,
  treeParts,
  type Family,
  type Kin,
  type LocalKin,
} from "@/src/family";

describe("sex-aware sections", () => {
  it("a female shows her repro figures, never a sire record", () => {
    expect(sectionsFor({ sex: "F", stage: "served" })).toEqual({ female: true, bull: false, steer: false });
    expect(sectionsFor({ sex: "Female", stage: "heifer" }).female).toBe(true);
  });
  it("a male never shows female figures", () => {
    for (const stage of ["bull", "grower", "calf", "heifer", "served", null]) {
      expect(sectionsFor({ sex: "M", stage }).female).toBe(false);
    }
  });
  it("a breeding male is the bull: stage, stream, herd class or a sire on record", () => {
    expect(sectionsFor({ sex: "M", stage: "bull" }).bull).toBe(true);
    expect(sectionsFor({ sex: "Male", stream: "Breeding", stage: "grower" }).bull).toBe(true);
    expect(sectionsFor({ sex: "M", herdClass: "Breeding" }).bull).toBe(true);
    expect(sectionsFor({ sex: "M", stage: "finisher", breedingBull: true }).bull).toBe(true);
  });
  it("any other male is a steer with no breeding section", () => {
    expect(sectionsFor({ sex: "M", stage: "grower", stream: "Feedlot" })).toEqual({
      female: false,
      bull: false,
      steer: true,
    });
  });
  it("drops the female measures for a male", () => {
    const ms = [{ key: "parity" }, { key: "services_per_conception" }, { key: "calving_interval" }, { key: "last_weight" }];
    expect(measuresFor(ms, true).map((m) => m.key)).toEqual(["last_weight"]);
    expect(measuresFor(ms, false)).toHaveLength(4);
  });
});

describe("offspring", () => {
  it("counts sons and daughters, whichever spelling of sex", () => {
    expect(countOffspring([{ sex: "Male" }, { sex: "F" }, { sex: "M" }, { sex: "Female" }, { sex: null }])).toEqual({
      sons: 2,
      daughters: 2,
      total: 5,
    });
    expect(countOffspring([])).toEqual({ sons: 0, daughters: 0, total: 0 });
  });
  it("lists the youngest first, undated last", () => {
    const got = sortOffspring([
      { id: "a", dob: "2024-01-01" },
      { id: "b", dob: null },
      { id: "c", dob: "2025-06-01" },
    ]);
    expect(got.map((k) => k.id)).toEqual(["c", "a", "b"]);
  });

  const row = (id: string, sex: string, extra: Partial<LocalKin> = {}): LocalKin => ({
    id, name: id, sex, dob: "", ...extra,
  });

  it("works out a cow's family from the phone's animals", () => {
    const all = [
      row("COW", "F", { dam: "GRAN", sire: "BULL" }),
      row("GRAN", "F"),
      row("BULL", "M"),
      row("K1", "M", { dam: "COW", dob: "2025-01-01" }),
      row("K2", "F", { dam: "COW", dob: "2026-01-01" }),
      row("OTHER", "F", { dam: "GRAN" }),
    ];
    const f = localFamily(all[0], all);
    expect(f.parents.dam?.id).toBe("GRAN");
    expect(f.parents.sire?.id).toBe("BULL");
    expect(f.offspring.map((k) => k.id)).toEqual(["K2", "K1"]);
    expect([f.sons, f.daughters]).toEqual([1, 1]);
    expect(f.local).toBe(true);
  });
  it("finds a bull's calves by id or written name; a written-in sire is not on record", () => {
    const bull = row("SA-1", "M", { name: "Duke" });
    const all = [
      bull,
      row("C1", "F", { sire: "SA-1" }),
      row("C2", "M", { sire: "Duke" }),
      row("C3", "M", { sire: "AI Straw" }),
    ];
    const f = localFamily(bull, all);
    expect(f.offspring.map((k) => k.id).sort()).toEqual(["C1", "C2"]);
    expect(f.breedingBull).toBe(true);
    const ai = localFamily(all[3], all);
    expect(ai.parents.sire).toMatchObject({ id: null, name: "AI Straw", onRecord: false });
  });
});

describe("what the family tree draws", () => {
  const kin = (name: string, sex: string): Kin => ({ id: name, name, sex, dob: null, active: true, onRecord: true });
  const fam = (dam: Kin | null, sire: Kin | null, offspring: Kin[] = []): Family => ({
    parents: { dam, sire },
    offspring,
    sons: 0,
    daughters: 0,
    bred: null,
    breedingBull: false,
  });

  it("nothing at all when neither parent nor any calf is known", () => {
    expect(treeParts(fam(null, null))).toEqual({ parents: [], offspring: false, show: false });
    expect(treeParts(null).show).toBe(false);
  });
  it("only the known parent, with no box for the missing one", () => {
    const dam = kin("D1", "Female");
    expect(treeParts(fam(dam, null)).parents).toEqual([{ role: "Dam", kin: dam }]);
    const sire = kin("S1", "Male");
    expect(treeParts(fam(null, sire)).parents).toEqual([{ role: "Sire", kin: sire }]);
    expect(treeParts(fam(dam, sire)).parents.map((p) => p.role)).toEqual(["Dam", "Sire"]);
  });
  it("the offspring section only when there are calves", () => {
    expect(treeParts(fam(kin("D1", "Female"), null)).offspring).toBe(false);
    const parts = treeParts(fam(null, null, [kin("C1", "Male")]));
    expect(parts).toEqual({ parents: [], offspring: true, show: true });
  });
  it("an offline family with no parent or calf on the phone draws nothing", () => {
    const me: LocalKin = { id: "A1", name: "A1", sex: "F", dob: "2020-01-01" };
    expect(treeParts(localFamily(me, [me])).show).toBe(false);
  });
});
