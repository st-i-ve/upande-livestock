import { OpsError } from "@/src/frappe/opsError";
import type { MilkBatch } from "@/src/frappe/milkBatchLabel";
import { getClient } from "@/src/services/api";

/**
 * Milked batches: one milking session (a date and a shift) across the herds
 * milked then. A quality test is recorded against a batch. Online read of the
 * server's `milk_batches`; without signal the form falls back to date + shift.
 */
const BASE = "/api/method/upande_livestock.serverscripts.quality.milk_batches";

export const getMilkBatches = async (dateFrom?: string, dateTo?: string): Promise<MilkBatch[]> => {
  const client = await getClient();
  const res = await client.post(`${BASE}.milk_batches`, { date_from: dateFrom, date_to: dateTo });
  const msg = res.data?.message;
  if (!msg) throw new Error("Could not load the milked batches.");
  if (msg.error) throw new OpsError(msg.error, msg.code);
  return msg.batches as MilkBatch[];
};
