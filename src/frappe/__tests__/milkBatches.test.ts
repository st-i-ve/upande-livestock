/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { batchLabel } from "../milkBatchLabel.ts";

test("a batch reads as date, shift, kilos and herds, and says when it is already tested", () => {
  const b = { key: "k", date: "2026-11-19", shift: "Morning", total_kg: 350.46, herds: ["A", "B"], milk_recording: "R1", tested: false };
  assert.equal(batchLabel(b), "2026-11-19 · Morning · 350.5 kg · A, B");
  assert.equal(batchLabel({ ...b, tested: true }), "2026-11-19 · Morning · 350.5 kg · A, B (tested)");
});
