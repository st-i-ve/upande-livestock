/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_LIMITS,
  emptyForm,
  formProblem,
  payloadFrom,
  previewChecks,
  previewOverall,
  toggleSensorySign,
  toggleSign,
} from "../milkQualityRules.ts";

const westwood = {
  ...emptyForm("2026-10-28"),
  quantity_l: "0.5", receiving_temp_c: "12.1", ph: "6.62", tta: "7.8", snf_percent: "8.8",
  freezing_point: "-0.548", specific_gravity: "1.030", protein_percent: "3.2", butterfat_percent: "2.9",
  resazurin_score: "0", resazurin_result: "Fail", antibiotics: "Negative", hydrogen_peroxide: "Nil",
  frothing: "Pass", aflatoxin_ppt: "67", sensory_score: "+1",
};

test("the Westwood sheet of 28.10.26 fails on resazurin and aflatoxin", () => {
  const c = previewChecks(westwood, DEFAULT_LIMITS);
  assert.deepEqual(c, {
    resazurin: "fail", antibiotics: "pass", hydrogen_peroxide: "pass", frothing: "pass", aflatoxin: "fail",
  });
  assert.equal(previewOverall(c), "Fail");
  assert.equal(formProblem(westwood), null);
});

test("an all-clear sheet passes; composition alone is not assessed", () => {
  const clear = { ...emptyForm("x"), resazurin_score: "6", antibiotics: "Negative", frothing: "Pass" };
  assert.equal(previewOverall(previewChecks(clear, DEFAULT_LIMITS)), "Pass");
  assert.equal(previewOverall(previewChecks({ ...emptyForm("x"), ph: "6.6" }, DEFAULT_LIMITS)), "Not assessed");
});

test("the aflatoxin limit is the farm's, and zero turns it off", () => {
  const f = { ...emptyForm("x"), aflatoxin_ppt: "60" };
  assert.equal(previewChecks(f, { ...DEFAULT_LIMITS, aflatoxin_limit_ppt: 75 }).aflatoxin, "pass");
  assert.equal(previewChecks(f, { ...DEFAULT_LIMITS, aflatoxin_limit_ppt: 0 }).aflatoxin, null);
  assert.equal(previewChecks({ ...f, aflatoxin_ppt: "50" }, DEFAULT_LIMITS).aflatoxin, "pass");
});

test("positive antibiotics warns only when the farm does not fail it", () => {
  const f = { ...emptyForm("x"), antibiotics: "Positive" };
  assert.equal(previewChecks(f, DEFAULT_LIMITS).antibiotics, "fail");
  assert.equal(previewChecks(f, { ...DEFAULT_LIMITS, antibiotics_fail: false }).antibiotics, "warn");
});

test("an explicit resazurin result beats the score", () => {
  const f = { ...emptyForm("x"), resazurin_score: "0", resazurin_result: "Pass" };
  assert.equal(previewChecks(f, DEFAULT_LIMITS).resazurin, "pass");
  assert.equal(previewChecks({ ...emptyForm("x"), resazurin_score: "3" }, DEFAULT_LIMITS).resazurin, "fail");
});

test("an empty sheet, a bad number and a fractional sensory score are refused", () => {
  assert.match(formProblem(emptyForm("x")) ?? "", /at least one result/);
  assert.match(formProblem({ ...emptyForm("x"), quantity_l: "0.5" }) ?? "", /at least one result/);
  assert.match(formProblem({ ...emptyForm("x"), ph: "six" }) ?? "", /ph must be a number/);
  assert.match(formProblem({ ...emptyForm("x"), sensory_score: "1.5" }) ?? "", /whole number/);
  assert.equal(formProblem({ ...emptyForm("x"), sensory_score: "-1" }), null);
});

test("numbers go as numbers (comma decimals, unicode minus) and blanks are dropped", () => {
  const p = payloadFrom({ ...emptyForm("2026-10-28"), ph: "6,62", freezing_point: "−0.548", frothing: "Pass" });
  assert.equal(p.ph, 6.62);
  assert.equal(p.freezing_point, -0.548);
  assert.equal(p.frothing, "Pass");
  assert.equal("tta" in p, false);
  assert.equal(p.sample_type, "Bottle sample");
});

test("the sign buttons flip a figure and a sensory score", () => {
  assert.equal(toggleSign("0.548"), "-0.548");
  assert.equal(toggleSign("-0.548"), "0.548");
  assert.equal(toggleSign(""), "-");
  assert.equal(toggleSensorySign("+1"), "-1");
  assert.equal(toggleSensorySign("-1"), "+1");
  assert.equal(toggleSensorySign("1"), "-1");
  assert.equal(toggleSensorySign(""), "-");
});
