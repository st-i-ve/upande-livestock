/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { EVENT_CATALOG, eventEntry, sortByEvent } from "../eventCatalog.ts";
import { RECORD_SECTIONS } from "../../recordSections.ts";

test("servicing runs heat, service, PD, abortion, calving, birth; health runs check-up, case files, treatment", () => {
  const keys = (g: string) => EVENT_CATALOG.filter((e) => e.group === g).map((e) => e.key);
  assert.deepEqual(keys("servicing"), ["Heat Detection", "Service", "Pregnancy Diagnosis", "Abortion", "Calving", "Birth"]);
  assert.deepEqual(keys("health"), ["Check Up", "Health Case", "Treatment"]);
  assert.equal(EVENT_CATALOG.findIndex((e) => e.group === "quality") > EVENT_CATALOG.findIndex((e) => e.key === "Treatment"), true);
});

test("sortByEvent follows the catalog and keeps unknown items last, in order", () => {
  const out = sortByEvent(["x", "Treatment", "Service", "y", "Check Up"], (t) => t);
  assert.deepEqual(out, ["Service", "Check Up", "Treatment", "x", "y"]);
});

test("the Record menu leads with Servicing then Health, in catalog order, with desk icons", () => {
  assert.deepEqual(RECORD_SECTIONS.slice(0, 2).map((s) => s.title), ["Servicing", "Health"]);
  assert.deepEqual(RECORD_SECTIONS[0].items.map((i) => i.event), ["Heat Detection", "Service", "Pregnancy Diagnosis", "Calving"]);
  assert.deepEqual(RECORD_SECTIONS[1].items.map((i) => i.event), ["Check Up", "Treatment"]);
  assert.equal(eventEntry("Pregnancy Diagnosis")?.icon, "ScanHeart");
  assert.equal(eventEntry("Milk Quality")?.icon, "FlaskConical");
});
