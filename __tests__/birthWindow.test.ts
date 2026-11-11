import {
  addDays,
  daysBetween,
  diagnosisFits,
  normaliseWindow,
  retroPayload,
  retroProblem,
  serviceFits,
  serviceRange,
  suggestedDiagnosisDate,
  suggestedServiceDate,
  type RetroDraft,
} from "@/src/breeding/birthWindow";
import { backdatedNote } from "@/src/breeding/backdated";
import { checkFromRefusal } from "@/src/frappe/birthCheck";
import { outOfStock } from "@/src/frappe/eventItems";

const W = { minDays: 270, maxDays: 295 };

describe("birth window dates", () => {
  it("does whole-day arithmetic across months and leap years", () => {
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(daysBetween("2026-01-01", "2026-12-31")).toBe(364);
  });

  it("gives the service dates that put a birth inside the window", () => {
    expect(serviceRange("2026-11-11", W)).toEqual({ from: "2026-01-20", to: "2026-02-14" });
  });

  it("accepts the edges and refuses a day outside them", () => {
    expect(serviceFits("2026-01-20", "2026-11-11", W)).toBe(true); // 295 days
    expect(serviceFits("2026-02-14", "2026-11-11", W)).toBe(true); // 270 days
    expect(serviceFits("2026-01-19", "2026-11-11", W)).toBe(false); // 296
    expect(serviceFits("2026-02-15", "2026-11-11", W)).toBe(false); // 269
    expect(serviceFits("", "2026-11-11", W)).toBe(false);
  });

  it("keeps a diagnosis strictly between service and birth", () => {
    expect(diagnosisFits("2026-03-20", "2026-02-01", "2026-11-11")).toBe(true);
    expect(diagnosisFits("2026-02-01", "2026-02-01", "2026-11-11")).toBe(false);
    expect(diagnosisFits("2026-11-11", "2026-02-01", "2026-11-11")).toBe(false);
  });

  it("suggests dates that pass the rules", () => {
    const svc = suggestedServiceDate("2026-11-11", W);
    expect(serviceFits(svc, "2026-11-11", W)).toBe(true);
    expect(diagnosisFits(suggestedDiagnosisDate(svc, "2026-11-11"), svc, "2026-11-11")).toBe(true);
  });

  it("normalises a missing or swapped window", () => {
    expect(normaliseWindow(undefined, null)).toEqual(W);
    expect(normaliseWindow(300, 280)).toEqual({ minDays: 280, maxDays: 300 });
  });
});

describe("the retro steps", () => {
  const draft: RetroDraft = {
    serviceDate: "2026-02-01", serviceType: "A.I.", straw: "STRAW-1", strawWarehouse: "AI Store",
    withDiagnosis: true, diagnosisDate: "2026-03-10", herd: "In-calf",
  };

  it("is ready when every step holds", () => {
    expect(retroProblem(draft, "2026-11-11", W, true)).toBeNull();
  });

  it("names the step that is wrong", () => {
    expect(retroProblem({ ...draft, serviceDate: "2026-05-01" }, "2026-11-11", W, true)).toMatch(/^Step 1/);
    expect(retroProblem({ ...draft, diagnosisDate: "2026-01-01" }, "2026-11-11", W, true)).toMatch(/^Step 2/);
    expect(retroProblem({ ...draft, herd: "" }, "2026-11-11", W, true)).toMatch(/^Step 3/);
    expect(retroProblem(draft, "2026-11-11", W, false)).toMatch(/does not allow/);
    expect(retroProblem({ ...draft, withDiagnosis: false }, "2026-11-11", W, false)).toBeNull();
  });

  it("builds the payload record_birth takes", () => {
    expect(retroPayload(draft)).toEqual({
      service_date: "2026-02-01",
      service_type: "A.I.",
      sire: undefined,
      items: [{ item_code: "STRAW-1", qty: 1, source_warehouse: "AI Store" }],
      herd: "In-calf",
      remarks: undefined,
      diagnosis: { diagnosis_date: "2026-03-10" },
    });
    const natural = retroPayload({ ...draft, serviceType: "Natural", withDiagnosis: false, sire: " Kito " });
    expect(natural.items).toBeUndefined();
    expect(natural.diagnosis).toBeNull();
    expect(natural.sire).toBe("Kito");
  });
});

describe("refusals, stock and the backdated note", () => {
  it("turns a birth_needs_service refusal into a check", () => {
    const got = checkFromRefusal({
      error: "LE1 has no confirmed pregnancy", code: "birth_needs_service",
      window: { min_days: 270, max_days: 295 }, service_from: "2026-01-20", service_to: "2026-02-14",
      retro_allowed: false, retro_refusal: "Ask a manager", birth_date: "2026-11-11", allow_diagnosis: true,
    });
    expect(got).toMatchObject({ allowed: false, retro_allowed: false, retro_refusal: "Ask a manager" });
    expect(checkFromRefusal({ code: "other" })).toBeNull();
  });

  it("marks an item no store holds as out of stock", () => {
    expect(outOfStock({ value: "X", label: "X · out of stock", in_stock: false, locations: [] })).toBe(true);
    expect(outOfStock({ value: "Y", label: "Y", locations: [{ warehouse: "S", qty: 2 }] })).toBe(false);
  });

  it("says when saved records are backdated", () => {
    expect(backdatedNote([{ is_backdated: false }])).toBe("");
    expect(backdatedNote([{ is_backdated: true }])).toMatch(/this record is dated before today/);
    expect(backdatedNote([{ is_backdated: true }, {}])).toBe("1 of 2 records are marked Backdated.");
  });
});
