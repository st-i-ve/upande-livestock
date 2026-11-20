/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import type { Capabilities } from "../../auth/can.ts";
import { FEEDING_TABS, feedingScreenTabs, pickFeedingTab } from "../feedingTabs.ts";

const caps = (o: { read?: string[]; create?: string[]; stock?: boolean }): Capabilities => {
  const m = (n: string[] = []) => Object.fromEntries(n.map((x) => [x, true]));
  return {
    read: m(o.read), create: m(o.create), write: {}, stock: !!o.stock, post_draft: false, override_feed: false,
    insure: false, accounts: false, appreciate: false, cull_vet: false, cull_manager: false, quality: false, operator: false,
  };
};
const ALL = { system: true, manual: true, day_sheet: true };

test("the desk's tab order and labels", () => {
  assert.deepEqual(FEEDING_TABS.map((t) => t.label), ["System", "Manual configuration", "Day sheet"]);
  assert.deepEqual(feedingScreenTabs(ALL, null), ["system", "manual", "day_sheet"]);
});

test("only the tabs the farm switched on", () => {
  assert.deepEqual(feedingScreenTabs({ system: true, manual: false, day_sheet: true }, null), ["system", "day_sheet"]);
  assert.deepEqual(feedingScreenTabs({ system: false, manual: false, day_sheet: false }, null), []);
});

test("a tab the role cannot use is hidden", () => {
  const stores = caps({ read: ["Herds"], stock: true });
  assert.deepEqual(feedingScreenTabs(ALL, stores), ["system", "manual", "day_sheet"]);
  const recorder = caps({ read: ["Herds"], create: ["Livestock Feed Actual"] });
  assert.deepEqual(feedingScreenTabs(ALL, recorder), ["day_sheet"]);
  assert.deepEqual(feedingScreenTabs(ALL, caps({ read: ["Herds"] })), []);
});

test("opens the asked tab, else the last used, else the first; never a hidden one", () => {
  const shown = ["system", "day_sheet"] as const;
  assert.equal(pickFeedingTab(shown, "day_sheet", "system"), "day_sheet");
  assert.equal(pickFeedingTab(shown, undefined, "day_sheet"), "day_sheet");
  assert.equal(pickFeedingTab(shown, "manual", "manual"), "system");
  assert.equal(pickFeedingTab([], "system"), null);
});
