/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { appetiteLabel, changedKg, dayIsOpen, fmtKg, parseKg, signedKg, signedPct, statusTone } from "../daySheet.ts";

const comp = (itemCode: string, actualKg: number, plannedKg = actualKg) => ({
  itemCode,
  itemName: `Item ${itemCode}`,
  uom: "kg",
  plannedKg,
  actualKg,
  plannedPerHead: 0,
  actualPerHead: 0,
  removed: false,
});

test("parseKg accepts plain, decimal-comma and trailing-dot amounts, and refuses the rest", () => {
  assert.equal(parseKg("12"), 12);
  assert.equal(parseKg(" 12,5 "), 12.5);
  assert.equal(parseKg("0"), 0);
  assert.equal(parseKg("3."), 3);
  assert.equal(parseKg(".5"), 0.5);
  for (const bad of ["", " ", "abc", "-2", "1.2.3", "1e3", "--"]) assert.equal(parseKg(bad), null, bad);
});

test("changedKg sends only the boxes the operator changed", () => {
  const cs = [comp("A", 10), comp("B", 5), comp("C", 2)];
  const r = changedKg(cs, { A: "10", B: "6.5", C: "2.0" });
  assert.deepEqual(r.changes, { B: 6.5 });
  assert.deepEqual(r.invalid, []);
});

test("changedKg leaves untouched components out so the server keeps them", () => {
  const r = changedKg([comp("A", 10), comp("B", 5)], { A: "11" });
  assert.deepEqual(r.changes, { A: 11 });
});

test("changedKg sets an item not used at all as zero kg", () => {
  const r = changedKg([comp("A", 10), comp("B", 5)], { B: "0" });
  assert.deepEqual(r.changes, { B: 0 });
});

test("changedKg names the items whose box is unusable and does not send them", () => {
  const r = changedKg([comp("A", 10), comp("B", 5)], { A: "x", B: "7" });
  assert.deepEqual(r.changes, { B: 7 });
  assert.deepEqual(r.invalid, ["Item A"]);
});

test("a day is open to amend and mix only while Planned or Amended", () => {
  assert.equal(dayIsOpen({ status: "Planned" }), true);
  assert.equal(dayIsOpen({ status: "Amended" }), true);
  assert.equal(dayIsOpen({ status: "Waiting for stock" }), false);
  assert.equal(dayIsOpen({ status: "Manufactured" }), false);
});

test("status tone, appetite labels and the number formats", () => {
  assert.equal(statusTone("Waiting for stock"), "warning");
  assert.equal(statusTone("Manufactured"), "success");
  assert.equal(statusTone("Planned"), "default");
  assert.equal(appetiteLabel("below"), "Below plan");
  assert.equal(appetiteLabel("above"), "Above plan");
  assert.equal(appetiteLabel("on_plan"), "On plan");
  assert.equal(signedKg(2.34), "+2.3 kg");
  assert.equal(signedKg(-1), "-1 kg");
  assert.equal(signedKg(0), "0 kg");
  assert.equal(signedPct(5), "+5%");
  assert.equal(signedPct(-3.14), "-3.1%");
  assert.equal(fmtKg(0), "0 kg");
});
