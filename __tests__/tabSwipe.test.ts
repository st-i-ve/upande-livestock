import { adjacentTab, atTabRoot } from "@/components/TabSwipe";

const routes = [{ name: "animals" }, { name: "record" }, { name: "profile" }];
const shoats = [{ name: "herds" }, { name: "record" }, { name: "profile/index" }];

describe("adjacentTab", () => {
  it("moves to the next and previous tab", () => {
    expect(adjacentTab(routes, "animals", 1)?.name).toBe("record");
    expect(adjacentTab(routes, "profile", -1)?.name).toBe("record");
    expect(adjacentTab(routes, "record", 1)?.name).toBe("profile");
  });
  it("stops at either end", () => {
    expect(adjacentTab(routes, "animals", -1)).toBeUndefined();
    expect(adjacentTab(routes, "profile", 1)).toBeUndefined();
  });
  it("skips a hidden Record tab", () => {
    expect(adjacentTab(routes, "animals", 1, ["record"])?.name).toBe("profile");
    expect(adjacentTab(shoats, "profile/index", -1, ["record"])?.name).toBe("herds");
  });
  it("matches hidden names with a nested index", () => {
    expect(adjacentTab(shoats, "herds", 1, ["profile"])?.name).toBe("record");
    expect(adjacentTab(shoats, "record", 1, ["profile"])).toBeUndefined();
  });
});

describe("atTabRoot", () => {
  it("is true for a tab without a stack or on its first screen", () => {
    expect(atTabRoot({})).toBe(true);
    expect(atTabRoot({ state: { index: 0 } })).toBe(true);
  });
  it("is false once a screen is pushed", () => {
    expect(atTabRoot({ state: { index: 1 } })).toBe(false);
  });
});

describe("atTabRoot at depth", () => {
  it("is false when a stack nested inside the tab has a screen pushed", () => {
    expect(atTabRoot({ state: { index: 0, routes: [{ state: { index: 1 } }] } })).toBe(false);
    expect(atTabRoot({ state: { index: 0, routes: [{ state: { index: 0 } }] } })).toBe(true);
  });
});
