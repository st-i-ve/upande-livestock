import { OpsError } from "@/src/frappe/opsError";
import { uploadFile, type FileAsset } from "@/src/frappe/files";
import type { CheckKey, Chip, QualityLimits } from "@/src/frappe/milkQualityRules";
import { getClient } from "@/src/services/api";

/**
 * Milk Quality Test: the buyer's result sheet for a batch of milk. The same four
 * server functions the web's Quality page calls. Recording is queued when the
 * phone has no signal (the sheet comes back to the farm on paper, often where
 * there is none), and sent again safely: `client_ref` makes a second send of the
 * same sheet return the first record rather than a duplicate.
 */
const BASE = "/api/method/upande_livestock.serverscripts.quality.quality_tests";

export type QualityTest = {
  name: string;
  sample_date: string;
  shift: string;
  sample_type: string;
  buyer: string | null;
  milk_recording: string | null;
  quantity_l: number | null;
  butterfat_percent: number | null;
  bulk_scc?: number | null;
  scc_over_ceiling?: boolean;
  protein_percent: number | null;
  snf_percent: number | null;
  ph: number | null;
  aflatoxin_ppt: number | null;
  overall_result: "Pass" | "Fail" | "Not assessed";
  failed_tests: string;
  checks: Record<CheckKey, Chip>;
};

export type QualityTestOptions = {
  default_buyer: string;
  sample_types: string[];
  shifts: string[];
  limits: QualityLimits;
  scc_ceiling?: number;
  recordings: { name: string; herd: string; milking_time: string; net_yield_kg: number }[];
  can_write: boolean;
};

const unwrap = <T>(msg: any, fallback: string): T => {
  if (!msg) throw new Error(fallback);
  if (msg.error) throw new OpsError(msg.error, msg.code);
  return msg as T;
};

export const getQualityTestOptions = async (date?: string): Promise<QualityTestOptions> => {
  const client = await getClient();
  const res = await client.post(`${BASE}.quality_test_options`, { date });
  return unwrap<QualityTestOptions>(res.data?.message, "Could not load the quality options.");
};

export const getQualityTests = async (
  filters: Record<string, string> = {},
  limit = 30,
): Promise<{ tests: QualityTest[]; total: number }> => {
  const client = await getClient();
  const res = await client.post(`${BASE}.quality_tests`, { filters, limit });
  return unwrap<{ tests: QualityTest[]; total: number }>(res.data?.message, "Could not load the results.");
};

export type RecordQualityInput = {
  /** Server fields, built by `payloadFrom`. */
  fields: Record<string, string | number | string[]>;
  /** Stable per recording; the queue's own id, so a retry cannot duplicate. */
  clientRef: string;
  /** A photo of the lab slip, held on the phone until the sheet is sent. */
  slipPhoto?: FileAsset | null;
  /** Set when the sheet sat in the queue: when it was filled in on the phone. */
  capturedAt?: string;
};

export type RecordedQuality = {
  name: string;
  duplicate: boolean;
  overall_result: QualityTest["overall_result"];
  failed_tests: string;
};

export const recordQualityTest = async (input: RecordQualityInput): Promise<RecordedQuality> => {
  const body: Record<string, unknown> = { ...input.fields, client_ref: input.clientRef };
  // The photo goes up first: if it will not upload the sheet is not half-filed,
  // and a retry uploads it again rather than filing a sheet that lost its slip.
  if (input.slipPhoto) body.lab_slip = await uploadFile(input.slipPhoto, false);
  const client = await getClient();
  const res = await client.post(`${BASE}.record_quality_test`, { payload: body });
  return unwrap<RecordedQuality>(res.data?.message, "The server gave no answer.");
};
