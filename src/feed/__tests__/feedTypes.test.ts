/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { RECORD_SECTIONS } from "../../recordSections.ts";
import { feedingTabs, isFeedRouteOn, mapFeedTypes, visibleFeedSections } from "../feedTypes.ts";

const labels = (sections: readonly { items: { label: string }[] }[]) => sections.flatMap((s) => s.items.map((i) => i.label));

const FEEDING = "Feeding";
const REPORT = "Daily feed report";

test("a server that sends nothing keeps today's screens: System and Manual on, no day sheet", () => {
  for (const raw of [undefined, null, {}, "x"]) {
    assert.deepEqual(mapFeedTypes(raw), { system: true, manual: true, day_sheet: false });
  }
  const shown = labels(visibleFeedSections(RECORD_SECTIONS, mapFeedTypes(undefined)));
  assert.ok(shown.includes(FEEDING));
  assert.ok(!shown.includes(REPORT));
  assert.deepEqual(feedingTabs(mapFeedTypes(undefined)), ["system", "manual"]);
});

test("reads the server's flags as booleans or 0/1, and a missing flag keeps its default", () => {
  assert.deepEqual(mapFeedTypes({ system: 1, manual: 0, day_sheet: 1 }), { system: true, manual: false, day_sheet: true });
  assert.deepEqual(mapFeedTypes({ system: false, manual: true, day_sheet: false }), { system: false, manual: true, day_sheet: false });
  assert.deepEqual(mapFeedTypes({ day_sheet: "1" }), { system: true, manual: true, day_sheet: true });
});

test("Kaitet's server turns Manual off and the day sheet on: the day sheet replaces Manual feeding", () => {
  const ft = mapFeedTypes({ system: 1, manual: 0, day_sheet: 1 });
  const shown = labels(visibleFeedSections(RECORD_SECTIONS, ft));
  assert.ok(shown.includes(FEEDING));
  assert.ok(shown.includes(REPORT));
  assert.deepEqual(feedingTabs(ft), ["system"]);
});

test("day sheet off removes its two entries and keeps the rest of the menu", () => {
  const shown = labels(visibleFeedSections(RECORD_SECTIONS, { system: true, manual: true, day_sheet: false }));
  assert.ok(!shown.includes(REPORT));
  assert.ok(shown.includes(FEEDING), "System and Manual keep the Feeding entry");
  assert.ok(shown.includes("Milk recording") && shown.includes("Weight recording"));
});

test("Animal feeding stays while System or Manual is on, and goes when both are off", () => {
  const animal = "/(tabs)/record/events/animal-feed";
  assert.equal(isFeedRouteOn(animal, { system: false, manual: true, day_sheet: false }), true);
  assert.equal(isFeedRouteOn(animal, { system: false, manual: false, day_sheet: true }), false);
  assert.equal(isFeedRouteOn("/(tabs)/record/events/weight", { system: false, manual: false, day_sheet: false }), true);
  assert.equal(isFeedRouteOn("animal-feed", null), true);
});

test("a section left empty by the filter is dropped", () => {
  const only = [{ title: "Feeding", items: [{ href: "/(tabs)/record/events/feed-day" }] }];
  assert.deepEqual(visibleFeedSections(only, { system: true, manual: true, day_sheet: false }), []);
});

test("one Feeding entry: on while any mode is on, gone when all are off", () => {
  const f = "/(tabs)/record/events/feeding";
  assert.equal(isFeedRouteOn(f, { system: false, manual: false, day_sheet: true }), true);
  assert.equal(isFeedRouteOn(f, { system: false, manual: false, day_sheet: false }), false);
  assert.equal(labels(RECORD_SECTIONS).filter((l) => l === "Feeding").length, 1);
});
