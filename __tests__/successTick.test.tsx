import React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated/src/css/native/proxy", () => ({
  ...jest.requireActual("react-native-reanimated/src/css/native/proxy"),
  setCSSEventHandler: () => {},
}));
let mockReduceMotion = false;
jest.mock("react-native-reanimated", () => ({
  ...require("react-native-reanimated/mock"),
  useReducedMotion: () => mockReduceMotion,
}));

import { SUCCESS_TICK_MS, SuccessTick } from "@/components/SuccessTick";
import { DARK, LIGHT } from "@/constants/theme";

let mockScheme: "light" | "dark" = "light";
jest.mock("@/src/theme/themeStore", () => ({ useScheme: () => mockScheme }));

const strokes = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll((n) => typeof n.props.d === "string" && typeof n.props.stroke === "string").map((n) => n.props.stroke);

describe("SuccessTick", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("shows the line and closes itself after ~1.5 s, once", () => {
    const done = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<SuccessTick visible message="Weight saved — 312 kg for LE151" onDone={done} />);
    });
    expect(JSON.stringify(r.toJSON())).toContain("Weight saved — 312 kg for LE151");
    act(() => jest.advanceTimersByTime(SUCCESS_TICK_MS - 100));
    expect(done).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(200));
    expect(done).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });

  it("a tap closes it at once, and the timer does not call again", () => {
    const done = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<SuccessTick visible message="Saved" onDone={done} />);
    });
    const scrim = r.root.findAll((n) => n.props.accessibilityLabel === "Saved. Tap to continue." && n.props.onPress)[0];
    act(() => scrim.props.onPress());
    act(() => jest.advanceTimersByTime(SUCCESS_TICK_MS * 2));
    expect(done).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });

  it("black ink on light, white on dark", () => {
    for (const [s, ink] of [["light", LIGHT.text], ["dark", DARK.text]] as const) {
      mockScheme = s;
      let r!: TestRenderer.ReactTestRenderer;
      act(() => {
        r = TestRenderer.create(<SuccessTick visible message="Saved" onDone={() => {}} />);
      });
      expect(strokes(r)).toContain(ink);
      act(() => r.unmount());
    }
    mockScheme = "light";
  });

  it("reduce motion: still shown, still closes", () => {
    mockReduceMotion = true;
    const done = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<SuccessTick visible message="Saved" onDone={done} />);
    });
    expect(r.root.findAll((n) => n.props.testID === "success-tick").length).toBeGreaterThan(0);
    act(() => jest.advanceTimersByTime(SUCCESS_TICK_MS));
    expect(done).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
    mockReduceMotion = false;
  });
});
