import {
  NOTE_MIN_LENGTH,
  isSelectionMove,
  selectionAnimals,
  selectionNoteError,
} from "@/src/beef/breeding";
import type { Animal, Herd } from "@/types";

const herd = (n: string, isBreeding = false): Herd => ({ n, cat: "", cnt: 0, hasBom: false, isBreeding });
const HERDS = [herd("Calves"), herd("Starters"), herd("Bull Reserve", true), herd("Lactation Group 1", true)];
const animal = (id: string, sex: "M" | "F", h: string) => ({ id, name: id, sex, herd: h }) as Animal;

describe("selection move", () => {
  it("a bull calf into a breeding herd is a selection", () => {
    expect(isSelectionMove(animal("B1", "M", "Calves"), "Bull Reserve", HERDS)).toBe(true);
  });
  it("a feedlot bull into a breeding herd is a selection too", () => {
    expect(isSelectionMove(animal("B1", "M", "Starters"), "Lactation Group 1", HERDS)).toBe(true);
  });
  it("breeding herd to breeding herd (rotation) is not", () => {
    expect(isSelectionMove(animal("B1", "M", "Bull Reserve"), "Lactation Group 1", HERDS)).toBe(false);
  });
  it("a female never needs a note", () => {
    expect(isSelectionMove(animal("A1", "F", "Calves"), "Lactation Group 1", HERDS)).toBe(false);
  });
  it("a calf to the feedlot is not a selection", () => {
    expect(isSelectionMove(animal("B1", "M", "Calves"), "Starters", HERDS)).toBe(false);
  });
  it("selectionAnimals keeps only the bulls being selected", () => {
    const sel = [animal("B1", "M", "Calves"), animal("A1", "F", "Calves"), animal("B2", "M", "Bull Reserve")];
    expect(selectionAnimals(sel, "Lactation Group 1", HERDS).map((a) => a.id)).toEqual(["B1"]);
  });
});

describe("selection note", () => {
  it("needs at least 20 characters, trimmed", () => {
    expect(NOTE_MIN_LENGTH).toBe(20);
    expect(selectionNoteError("")).toMatch(/Describe the bull/);
    expect(selectionNoteError("x".repeat(19))).not.toBeNull();
    expect(selectionNoteError(" ".repeat(10) + "x".repeat(10))).not.toBeNull();
    expect(selectionNoteError("x".repeat(20))).toBeNull();
  });
});
