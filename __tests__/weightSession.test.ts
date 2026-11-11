import type { WeightOutcome } from "@/src/frappe/weights";
import { formAfterSave, savedMessage, savedWeights } from "@/src/weights/session";

const a = (id: string) => ({ id, name: id });
const entry = (weight: string) => ({ weight, girth: "", bcs: "" });
const outcome = (recorded: string[], failed: string[] = []): WeightOutcome => ({
  count: recorded.length,
  recorded: recorded.map((animal) => ({ animal })),
  skipped: [],
  failed: failed.map((animal) => ({ animal, why: "no" })),
});

describe("Record → Weight after a save", () => {
  const form = {
    selected: [a("LE151"), a("LE152")],
    entries: { LE151: entry("312"), LE152: entry("290,5") },
    groupFigure: "600",
  };

  it("all saved: the form is cleared for the next animal", () => {
    expect(formAfterSave(form, outcome(["LE151", "LE152"]))).toEqual({ selected: [], entries: {}, groupFigure: "" });
  });

  it("some refused: only those stay, with their figures", () => {
    const next = formAfterSave(form, outcome(["LE151"], ["LE152"]));
    expect(next.selected.map((x) => x.id)).toEqual(["LE152"]);
    expect(next.entries).toEqual({ LE152: entry("290,5") });
    expect(next.groupFigure).toBe("");
  });

  it("the kilos written to the local rows, per mode", () => {
    const o = outcome(["LE151", "LE152"]);
    expect(savedWeights("each", form, o)).toEqual([{ id: "LE151", kg: 312 }, { id: "LE152", kg: 290.5 }]);
    expect(savedWeights("platform", form, o)).toEqual([{ id: "LE151", kg: 300 }, { id: "LE152", kg: 300 }]);
    expect(savedWeights("alike", form, o)).toEqual([{ id: "LE151", kg: 600 }, { id: "LE152", kg: 600 }]);
  });

  it("the line under the tick", () => {
    expect(savedMessage([{ id: "LE151", kg: 312 }], form.selected)).toBe("Weight saved — 312 kg for LE151");
    expect(savedMessage([{ id: "LE151", kg: 312 }, { id: "LE152", kg: 290.5 }], form.selected)).toBe(
      "2 weights saved — LE151, LE152",
    );
    expect(savedMessage([], form.selected)).toBe("Weights saved");
  });
});
