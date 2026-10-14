import { OpsError } from "@/src/frappe/opsError";
import { getClient, todayISO } from "@/src/services/api";

export { todayISO };


export type CreateMilkRecordingInput = {
  herd: string;
  /** `HH:MM` on the farm's clock. Omitted means "now", decided by the server. */
  milkingTime?: string;
  recordingDate?: string;       // ISO; default today
  company?: string;             // optional override
  totalYieldKg: number;
  discardedKg?: number;
  discardReason?: string;       // required by the server when discardedKg > 0
  discardReasonNotes?: string;  // required when the reason is "Other"
  colostrumYieldKg?: number;
  isColostrum?: boolean;
  pricePerKg?: number;
  cowsMilked?: number;
  operator?: string;            // Employee name (optional)
  remarks?: string;
  /** Set only when the milking is parked in the offline queue: phone time of
   *  recording (`YYYY-MM-DD HH:MM:SS`) and the flag that earns one day of grace
   *  on a closed backdating window. The milking's date stays the milker's own. */
  capturedAt?: string;
  offline?: boolean;
};

/**
 * Record a milking through the server's own endpoint.
 *
 * This used to insert the document directly, sending an AM/PM `session`. That
 * field no longer exists — the backend replaced it with a mandatory
 * `milking_time` (patches/migrate_milking_session_to_time), because a farm can
 * milk more than twice a day and three fixed labels could not say so. The
 * insert therefore failed every time with "Value missing for Milk Recording:
 * Milking Time".
 *
 * create_milk_recording defaults `milking_time` to the server clock when none
 * is sent, derives the net yield and revenue, and posts the Milking Stock Entry
 * and revenue Journal Entry. A raw insert reproduces none of that, and is not
 * permission-checked.
 */
export const createMilkRecording = async (
  input: CreateMilkRecordingInput,
): Promise<any> => {
  const total = Number(input.totalYieldKg) || 0;
  const discarded = Number(input.discardedKg) || 0;
  const colostrum = input.isColostrum
    ? Math.max(total - discarded, 0)
    : Number(input.colostrumYieldKg) || 0;
  const netYield = Math.max(total - discarded - colostrum, 0);
  const price = input.pricePerKg ?? 0;
  const revenue = price > 0 ? Math.round(netYield * price * 100) / 100 : 0;

  const body: Record<string, any> = {
    herd: input.herd,
    ...(input.milkingTime ? { milking_time: input.milkingTime } : {}),
    recording_date: input.recordingDate || todayISO(),
    total_yield_kg: total,
    discarded_kg: discarded,
    net_yield_kg: netYield,
  };
  if (discarded > 0 && input.discardReason) body.discard_reason = input.discardReason;
  if (discarded > 0 && input.discardReasonNotes)
    body.discard_reason_notes = input.discardReasonNotes;
  if (input.company) body.company = input.company;
  if (input.isColostrum) body.is_colostrum = 1;
  if (colostrum > 0) body.colostrum_yield_kg = colostrum;
  if (price > 0) body.price_per_kg = price;
  if (revenue > 0) body.milk_revenue = revenue;
  if (input.cowsMilked != null) body.cows_milked = input.cowsMilked;
  if (input.operator) body.operator = input.operator;
  if (input.remarks) body.remarks = input.remarks;
  if (input.offline) {
    body.offline = 1;
    if (input.capturedAt) body.captured_at = input.capturedAt;
  }

  const client = await getClient();
  const res = await client.post(
    "/api/method/upande_livestock.serverscripts.mobile.record_milking.record_milking",
    { payload: body },
  );
  const msg = res.data?.message;
  if (!msg) throw new Error("Milk recording returned nothing.");
  // An OpsError (not a plain Error) so a refusal from the server, such as
  // "Backdating is closed" for a milking that was queued on an earlier day, is
  // reported on the Pending screen instead of being mistaken for a dead network
  // that stalls the whole drain.
  if (msg.error) throw new OpsError(msg.error, msg.code);
  return msg;
};
