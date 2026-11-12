/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  choiceLabel,
  choiceMeta,
  coverNotice,
  findShortage,
  lineNotice,
  outOfStock,
  savedTitle,
  sortChoices,
  stockDraftsIn,
  stockOutcomeText,
  type StockChoice,
} from "../eventItems.ts";

const held: StockChoice = {
  value: "DRG-1",
  label: "Penstrep",
  item_name: "Penstrep",
  qty: 12,
  uom: "ml",
  warehouse: "Main Store",
  in_stock: true,
  locations: [{ warehouse: "Main Store", qty: 12 }],
};
const none: StockChoice = {
  value: "DRG-2",
  label: "Oxytet",
  item_name: "Oxytet",
  qty: 0,
  uom: "ml",
  in_stock: false,
  locations: [],
};
// An older server: held items only, no in_stock flag.
const legacy: StockChoice = { ...held, in_stock: undefined };

test("outOfStock follows in_stock, then empty locations", () => {
  assert.equal(outOfStock(held), false);
  assert.equal(outOfStock(none), true);
  assert.equal(outOfStock(legacy), false);
  assert.equal(outOfStock({ ...held, in_stock: undefined, locations: [] }), true);
  assert.equal(outOfStock(undefined), false);
});

test("picker labels mark an out-of-stock item and show held ones as before", () => {
  assert.equal(choiceLabel(none), "Oxytet · none in store — saved as a draft");
  assert.equal(choiceMeta(held), "12 ml in Main Store");
  assert.equal(
    choiceMeta({ ...held, locations: [...held.locations!, { warehouse: "Annex", qty: 3 }] }),
    "12 ml in Main Store (+1 more)",
  );
});

test("out-of-stock items come after the in-stock ones, order kept", () => {
  const a = { ...none, value: "A" };
  const b = { ...held, value: "B" };
  const c = { ...none, value: "C" };
  const d = { ...held, value: "D" };
  assert.deepEqual(sortChoices([a, b, c, d]).map((x) => x.value), ["B", "D", "A", "C"]);
});

test("notice: picking an out-of-stock item warns at any quantity", () => {
  const n = lineNotice([held, none], { itemCode: "DRG-2", warehouse: "", qtyNeeded: 0 });
  assert.equal(n, coverNotice("Oxytet"));
  assert.match(n!, /The store can't cover Oxytet\. The record is still saved; the stock issue waits as a draft on Transactions until the stock is in\./);
});

test("notice: a quantity above the store's balance warns, at or below does not", () => {
  const line = { itemCode: "DRG-1", warehouse: "Main Store" };
  assert.equal(lineNotice([held], { ...line, qtyNeeded: 13 }), coverNotice("Penstrep"));
  assert.equal(lineNotice([held], { ...line, qtyNeeded: 12 }), null);
  assert.equal(lineNotice([held], { ...line, qtyNeeded: 0 }), null);
});

test("notice: nothing picked, or an item the list does not know, says nothing", () => {
  assert.equal(lineNotice([held], { itemCode: "", warehouse: "", qtyNeeded: 5 }), null);
  assert.equal(lineNotice([held], { itemCode: "X", warehouse: "Main Store", qtyNeeded: 5 }), null);
  assert.equal(lineNotice(undefined, { itemCode: "DRG-1", warehouse: "Main Store", qtyNeeded: 5 }), null);
});

test("findShortage returns the first line that needs the notice", () => {
  const lines = [
    { itemCode: "DRG-1", warehouse: "Main Store", qtyNeeded: 1 },
    { itemCode: "DRG-2", warehouse: "", qtyNeeded: 1 },
  ];
  assert.equal(findShortage([held, none], lines), coverNotice("Oxytet"));
  assert.equal(findShortage([held, none], lines.slice(0, 1)), null);
});

test("drafts confirmation names each draft and says a storekeeper posts it from Transactions", () => {
  const replies = [
    { stock_drafts: [{ name: "MAT-STE-1", stock_entry_type: "Livestock Deworming", short: "Oxytet: need 40, have 0" }] },
    { stock_drafts: [{ name: "MAT-STE-1", stock_entry_type: "Livestock Deworming", short: "Oxytet: need 40, have 0" }] },
    { stock_drafts: [{ name: "MAT-STE-2", stock_entry_type: "Livestock Service", short: "Straw: need 1, have 0" }] },
    {},
  ];
  assert.equal(stockDraftsIn(replies).length, 2);
  const text = stockOutcomeText(replies);
  assert.match(text, /Livestock Deworming MAT-STE-1: Oxytet: need 40, have 0/);
  assert.match(text, /Livestock Service MAT-STE-2: Straw: need 1, have 0/);
  assert.match(text, /storekeeper will post them from Transactions/);
});

test("a single draft reads in the singular; no drafts reads as empty", () => {
  const one = stockOutcomeText([{ stock_drafts: [{ name: "S1", stock_entry_type: "T", short: "x" }] }]);
  assert.match(one, /this stock issue is a draft/);
  assert.match(one, /post it from Transactions/);
  assert.equal(stockOutcomeText([{}, null, { stock_drafts: [] }]), "");
});

test("confirmation title says so when a draft was made", () => {
  assert.equal(savedTitle("Treatment", [{}]), "Treatment recorded");
  assert.equal(savedTitle("Feeding", [{}], "mixed"), "Feeding mixed");
  assert.equal(
    savedTitle("Treatment", [{ stock_drafts: [{ name: "S", stock_entry_type: "T", short: "" }] }]),
    "Treatment saved: stock issue is a draft",
  );
});
