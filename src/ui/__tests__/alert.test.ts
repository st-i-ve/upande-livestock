import { beforeEach, describe, expect, it } from "../../__tests__/jestLike.ts";
import { backAction, showAppAlert, useAppAlerts } from "../alertCore.ts";

const q = () => useAppAlerts.getState().queue;

describe("app alert queue and buttons", () => {
  beforeEach(() => useAppAlerts.setState({ queue: [] }));

  it("gives one OK when there are no buttons", () => {
    showAppAlert("Saved");
    expect(q()[0].buttons).toEqual([{ text: "OK" }]);
    expect(q()[0].message).toBe(undefined);
    showAppAlert("A", "", []);
    expect(q()[1].buttons).toEqual([{ text: "OK" }]);
  });

  it("keeps buttons in order with their styles and fills missing text", () => {
    showAppAlert("T", "m", [{ text: "Keep", style: "cancel" }, { text: "Del", style: "destructive" }, {}]);
    expect(q()[0].buttons.map((b) => [b.text, b.style])).toEqual([["Keep", "cancel"], ["Del", "destructive"], ["OK", undefined]]);
  });

  it("queues in order and shift removes by id", () => {
    showAppAlert("First");
    showAppAlert("Second");
    expect(q().map((a) => a.title)).toEqual(["First", "Second"]);
    useAppAlerts.getState().shift(q()[0].id);
    expect(q().map((a) => a.title)).toEqual(["Second"]);
  });

  it("back: cancelable dismisses, else the cancel button, else nothing", () => {
    showAppAlert("a", null, [{ text: "x" }], { cancelable: true });
    expect(backAction(q()[0])).toBe("dismiss");
    showAppAlert("b", null, [{ text: "Stay", style: "cancel" }, { text: "Go" }]);
    expect((backAction(q()[1]) as { text: string }).text).toBe("Stay");
    showAppAlert("c", null, [{ text: "A" }, { text: "B" }]);
    expect(backAction(q()[2])).toBe(null);
  });
});
