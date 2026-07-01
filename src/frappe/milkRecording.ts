import type { DailyMilkRow, Herd } from "@/types";
import { frappeCreateAndSubmit, getClient, todayISO } from "@/src/services/api";

export { todayISO };

export type MilkSession = "AM — Morning" | "PM — Afternoon" | "Evening";

export type CreateMilkRecordingInput = {
  herd: string;
  session: MilkSession;
  recordingDate?: string;       // ISO; default today
  company?: string;             // optional override
  totalYieldKg: number;
  discardedKg?: number;
  colostrumYieldKg?: number;
  isColostrum?: boolean;
  pricePerKg?: number;
  cowsMilked?: number;
  operator?: string;            // Employee name (optional)
  remarks?: string;
};

/**
 * Create + submit a Milk Recording. The After Submit server script
 * ("Milk Recording After Submit - Stock Entry") auto-creates the Milking
 * Stock Entry — setting `custom_milking_session` and `custom_cows_milked`
 * from this doc's `session` / `cows_milked` — plus a best-effort revenue JE
 * (see livestock_server_scripts §4).
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
    session: input.session,
    recording_date: input.recordingDate || todayISO(),
    total_yield_kg: total,
    discarded_kg: discarded,
    net_yield_kg: netYield,
  };
  if (input.company) body.company = input.company;
  if (input.isColostrum) body.is_colostrum = 1;
  if (colostrum > 0) body.colostrum_yield_kg = colostrum;
  if (price > 0) body.price_per_kg = price;
  if (revenue > 0) body.milk_revenue = revenue;
  if (input.cowsMilked != null) body.cows_milked = input.cowsMilked;
  if (input.operator) body.operator = input.operator;
  if (input.remarks) body.remarks = input.remarks;

  return frappeCreateAndSubmit("Milk Recording", body);
};

export const MILK_LIST_FIELDS = [
  "name",
  "herd",
  "session",
  "recording_date",
  "net_yield_kg",
  "cows_milked",
] as const;

export type MilkRecordingRow = {
  name: string;
  herd: string;
  session: string;
  recordingDate: string;
  netYieldKg: number;
  cowsMilked: number;
};

const mapRow = (row: any): MilkRecordingRow => ({
  name: row.name,
  herd: row.herd ?? "",
  session: row.session ?? "",
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

const sessionBucket = (session: string): "am" | "pm" | "other" => {
  const s = session.toLowerCase();
  if (s.includes("am") || s.includes("morning")) return "am";
  if (s.includes("pm") || s.includes("afternoon") || s.includes("evening")) return "pm";
  return "other";
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
    const bucket = sessionBucket(r.session);
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
