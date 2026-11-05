import { kindOf } from "@/src/animalKind";
import { STAGE_LABELS } from "@/services/utils";
import { sexMatches } from "@/src/stores/animalSexFilter";

describe("male stages", () => {
  it("labels every server stage", () => {
    for (const k of ["fresh", "open", "served", "confirmed", "dry", "heifer", "calf", "weaner", "grower", "finisher", "market", "steer", "bull", "unknown", "retired"]) {
      expect(STAGE_LABELS[k]).toBeTruthy();
    }
  });
  it("picks the placeholder by sex and stage, never a heifer for a male", () => {
    expect(kindOf({ sex: "M", stage: "bull" })).toBe("bull");
    expect(kindOf({ sex: "M", stage: "steer" })).toBe("steer");
    expect(kindOf({ sex: "M", stage: "grower" })).toBe("steer");
    expect(kindOf({ sex: "M", stage: "heifer" })).toBe("steer");
    expect(kindOf({ sex: "M", stage: "calf" })).toBe("calf");
    expect(kindOf({ sex: "F", stage: "heifer" })).toBe("heifer");
    expect(kindOf({ sex: "F", stage: "open" })).toBe("cow");
  });
  it("filters Bulls as every male", () => {
    expect(sexMatches("bulls", "M")).toBe(true);
    expect(sexMatches("bulls", "F")).toBe(false);
    expect(sexMatches("cows", "M")).toBe(false);
    expect(sexMatches("all", "M")).toBe(true);
  });
});
