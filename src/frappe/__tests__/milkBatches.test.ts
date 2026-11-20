/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { batchLabel } from "../milkBatchLabel.ts";

test("a batch reads as date, shift, kilos and herds, and says when it is already tested", () => {
  const b = { key: "k", date: "2026-11-19", shift: "Morning", total_kg: 350.46, herds: ["A", "B"], milk_recording: "R1", tested: false };
  assert.equal(batchLabel(b), "2026-11-19 · Morning · 350.5 kg · A, B");
  assert.equal(batchLabel({ ...b, tested: true }), "2026-11-19 · Morning · 350.5 kg · A, B (tested)");
});

test("batches awaiting a result are listed first and say so", async () => {
  const { pendingFirst } = await import("../milkBatchLabel.ts");
  const mk = (key: string, pending: boolean) => ({ key, date: "d", shift: "Morning", total_kg: 1, herds: ["A"], milk_recording: key, tested: false, pending });
  const out = pendingFirst([mk("new", false), mk("old1", true), mk("old2", true)]);
  assert.deepEqual(out.map((b) => b.key), ["old1", "old2", "new"]);
  assert.match(batchLabel(mk("x", true)), /\(awaiting result\)$/);
});

test("a picked batch sends its date, shift and every recording so each herd's milking gets the figures", async () => {
  const { batchFields } = await import("../milkBatchLabel.ts");
  const b = {
    key: "k", date: "2026-11-19", shift: "Morning", total_kg: 3, herds: ["A", "B"], milk_recording: "R1", tested: false,
    recordings: [{ name: "R1" }, { name: "R2" }],
  };
  assert.deepEqual(batchFields(b), { sample_date: "2026-11-19", shift: "Morning", milk_recording: "R1", recordings: ["R1", "R2"] });
});
