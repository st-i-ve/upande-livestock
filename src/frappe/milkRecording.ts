import type { DailyMilkRow, Herd } from "@/types";
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

  const client = await getClient();
  const res = await client.post(
    "/api/method/upande_livestock.serverscripts.mobile.record_milking.record_milking",
    { payload: body },
  );
  const msg = res.data?.message;
  if (!msg) throw new Error("Milk recording returned nothing.");
  if (msg.error) throw new Error(msg.error);
  return msg;
};

export const MILK_LIST_FIELDS = [
  "name",
  "herd",
  // `session` used to be here. Reading it back now returns nothing.
  "milking_time",
  "recording_date",
  "net_yield_kg",
  "cows_milked",
] as const;

export type MilkRecordingRow = {
  name: string;
  herd: string;
  /** `HH:MM:SS` on the farm's clock. */
  milkingTime: string;
  recordingDate: string;
  netYieldKg: number;
  cowsMilked: number;
};

const mapRow = (row: any): MilkRecordingRow => ({
  name: row.name,
  herd: row.herd ?? "",
  milkingTime: row.milking_time ?? "",
  recordingDate: row.recording_date ?? "",
  netYieldKg: Number(row.net_yield_kg ?? 0),
  cowsMilked: Number(row.cows_milked ?? 0),
});

export const getMilkRecordingsForDate = async (
  date: string,
): Promise<MilkRecordingRow[]> => {
  const client = await getClient();
  const res = await client.get("/api/resource/Milk Recording", {
    params: {
      fields: JSON.stringify(MILK_LIST_FIELDS),
      filters: JSON.stringify([
        ["recording_date", "=", date],
        ["docstatus", "=", 1],
      ]),
      limit_page_length: 500,
      order_by: "creation desc",
    },
  });
  const rows = (res.data?.data ?? []) as any[];
  return rows.map(mapRow);
};

/**
 * Submitted Milk Recordings over a date range. Used by the milk-yield report
 * for 30-day rollups; also useful for any per-herd / per-day chart.
 */
export const getMilkRecordingsBetween = async (
  startISO: string,
  endISO: string,
): Promise<(MilkRecordingRow & { milkRevenue: number; discardedKg: number })[]> => {
  const client = await getClient();
  const res = await client.get("/api/resource/Milk Recording", {
    params: {
      fields: JSON.stringify([...MILK_LIST_FIELDS, "milk_revenue", "discarded_kg"]),
      filters: JSON.stringify([
        ["recording_date", ">=", startISO],
        ["recording_date", "<=", endISO],
        ["docstatus", "=", 1],
      ]),
      limit_page_length: 2000,
      order_by: "recording_date desc",
    },
  });
  const rows = (res.data?.data ?? []) as any[];
  return rows.map((r) => ({
    ...mapRow(r),
    milkRevenue: Number(r.milk_revenue ?? 0),
    discardedKg: Number(r.discarded_kg ?? 0),
  }));
};

/** Which half of the day a milking falls in, off the clock rather than a label.
 *  "Evening" bucketed as pm before, and anything from noon still does. */
const timeBucket = (milkingTime: string): "am" | "pm" | "other" => {
  const hour = Number(milkingTime.split(":")[0]);
  if (!Number.isFinite(hour)) return "other";
  return hour < 12 ? "am" : "pm";
};

/**
 * Group today's milk recordings by herd into the row shape the home screen
 * expects. Herds that did not record a session show `null` for that slot,
 * which the UI renders as "pending".
 */
export const mapTodaysMilkByHerd = (
  rows: MilkRecordingRow[],
  herds: Herd[],
): DailyMilkRow[] => {
  const sums: Record<string, { am: number | null; pm: number | null }> = {};

  for (const r of rows) {
    const bucket = timeBucket(r.milkingTime);
    if (bucket === "other") continue;
    if (!sums[r.herd]) sums[r.herd] = { am: null, pm: null };
    const slot = sums[r.herd];
    slot[bucket] = (slot[bucket] ?? 0) + r.netYieldKg;
  }

  // Include any herd flagged as `custom_is_milking` on Frappe, plus any herd
  // that already has a recording today (covers herds without the flag set).
  const candidates = new Set<string>([
    ...Object.keys(sums),
    ...herds.filter((h) => h.isMilking).map((h) => h.n),
  ]);

  const result: DailyMilkRow[] = [];
  for (const herdName of candidates) {
    const h = herds.find((x) => x.n === herdName);
    const cnt = h?.cnt ?? 0;
    const expected = h ? Math.round(cnt * h.kgPerHeadPerDay) : 0;
    const slot = sums[herdName] ?? { am: null, pm: null };
    result.push({
      herd: herdName,
      cnt,
      am: slot.am,
      pm: slot.pm,
      expected,
    });
  }
  return result.sort((a, b) => a.herd.localeCompare(b.herd));
};
