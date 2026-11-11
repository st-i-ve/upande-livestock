import { draftHref, hasInput, isTabRoot, useRecordDrafts } from "@/src/record/draft";
import { lockedAnimalId } from "@/src/record/locked";

const store = () => useRecordDrafts.getState();
const weight = { key: "/(tabs)/record/events/weight", href: "/(tabs)/record/events/weight", title: "Weight" };
const treat = { key: "/(tabs)/record/events/treatment", href: "/(tabs)/record/events/treatment", title: "Treatment" };

beforeEach(() => useRecordDrafts.setState({ draft: null }));

describe("record draft store", () => {
  it("saves a live draft and keeps it when its tab loses focus", () => {
    store().save({ ...weight, state: { kg: "312" } });
    expect(store().draft?.pending).toBe(false);
    store().markPending();
    expect(store().draft).toMatchObject({ key: weight.key, pending: true, state: { kg: "312" } });
    // The form unmounting after the tab popped does not drop a pending draft.
    store().dropLive(weight.key);
    expect(store().draft?.pending).toBe(true);
  });

  it("drops a live draft whose form closed without a tab switch", () => {
    store().save({ ...weight, state: { kg: "312" } });
    store().dropLive(weight.key);
    expect(store().draft).toBeNull();
  });

  it("restores: resume makes the pending draft live again", () => {
    store().save({ ...weight, state: { kg: "312" } });
    store().markPending();
    store().resume(weight.key);
    expect(store().draft).toMatchObject({ pending: false, state: { kg: "312" } });
  });

  it("a re-render after the blur does not turn the draft live again", () => {
    store().save({ ...weight, state: { kg: "312" } });
    store().markPending();
    store().save({ ...weight, state: { kg: "313" } });
    expect(store().draft).toMatchObject({ pending: true, state: { kg: "313" } });
  });

  it("resume and dropLive ignore another record's draft", () => {
    store().save({ ...weight, state: {} });
    store().markPending();
    store().resume(treat.key);
    store().dropLive(treat.key);
    expect(store().draft).toMatchObject({ key: weight.key, pending: true });
  });

  it("holds one draft at a time: the latest", () => {
    store().save({ ...weight, state: { kg: "1" } });
    store().markPending();
    store().clear(weight.key);
    store().save({ ...treat, state: { complaint: "lame" } });
    expect(store().draft).toMatchObject({ key: treat.key, pending: false });
  });

  it("clears on save (any) or by key (only that one)", () => {
    store().save({ ...weight, state: {} });
    store().clear(treat.key);
    expect(store().draft).not.toBeNull();
    store().clear();
    expect(store().draft).toBeNull();
  });

  it("markPending with nothing open does nothing", () => {
    store().markPending();
    expect(store().draft).toBeNull();
  });
});

describe("draftHref", () => {
  it("keeps the group and fills dynamic segments", () => {
    expect(draftHref(["(tabs)", "record", "events", "[type]"], { type: "heat" })).toBe("/(tabs)/record/events/heat");
  });
  it("puts other params in a sorted query", () => {
    expect(draftHref(["(tabs)", "animals", "act", "[type]"], { type: "deworming", locked: "1", animal: "A011/26" })).toBe(
      "/(tabs)/animals/act/deworming?animal=A011%2F26&locked=1",
    );
  });
  it("tells one animal's form from another's", () => {
    const a = draftHref(["(tabs)", "animals", "act", "weight"], { animal: "A1" });
    const b = draftHref(["(tabs)", "animals", "act", "weight"], { animal: "A2" });
    expect(a).not.toBe(b);
  });
});

describe("hasInput", () => {
  const cow = { id: "A1", name: "Diego" };
  it("blank values are not input", () => {
    expect(hasInput({ selected: [], remarks: "  ", photo: null, again: new Set(), entries: {} })).toBe(false);
  });
  it("a picked animal or a typed field is", () => {
    expect(hasInput({ selected: [cow] })).toBe(true);
    expect(hasInput({ remarks: "limping" })).toBe(true);
    expect(hasInput({ entries: { A1: { weight: "300", girth: "" } } })).toBe(true);
  });
  it("the animal a quick action opened the form for is not input", () => {
    expect(hasInput({ selected: [cow], remarks: "" }, "A1")).toBe(false);
    expect(hasInput({ animal: cow }, "A1")).toBe(false);
    expect(hasInput({ selected: [cow, { id: "A2" }] }, "A1")).toBe(true);
  });
  it("a row's own id is not input", () => {
    expect(hasInput({ drugs: [{ id: 3, itemCode: "", qty: "" }] })).toBe(false);
  });
});

describe("isTabRoot", () => {
  it("is a group plus one segment", () => {
    expect(isTabRoot(["(tabs)", "animals"])).toBe(true);
    expect(isTabRoot(["(shoats)", "profile", "index"])).toBe(true);
    expect(isTabRoot(["(tabs)", "animals", "[id]"])).toBe(false);
  });
});

describe("lockedAnimalId", () => {
  const act = ["(tabs)", "animals", "act", "weight"];
  const rec = ["(tabs)", "record", "events", "weight"];
  it("locks a quick action opened from an animal", () => {
    expect(lockedAnimalId({ animal: "A011%2F26" }, act)).toBe("A011/26");
    expect(lockedAnimalId({ animal: "A011/26" }, act)).toBe("A011/26");
  });
  it("leaves the Record tab free", () => {
    expect(lockedAnimalId({}, rec)).toBeNull();
    expect(lockedAnimalId({ animal: "A1" }, rec)).toBeNull();
  });
  it("needs an animal to lock to", () => {
    expect(lockedAnimalId({}, act)).toBeNull();
    expect(lockedAnimalId({ locked: "1" }, rec)).toBeNull();
  });
  it("honours locked=1 anywhere and locked=0 to unlock", () => {
    expect(lockedAnimalId({ animal: "A1", locked: "1" }, rec)).toBe("A1");
    expect(lockedAnimalId({ animal: "A1", locked: "0" }, act)).toBeNull();
  });
  it("survives a malformed id", () => {
    expect(lockedAnimalId({ animal: "A%ZZ" }, act)).toBe("A%ZZ");
  });
});
