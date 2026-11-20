/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { filterSires, parseSires, sireFields, sireLabel } from "../sireList.ts";

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
