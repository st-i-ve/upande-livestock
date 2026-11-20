/// <reference types="node" />
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { LOGO_COW, LOGO_MOTION } from "../../art/paths.ts";
import { HOLD_MAX_MS, nextPhase, sceneOf, useLoginExit, type LogoPhase } from "../loginLogo.ts";
import { cubicBezier, sample } from "../motion.ts";

test("idle, playing, cow, returning, upande, navigate", () => {
  const seen: LogoPhase[] = ["idle"];
  for (const e of ["appear", "entered", "loggedIn", "returned", "settled"] as const) {
    seen.push(nextPhase(seen[seen.length - 1], e, false));
  }
  assert.deepEqual(seen, ["idle", "playing", "cow", "returning", "upande", "navigate"]);
});

test("the preview goes back to the Upande mark and a tap plays it again", () => {
  const seen: LogoPhase[] = ["idle"];
  for (const e of ["appear", "entered", "previewDone", "returned", "replay"] as const) {
    seen.push(nextPhase(seen[seen.length - 1], e, false));
  }
  assert.deepEqual(seen, ["idle", "playing", "cow", "leaving", "rest", "playing"]);
  assert.equal(nextPhase("cow", "replay", false), "cow");
});

test("a login at rest moves on at once; during the scene it plays out first", () => {
  assert.equal(nextPhase("rest", "loggedIn", false), "navigate");
  assert.equal(nextPhase("leaving", "loggedIn", false), "returning");
  assert.equal(nextPhase("playing", "loggedIn", false), "returning");
  assert.equal(nextPhase("returning", "entered", false), "returning");
});

test("reduce-motion keeps the Upande mark and a login moves on at once", () => {
  assert.equal(nextPhase("idle", "appear", true), "idle");
  assert.equal(nextPhase("idle", "loggedIn", true), "navigate");
  assert.equal(sceneOf("idle"), "upande");
});

test("the scene drawn in each phase", () => {
  const phases = ["idle", "playing", "cow", "leaving", "rest", "returning", "upande", "navigate"] as const;
  assert.deepEqual(phases.map(sceneOf), ["upande", "in", "cow", "out", "upande", "out", "upande", "upande"]);
});

test("the desk tile's timings, easing and tail swing", () => {
  assert.deepEqual([LOGO_MOTION.enterMs, LOGO_MOTION.loopMs, LOGO_MOTION.cycleMs], [720, 2560, 4000]);
  assert.deepEqual([...LOGO_MOTION.ease], [0.3, 0.7, 0.2, 1]);
  assert.deepEqual(LOGO_MOTION.tail.map(([, d]) => d), [0, 0, 7, -2, 5, -1, 0, 0]);
  assert.ok(LOGO_COW.body && LOGO_COW.tail && LOGO_COW.grass && LOGO_COW.grassFront);
});

test("keyframes are eased as CSS does", () => {
  const e = LOGO_MOTION.ease;
  assert.equal(cubicBezier(e[0], e[1], e[2], e[3], 0), 0);
  assert.equal(cubicBezier(e[0], e[1], e[2], e[3], 1), 1);
  assert.ok(cubicBezier(e[0], e[1], e[2], e[3], 0.5) > 0.8);
  assert.equal(sample(LOGO_MOTION.cowShift, 0.2, e), -120);
  assert.equal(sample(LOGO_MOTION.arrowScale, 0.45, e), 0);
});

test("the login hold lets go after HOLD_MAX_MS at the latest", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  useLoginExit.getState().hold();
  assert.equal(useLoginExit.getState().holding, true);
  t.mock.timers.tick(HOLD_MAX_MS + 1);
  assert.equal(useLoginExit.getState().holding, false);
});

test("app.json's icon, adaptive icon and splash are the Upande logo files and exist", () => {
  const root = path.resolve(import.meta.dirname, "../../..");
  const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo;
  const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen")[1];
  assert.equal(app.icon, "./assets/images/upande_logo_no_bg.png");
  assert.equal(app.android.adaptiveIcon.foregroundImage, "./assets/images/upande_logo.png");
  assert.equal(app.android.adaptiveIcon.monochromeImage, "./assets/images/livestock-adaptive-monochrome.png");
  assert.equal(splash.image, "./assets/images/upande_logo_no_bg.png");
  for (const f of [app.icon, app.android.adaptiveIcon.foregroundImage, app.android.adaptiveIcon.monochromeImage, splash.image]) {
    assert.ok(fs.existsSync(path.join(root, f)), f);
  }
});
