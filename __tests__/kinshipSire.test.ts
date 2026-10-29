import { mergeWarnings, parseKinship } from "@/src/beef/kinship";
import { parseSire, sireState } from "@/src/beef/sire";

describe("kinship preview reply", () => {
  it("reads warnings, selection and stream", () => {
    const k = parseKinship({
      ok: true,
      warnings: ["B004/21 and A017/24 are half-siblings: both sired by B001/18"],
      conflicts: [{ other: "A017/24", relation: "half-siblings", shared_parent: "B001/18", message: "x" }],
      selection: true,
      note_required: true,
      stream: "Breeding",
    });
    expect(k.warnings).toHaveLength(1);
    expect(k).toMatchObject({ selection: true, noteRequired: true, stream: "Breeding" });
    expect(k.conflicts[0].relation).toBe("half-siblings");
  });
  it("falls back to the conflict messages, and to nothing when the reply is empty", () => {
    expect(parseKinship({ conflicts: [{ other: "A1", relation: "dam-son", message: "A1 is his dam" }] }).warnings).toEqual(["A1 is his dam"]);
    expect(parseKinship(null).warnings).toEqual([]);
    expect(parseKinship({}).stream).toBeNull();
  });
  it("merges warnings without repeats", () => {
    expect(mergeWarnings(["a", "b"], undefined, ["b", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("sire candidates", () => {
  it("one bull: inferred, named", () => {
    const r = parseSire({ sire_animal: "B004/21", label: "Kito", inferred: true, basis: "in Lactation Group 1 02-01 to 03-30", candidates: [{ animal: "B004/21", label: "Kito", basis: "x" }] });
    expect(sireState(r)).toEqual({ kind: "inferred", label: "Kito", basis: "in Lactation Group 1 02-01 to 03-30" });
  });
  it("several bulls: the herdsman chooses", () => {
    const r = parseSire({ sire_animal: null, inferred: false, candidates: [{ animal: "B1", label: "Kito", basis: "" }, { animal: "B2", label: "Simba", basis: "" }] });
    const s = sireState(r);
    expect(s.kind).toBe("choose");
    expect(s.kind === "choose" && s.candidates.map((c) => c.label)).toEqual(["Kito", "Simba"]);
  });
  it("none: a plain warning with the server's words", () => {
    expect(sireState(parseSire({ candidates: [], basis: "No mature bull was in her herd" }))).toEqual({ kind: "none", basis: "No mature bull was in her herd" });
  });
  it("reads the sire fields of a service reply too", () => {
    const r = parseSire({ sire_animal: "B1", sire_label: "Kito", sire_inferred: true, sire_basis: "b", candidates: [] });
    expect(r).toMatchObject({ sireAnimal: "B1", label: "Kito", inferred: true, basis: "b" });
  });
});
