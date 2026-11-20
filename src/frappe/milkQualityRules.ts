/**
 * The buyer's milk quality sheet, as the phone previews and validates it. The
 * server (Milk Quality Test) has the last word: these rules only say, before
 * the round trip, what it will decide. No imports, so node can test them.
 */
export type Chip = "pass" | "fail" | "warn" | null;
export type CheckKey = "resazurin" | "antibiotics" | "hydrogen_peroxide" | "frothing" | "aflatoxin";

export const CHECK_LABELS: Record<CheckKey, string> = {
  resazurin: "Resazurin",
  antibiotics: "Antibiotics",
  hydrogen_peroxide: "H2O2",
  frothing: "Frothing",
  aflatoxin: "Afla M1",
};

export type QualityLimits = {
  aflatoxin_limit_ppt: number;
  antibiotics_fail: boolean;
  resazurin_min_score: number;
};

/** What a phone with no signal assumes until the server's settings are read. */
export const DEFAULT_LIMITS: QualityLimits = {
  aflatoxin_limit_ppt: 50,
  antibiotics_fail: true,
  resazurin_min_score: 4,
};

export type QualityForm = {
  sample_date: string;
  shift: string;
  sample_type: string;
  buyer: string;
  milk_recording: string;
  quantity_l: string;
  receiving_temp_c: string;
  ph: string;
  tta: string;
  snf_percent: string;
  freezing_point: string;
  specific_gravity: string;
  protein_percent: string;
  butterfat_percent: string;
  resazurin_score: string;
  resazurin_result: string;
  antibiotics: string;
  hydrogen_peroxide: string;
  frothing: string;
  aflatoxin_ppt: string;
  sensory_score: string;
  sensory_note: string;
  remarks: string;
};

export const emptyForm = (date: string, buyer = ""): QualityForm => ({
  sample_date: date, shift: "", sample_type: "Bottle sample", buyer, milk_recording: "",
  quantity_l: "", receiving_temp_c: "", ph: "", tta: "", snf_percent: "", freezing_point: "",
  specific_gravity: "", protein_percent: "", butterfat_percent: "", resazurin_score: "",
  resazurin_result: "", antibiotics: "", hydrogen_peroxide: "", frothing: "", aflatoxin_ppt: "",
  sensory_score: "", sensory_note: "", remarks: "",
});

export const NUMBER_FIELDS = [
  "quantity_l", "receiving_temp_c", "ph", "tta", "snf_percent", "freezing_point",
  "specific_gravity", "protein_percent", "butterfat_percent", "aflatoxin_ppt",
] as const;

const OUTCOME_FIELDS = [
  "resazurin_score", "resazurin_result", "antibiotics", "hydrogen_peroxide", "frothing", "sensory_score",
] as const;

/** A number the way a phone keyboard types it: a comma decimal, a unicode minus. */
export const toNumber = (text: string): number =>
  Number(text.trim().replace(",", ".").replace("−", "-"));

/** Blanks are left out; numbers go as numbers. */
export const payloadFrom = (form: QualityForm): Record<string, string | number> => {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(form)) {
    const text = String(v ?? "").trim();
    if (!text) continue;
    out[k] = (NUMBER_FIELDS as readonly string[]).includes(k) ? toNumber(text) : text;
  }
  return out;
};

/** The first reason the sheet cannot be sent, or null. */
export const formProblem = (form: QualityForm): string | null => {
  for (const k of NUMBER_FIELDS) {
    const text = form[k].trim();
    if (text && !Number.isFinite(toNumber(text))) return `${k.replace(/_/g, " ")} must be a number.`;
  }
  const s = form.sensory_score.trim();
  if (s && !/^[+\-−]?\d+$/.test(s)) return "Sensory score must be a whole number, such as +1, 0 or -1.";
  const any =
    NUMBER_FIELDS.some((k) => k !== "quantity_l" && form[k].trim()) ||
    OUTCOME_FIELDS.some((k) => form[k].trim());
  return any ? null : "Enter at least one result.";
};

/** The deciding tests as the server judges them. */
export const previewChecks = (form: QualityForm, lim: QualityLimits): Record<CheckKey, Chip> => {
  let res: Chip = null;
  if (form.resazurin_result) res = form.resazurin_result === "Pass" ? "pass" : "fail";
  else if (form.resazurin_score !== "") res = Number(form.resazurin_score) >= lim.resazurin_min_score ? "pass" : "fail";
  const afla = form.aflatoxin_ppt.trim() ? toNumber(form.aflatoxin_ppt) : 0;
  return {
    resazurin: res,
    antibiotics: !form.antibiotics ? null : form.antibiotics === "Positive" ? (lim.antibiotics_fail ? "fail" : "warn") : "pass",
    hydrogen_peroxide: !form.hydrogen_peroxide ? null : form.hydrogen_peroxide === "Present" ? "fail" : "pass",
    frothing: !form.frothing ? null : form.frothing === "Pass" ? "pass" : "fail",
    aflatoxin: afla > 0 && lim.aflatoxin_limit_ppt > 0 ? (afla > lim.aflatoxin_limit_ppt ? "fail" : "pass") : null,
  };
};

export type Overall = "Pass" | "Fail" | "Not assessed";

export const previewOverall = (checks: Record<CheckKey, Chip>): Overall => {
  const v = Object.values(checks);
  return v.includes("fail") ? "Fail" : v.some(Boolean) ? "Pass" : "Not assessed";
};

/** Sign-aware numeric text: a phone number pad may have no minus, so the
 *  sign keys are offered as a toggle on the fields that need one. */
export const toggleSign = (text: string): string => {
  const t = text.trim().replace("−", "-");
  if (!t) return "-";
  return t.startsWith("-") ? t.slice(1) : t.startsWith("+") ? `-${t.slice(1)}` : `-${t}`;
};

export const toggleSensorySign = (text: string): string => {
  const t = text.trim().replace("−", "-");
  if (!t || t === "+") return "-";
  if (t.startsWith("-")) return `+${t.slice(1)}`;
  return `-${t.replace(/^\+/, "")}`;
};
