import assert from "node:assert/strict";
import { test } from "node:test";

import { storedValue } from "../imageFields.ts";

test("a blank image or thumb is stored as NULL so a removed picture clears", () => {
  assert.equal(storedValue("image", ""), null);
  assert.equal(storedValue("image", null), null);
  assert.equal(storedValue("thumb", undefined), null);
  assert.equal(storedValue("image", "/files/a.jpg"), "/files/a.jpg");
  assert.equal(storedValue("thumb", "/files/a_thumb.jpg"), "/files/a_thumb.jpg");
});

test("other columns keep their value, undefined becomes NULL", () => {
  assert.equal(storedValue("tag", "K1"), "K1");
  assert.equal(storedValue("parity", 0), 0);
  assert.equal(storedValue("dam", undefined), null);
});
