import fs from "fs";
import path from "path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { GRASS_SWAY, LivestockLogo, TAIL_SWING } from "@/components/LivestockLogo";
import { LOGO_COW } from "@/src/art/paths";

jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
// Reanimated 4.7 (SDK 58) registers its CSS event handler on load, which the
// JS (non-native) module that Jest gets refuses; on a phone the native module takes it.
jest.mock("react-native-reanimated/src/css/native/proxy", () => ({
  ...jest.requireActual("react-native-reanimated/src/css/native/proxy"),
  setCSSEventHandler: () => {},
}));
jest.mock("react-native-reanimated", () => ({ ...require("react-native-reanimated/mock"), useReducedMotion: () => false }));

const root = path.resolve(__dirname, "..");

describe("Livestock logo", () => {
  it("draws the traced cow in her traced grass, a few blades in front of her hooves", () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<LivestockLogo size={120} animated />);
    });
    const ds = r.root.findAll((n) => typeof n.props.d === "string").map((n) => n.props.d);
    expect(ds).toContain(LOGO_COW.body);
    expect(ds).toContain(LOGO_COW.tail);
    expect(ds).toContain(LOGO_COW.grass);
    expect(ds).toContain(LOGO_COW.grassFront);
    // back to front: grass, body, tail, front blades
    expect(ds.indexOf(LOGO_COW.grass)).toBeLessThan(ds.indexOf(LOGO_COW.body));
    expect(ds.indexOf(LOGO_COW.grassFront)).toBeGreaterThan(ds.indexOf(LOGO_COW.tail));
    act(() => r.unmount());
  });

  it("swings the tail as the web does: out and back twice, settling at rest", () => {
    expect(TAIL_SWING.map(([, d]) => d)).toEqual([0, 0, 7, -2, 5, -1, 0, 0]);
    expect(TAIL_SWING[0][0]).toBe(0);
    expect(TAIL_SWING[TAIL_SWING.length - 1][0]).toBe(1);
  });

  it("sways the grass very slightly with the tail: at most 2 degrees", () => {
    expect(Math.max(...TAIL_SWING.map(([, d]) => Math.abs(d * GRASS_SWAY)))).toBeCloseTo(2);
  });

  it("app.json's icon, adaptive icon and splash are SCP's Upande logo files, the monochrome the arrow in black, and they exist", () => {
    const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo;
    const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen")[1];
    expect(app.icon).toBe("./assets/images/upande_logo_no_bg.png");
    expect(app.android.adaptiveIcon.foregroundImage).toBe("./assets/images/upande_logo.png");
    expect(splash.image).toBe("./assets/images/upande_logo_no_bg.png");
    expect(app.android.adaptiveIcon.monochromeImage).toBe("./assets/images/livestock-adaptive-monochrome.png");
    for (const f of [app.icon, app.android.adaptiveIcon.foregroundImage, app.android.adaptiveIcon.monochromeImage, splash.image]) {
      expect(fs.existsSync(path.join(root, f))).toBe(true);
    }
  });
});
