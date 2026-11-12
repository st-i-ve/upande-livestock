import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { LivestockLogo, tileFrame } from "@/components/LivestockLogo";
import { LOGO_COW, LOGO_MOTION, UPANDE_ARROW } from "@/src/art/paths";
import { HOLD_MAX_MS, nextPhase, sceneOf, useLoginExit, useLoginLogo, type LogoPhase } from "@/src/logo/loginLogo";
import { cubicBezier, sample } from "@/src/logo/motion";

jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated/src/css/native/proxy", () => ({
  ...jest.requireActual("react-native-reanimated/src/css/native/proxy"),
  setCSSEventHandler: () => {},
}));
jest.mock("react-native-reanimated", () => ({ ...require("react-native-reanimated/mock"), useReducedMotion: () => false }));

describe("login logo phases", () => {
  it("idle → playing → cow → returning → upande → navigate", () => {
    const seen: LogoPhase[] = ["idle"];
    for (const e of ["appear", "entered", "loggedIn", "returned", "settled"] as const) {
      seen.push(nextPhase(seen[seen.length - 1], e, false));
    }
    expect(seen).toEqual(["idle", "playing", "cow", "returning", "upande", "navigate"]);
  });

  it("a login while the scene is still coming in turns it round", () => {
    expect(nextPhase("playing", "loggedIn", false)).toBe("returning");
    // the in finishing late does not undo the turn
    expect(nextPhase("returning", "entered", false)).toBe("returning");
  });

  it("reduce-motion: the Upande mark throughout, and a login moves on at once", () => {
    expect(nextPhase("idle", "appear", true)).toBe("idle");
    expect(nextPhase("idle", "loggedIn", true)).toBe("navigate");
    expect(sceneOf("idle")).toBe("upande");
  });

  it("draws the Upande mark at rest, the scene in, the cow, and the scene out", () => {
    expect((["idle", "playing", "cow", "returning", "upande", "navigate"] as const).map(sceneOf)).toEqual([
      "upande", "in", "cow", "out", "upande", "upande",
    ]);
  });
});

describe("the desk tile's keyframes on the phone", () => {
  it("rests on the Upande mark and comes in to the scene", () => {
    const rest = tileFrame(0);
    expect(rest).toMatchObject({ arrowScale: 1, arrowOpacity: 1, sceneOpacity: 0, grassReveal: 0, cowOpacity: 0 });
    const scene = tileFrame(1);
    expect(scene).toMatchObject({ arrowScale: 0, arrowOpacity: 0, sceneOpacity: 1, cowOpacity: 1 });
    expect(scene.cowShift).toBeCloseTo(0);
    expect(scene.grassReveal).toBeCloseTo(1.1);
    // she starts 120 units to the left (in the cow group's 1.05 scale)
    expect(rest.cowShift).toBeCloseTo(-126);
  });

  it("uses the tile's timings and easing: 720 ms in, a 2.56 s round, cubic-bezier(.3,.7,.2,1)", () => {
    expect([LOGO_MOTION.enterMs, LOGO_MOTION.loopMs, LOGO_MOTION.cycleMs]).toEqual([720, 2560, 4000]);
    expect(LOGO_MOTION.ease).toEqual([0.3, 0.7, 0.2, 1]);
  });

  it("eases each segment as CSS does", () => {
    const e = LOGO_MOTION.ease;
    expect(cubicBezier(e[0], e[1], e[2], e[3], 0)).toBe(0);
    expect(cubicBezier(e[0], e[1], e[2], e[3], 1)).toBe(1);
    // ease-out-ish: well past halfway at the middle of the segment
    expect(cubicBezier(e[0], e[1], e[2], e[3], 0.5)).toBeGreaterThan(0.8);
    let last = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = cubicBezier(e[0], e[1], e[2], e[3], t);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    // a value is held flat between equal stops, and exact at each stop
    expect(sample(LOGO_MOTION.cowShift, 0.2, e)).toBe(-120);
    expect(sample(LOGO_MOTION.arrowScale, 0.45, e)).toBe(0);
  });
});

describe("holding the next screen", () => {
  afterEach(() => useLoginExit.getState().release());

  it("lets go after HOLD_MAX_MS at the latest", () => {
    jest.useFakeTimers();
    useLoginExit.getState().hold();
    expect(useLoginExit.getState().holding).toBe(true);
    act(() => jest.advanceTimersByTime(HOLD_MAX_MS + 1));
    expect(useLoginExit.getState().holding).toBe(false);
    jest.useRealTimers();
  });

  it("the login screen's logo holds until it has played back to the Upande mark", () => {
    let api!: ReturnType<typeof useLoginLogo>;
    function Probe() {
      api = useLoginLogo(false);
      return null;
    }
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<Probe />);
    });
    expect(api.phase).toBe("playing");
    act(() => api.send("entered"));
    expect(api.phase).toBe("cow");
    useLoginExit.getState().hold();
    act(() => api.send("loggedIn"));
    expect(api.phase).toBe("returning");
    expect(useLoginExit.getState().holding).toBe(true);
    act(() => api.send("returned"));
    expect(api.phase).toBe("navigate");
    expect(useLoginExit.getState().holding).toBe(false);
    act(() => r.unmount());
  });

  it("the login logo draws the Upande arrow over the cow scene", () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<LivestockLogo size={120} scene="upande" />);
    });
    const ds = r.root.findAll((n) => typeof n.props.d === "string").map((n) => n.props.d);
    for (const [, d] of UPANDE_ARROW.paths) expect(ds).toContain(d);
    expect(ds).toContain(LOGO_COW.body);
    // the arrow is drawn last, on top
    expect(ds.indexOf(UPANDE_ARROW.paths[0][1])).toBeGreaterThan(ds.indexOf(LOGO_COW.grassFront));
    act(() => r.unmount());
  });
});
