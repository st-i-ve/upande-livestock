import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { AnimalSilhouette } from "@/components/AnimalSilhouette";
import { SILHOUETTE_PATHS } from "@/src/art/paths";
import { CALF_DAYS, HEIFER_DAYS, POSES, pickSilhouette, silhouetteClass, tagHash } from "@/src/silhouettes";

// The same cases as the web app's frontend/src/lib/__tests__/silhouettes.test.tsx,
// so an animal wears the same picture on the phone and the desk.
const NOW = new Date("2026-11-11T00:00:00Z");
const born = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString().slice(0, 10);

describe("silhouetteClass", () => {
  it("sheep and goats by species, whatever else is known", () => {
    expect(silhouetteClass({ species: "Sheep", sex: "M", stage: "bull" }, NOW)).toBe("sheep");
    expect(silhouetteClass({ species: "Sheep", stage: "calf", dob: born(30) }, NOW)).toBe("sheep");
    expect(silhouetteClass({ species: "Goat", sex: "F", dob: born(CALF_DAYS) }, NOW)).toBe("goat");
    expect(silhouetteClass({ species: "Goats", sex: "M" }, NOW)).toBe("goat");
  });

  it("a young goat is a kid, by stage or by age, like a calf", () => {
    expect(silhouetteClass({ species: "Goat", sex: "F", dob: born(30) }, NOW)).toBe("goat-kid");
    expect(silhouetteClass({ species: "Goat", stage: "calf" }, NOW)).toBe("goat-kid");
    expect(silhouetteClass({ species: "Goat", repro: "Calf" }, NOW)).toBe("goat-kid");
  });

  it("a calf by stage, or by age under seven months", () => {
    expect(silhouetteClass({ sex: "M", stage: "calf" }, NOW)).toBe("calf");
    expect(silhouetteClass({ sex: "F", stage: "open", dob: born(CALF_DAYS - 1) }, NOW)).toBe("calf");
    expect(silhouetteClass({ sex: "M", stage: "open", dob: born(CALF_DAYS) }, NOW)).toBe("steer");
    expect(silhouetteClass({ sex: "F", repro: "Calf" }, NOW)).toBe("calf");
  });

  it("a male is a steer unless he is a breeding bull", () => {
    expect(silhouetteClass({ sex: "M", stage: "bull", dob: born(2000) }, NOW)).toBe("bull");
    for (const stage of ["weaner", "grower", "finisher", "market", "steer", "open", "retired", "heifer"]) {
      expect(silhouetteClass({ sex: "M", stage, dob: born(500) }, NOW)).toBe("steer");
    }
  });

  it("a female is a heifer until she has calved, or while young when the stage is not known", () => {
    expect(silhouetteClass({ sex: "F", stage: "heifer", dob: born(1500) }, NOW)).toBe("heifer");
    expect(silhouetteClass({ sex: "F", stage: "confirmed", dob: born(600) }, NOW)).toBe("cow");
    expect(silhouetteClass({ sex: "F", stage: "open", dob: born(HEIFER_DAYS - 1) }, NOW)).toBe("heifer");
    expect(silhouetteClass({ sex: "F", stage: "open", dob: born(HEIFER_DAYS) }, NOW)).toBe("cow");
    expect(silhouetteClass({ sex: "F", stage: "open" }, NOW)).toBe("cow");
  });

  it("reads the web's Male/Female as well as the phone's M/F", () => {
    expect(silhouetteClass({ sex: "Female", stage: "fresh" }, NOW)).toBe("cow");
    expect(silhouetteClass({ sex: "Male", stage: "bull" }, NOW)).toBe("bull");
  });

  it("sex not recorded is drawn as the feedlot's steer", () => {
    expect(silhouetteClass({ sex: null, stage: "unknown", dob: born(400) }, NOW)).toBe("steer");
  });
});

describe("pickSilhouette", () => {
  it("is stable for an animal and stays inside its class", () => {
    const a = { id: "A048/19", sex: "F", stage: "open", dob: born(2600) };
    const first = pickSilhouette(a, NOW);
    expect(POSES.cow).toContain(first);
    for (let i = 0; i < 5; i++) expect(pickSilhouette(a, NOW)).toBe(first);
    expect(pickSilhouette({ ...a, id: " a048/19 " }, NOW)).toBe(first);
  });

  it("spreads a herd of photo-less animals over every pose of the class", () => {
    const seen = new Set<string>();
    for (let n = 1; n <= 60; n++) {
      const id = `B${String(n).padStart(3, "0")}/24`;
      seen.add(pickSilhouette({ id, sex: "M", stage: "finisher", dob: born(500) }, NOW));
    }
    expect([...seen].sort()).toEqual([...POSES.steer].sort());
  });

  it("a breeding bull has the one pose", () => {
    expect(pickSilhouette({ id: "B001/19", sex: "M", stage: "bull" }, NOW)).toBe("bull");
  });

  it("hashes with FNV-1a 32-bit, as the web app does", () => {
    expect(tagHash("")).toBe(0x811c9dc5);
    expect(tagHash("a")).toBe(0xc40bf6cc); // FNV-1a of "A": the number is upper-cased first
    expect(tagHash("")).toBe(tagHash("   "));
    const h = tagHash("A001/20");
    expect(Number.isInteger(h) && h >= 0 && h < 2 ** 32).toBe(true);
  });
});

describe("the drawings", () => {
  it("has a traced path for every pose", () => {
    for (const name of Object.values(POSES).flat()) {
      const art = SILHOUETTE_PATHS[name];
      expect(art.d.startsWith("M")).toBe(true);
      expect(art.viewBox).toHaveLength(4);
    }
  });

  it("sheep and goats wear their own drawings, never the calf's", () => {
    expect(POSES.sheep).toEqual(["sheep"]);
    expect(POSES.goat).toEqual(["goat"]);
    expect(POSES["goat-kid"]).toEqual(["goat-kid"]);
    expect(pickSilhouette({ id: "S1", species: "Sheep" }, NOW)).toBe("sheep");
    expect(pickSilhouette({ id: "G1", species: "Goat", dob: born(900) }, NOW)).toBe("goat");
    expect(pickSilhouette({ id: "G2", species: "Goat", dob: born(20) }, NOW)).toBe("goat-kid");
    for (const p of ["sheep", "goat", "goat-kid"] as const) expect(SILHOUETTE_PATHS[p].d.length).toBeGreaterThan(100);
  });

  it("renders the picked pose in the colour it is given", () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<AnimalSilhouette animal={{ id: "B001/19", sex: "M", stage: "bull" }} color="#123456" />);
    });
    expect(r.root.findAll((n) => n.props.testID === "silhouette-bull").length).toBeGreaterThan(0);
    expect(r.root.findAll((n) => n.props.fill === "#123456").length).toBeGreaterThan(0);
  });
});
