/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { filterSires, mayAddSire, sireFromSaved, strawFor, strawHint, parseSires, sireFields, sireLabel } from "../sireList.ts";

const rows = [
  { name: "NL900000001", sire_name: "Dolmen", code: "NL900000001", type: "Semen", semen_item: "4040030118", sexed: 1 },
  { name: "Mazira", sire_name: "Mazira", code: "", type: "Live bull", animal: "KT-9" },
  { sire_name: "no name" },
];

test("parseSires keeps the link name, code, type and sexed flag, and drops rows with no name", () => {
  const s = parseSires(rows);
  assert.equal(s.length, 2);
  assert.equal(s[0].name, "NL900000001");
  assert.equal(s[0].sexed, true);
  assert.equal(s[0].semenItem, "4040030118");
  assert.equal(s[1].type, "Live bull");
  assert.deepEqual(parseSires(undefined), []);
});

test("sireLabel is Name · CODE, or the name alone", () => {
  const [a, b] = parseSires(rows);
  assert.equal(sireLabel(a), "Dolmen · NL900000001");
  assert.equal(sireLabel(b), "Mazira");
});

test("filterSires matches name or code in any order, and the type chip", () => {
  const s = parseSires(rows);
  assert.deepEqual(filterSires(s, "9000 dol").map((x) => x.name), ["NL900000001"]);
  assert.deepEqual(filterSires(s, "", "Live bull").map((x) => x.name), ["Mazira"]);
  assert.equal(filterSires(s, "zzz").length, 0);
  assert.equal(filterSires(s, "").length, 2);
});

test("sireFields sends the link, or the typed fallback only when nothing is picked", () => {
  assert.deepEqual(sireFields("NL900000001", "ignored"), { sireLink: "NL900000001" });
  assert.deepEqual(sireFields("", "  Local bull "), { sire: "Local bull" });
  assert.deepEqual(sireFields("", " "), {});
});

test("a picked semen sire brings his straw when the choices offer it; none, or not offered, brings nothing", () => {
  const [a] = parseSires(rows);
  assert.equal(strawFor(a, [{ value: "4040030118" }, { value: "x" }])?.value, "4040030118");
  assert.equal(strawFor(a, [{ value: "x" }]), undefined);
  assert.equal(strawFor(null, [{ value: "x" }]), undefined);
});

test("a semen sire with no straw item says so, differently for managers; a live bull says nothing", () => {
  const none = parseSires([{ name: "B", sire_name: "B", type: "Semen" }])[0];
  assert.match(strawHint(none, true), /Sires page/);
  assert.doesNotMatch(strawHint(none, false), /Sires page/);
  assert.equal(strawHint(parseSires(rows)[0], true), "");
  assert.equal(strawHint(parseSires(rows)[1], true), "");
});

test("the add-sire row is for managers, online only", () => {
  assert.equal(mayAddSire(true, false), true);
  assert.equal(mayAddSire(true, true), false);
  assert.equal(mayAddSire(false, false), false);
});

test("a saved sire is held as the picker holds one", () => {
  const s = sireFromSaved("NL1", { sireName: "Dolmen", code: "nl1", type: "Semen", semenItem: "I-1", sexed: true, animal: "A" });
  assert.deepEqual([s.name, s.code, s.semenItem, s.sexed, s.animal], ["NL1", "NL1", "I-1", true, ""]);
});
