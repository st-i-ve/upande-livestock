import type { DailyMilkRow, Herd } from "@/types";
import { getClient } from "@/src/services/api";

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

export const todayISO = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

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

  // Only include lactating herds (heuristic: any herd that has cows_milked
  // entries today OR whose name suggests a milking group).
  const lactatingPattern = /lact|milk|fresh|yield/i;
  const candidates = new Set<string>([
    ...Object.keys(sums),
    ...herds.filter((h) => lactatingPattern.test(h.n) || lactatingPattern.test(h.cat)).map((h) => h.n),
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
