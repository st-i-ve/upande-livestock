import { heroInfo } from "@/src/heroInfo";

describe("the animal page's picture labels", () => {
  it("sex on the left, from either spelling", () => {
    expect(heroInfo({ sex: "M" }).sex).toEqual({ label: "Male", icon: "gender-male" });
    expect(heroInfo({ sex: "Female" }).sex).toEqual({ label: "Female", icon: "gender-female" });
    expect(heroInfo({ sex: "" }).sex).toBeNull();
  });
  it("breed then stream as chips", () => {
    expect(heroInfo({ sex: "M", breed: "Boran", stream: "Feedlot" }).chips).toEqual([
      { key: "breed", label: "Boran" },
      { key: "stream", label: "Feedlot" },
    ]);
  });
  it("leaves off a value that is not known", () => {
    expect(heroInfo({ breed: "  ", stream: null }).chips).toEqual([]);
    expect(heroInfo({ breed: null, stream: "Breeding" }).chips).toEqual([{ key: "stream", label: "Breeding" }]);
  });
});
