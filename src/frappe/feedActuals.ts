import { getClient } from "@/src/services/api";
import { OpsError } from "@/src/frappe/opsError";
import { mapSession, type DaySession, type FeedChoice } from "@/src/feed/feedSessions";

/**
 * The feeding day sheet: a herd's plan (its recipe, per head times head count)
 * against what was actually fed that day, per-animal intake, and the daily
 * feed report. Whitelisted methods in upande_livestock/serverscripts/feeding.
 *
 * Every one needs the server: amending and mixing book real stock and are
 * checked live, so none of them goes through the offline queue (feeding never
 * has). The screens say so while the phone is offline.
 */
const BASE = "upande_livestock.serverscripts.feeding";

const call = async <T = any>(method: string, args: Record<string, any>): Promise<T> => {
  const client = await getClient();
  const res = await client.post(`/api/method/${BASE}.${method}`, args);
  const message = res.data?.message ?? res.data;
  // A refusal is `{error}` in a 200, not an HTTP error: surface it, never read it as a result.
  if (message?.error) throw new OpsError(message.error, message.code);
  return message as T;
};

export type FeedStatus = "Planned" | "Amended" | "Waiting for stock" | "Manufactured" | string;

export type DayComponent = {
  itemCode: string;
  itemName: string;
  uom: string;
  plannedKg: number;
  actualKg: number;
  plannedPerHead: number;
  actualPerHead: number;
  /** Not used at all that day: planned above 0, actual 0. */
  removed: boolean;
};

export type HerdDay = {
  herd: string;
  herdName: string;
  date: string;
  record: string;
  bom: string;
  headCount: number;
  status: FeedStatus;
  amended: boolean;
  remarks: string;
  plannedKg: number;
  actualKg: number;
  plannedPerHead: number;
  actualPerHead: number;
  varianceKg: number;
  components: DayComponent[];
  draftEntries: string[];
  workOrder: string;
  transferEntry: string;
  manufactureEntry: string;
  issueEntry: string;
  /** Pending after a manufacture that stayed a draft (what stock was short). */
  waitingFor: string[];
  /** Full day / Half day: what has been fed, what is owed, the sessions so far. */
  session: DaySession;
  /** Kilograms fed so far, across the day's sessions. */
  fedKg: number;
};

/** The server sends what stock is short as a sentence; older shapes sent a list. */
export const waitingForList = (w: unknown): string[] => {
  if (w === null || w === undefined || w === "") return [];
  if (typeof w === "string") return [w];
  if (Array.isArray(w)) return w.map((x: any) => (typeof x === "string" ? x : (x?.item_name ?? x?.item_code ?? String(x))));
  return [String(w)];
};

export type FeedDayProgram = {
  date: string;
  herds: HerdDay[];
  skipped: { herd: string; reason: string }[];
  setup: string[];
};

const n = (v: unknown): number => Number(v ?? 0) || 0;

export const mapHerdDay = (m: any): HerdDay => ({
  herd: m.herd,
  herdName: m.herd_name ?? m.herd,
  date: m.date,
  record: m.record ?? "",
  bom: m.bom ?? "",
  headCount: n(m.head_count),
  status: m.status ?? "Planned",
  amended: !!m.amended,
  remarks: m.remarks ?? "",
  plannedKg: n(m.planned_kg),
  actualKg: n(m.actual_kg),
  plannedPerHead: n(m.planned_per_head),
  actualPerHead: n(m.actual_per_head),
  varianceKg: n(m.variance_kg),
  components: (m.components ?? []).map((c: any) => ({
    itemCode: c.item_code,
    itemName: c.item_name ?? c.item_code,
    uom: c.uom ?? "kg",
    plannedKg: n(c.planned_kg),
    actualKg: n(c.actual_kg),
    plannedPerHead: n(c.planned_per_head),
    actualPerHead: n(c.actual_per_head),
    removed: !!c.removed || (n(c.planned_kg) > 0 && n(c.actual_kg) === 0),
  })),
  draftEntries: m.draft_entries ?? [],
  workOrder: m.stock?.work_order ?? "",
  transferEntry: m.stock?.transfer_stock_entry ?? "",
  manufactureEntry: m.stock?.manufacture_stock_entry ?? "",
  issueEntry: m.stock?.issue_stock_entry ?? "",
  waitingFor: waitingForList(m.waiting_for),
  session: mapSession(m.session),
  fedKg: n(m.fed_kg),
});

export const getFeedDayProgram = async (date?: string, herd?: string): Promise<FeedDayProgram> => {
  const m = await call("feed_actuals.feed_day_program", { date, herd });
  return {
    date: m.date,
    herds: (m.herds ?? []).map(mapHerdDay),
    skipped: m.skipped ?? [],
    setup: m.setup ?? [],
  };
};

/** Change the kg actually fed. `kgByItem` holds only what the operator changed;
 *  the server keeps every component left out at its current value. */
export const amendFeedDay = async (
  herd: string,
  date: string,
  kgByItem: Record<string, number>,
  remarks?: string,
  clientRef?: string,
): Promise<HerdDay> => {
  const components = Object.entries(kgByItem).map(([item_code, actual_kg]) => ({ item_code, actual_kg }));
  const m = await call("feed_actuals.amend_feed_day", {
    herd,
    date,
    components: JSON.stringify(components),
    remarks: remarks || undefined,
    client_ref: clientRef,
  });
  return mapHerdDay(m);
};

/** Put the day back at the recipe (drops its amendment). Refused once mixed. */
export const resetFeedDay = async (herd: string, date: string, clientRef?: string): Promise<HerdDay> => {
  const m = await call("feed_actuals.reset_feed_day", { herd, date, client_ref: clientRef });
  return mapHerdDay(m);
};

/** `feedSession` is "Full" or "Half" (the next half of the day); `override` is a manager's
 *  confirmed feeding of more than a day. Sent so the server mixes exactly that share. */
export const manufactureFeedActuals = async (
  herd: string,
  date: string,
  employee?: string | null,
  clientRef?: string,
  feedSession?: FeedChoice,
  override?: boolean,
): Promise<HerdDay> => {
  const m = await call("feed_actuals.manufacture_feed_actuals", {
    herd,
    date,
    employee: employee || undefined,
    feed_session: feedSession || undefined,
    override: override ? 1 : undefined,
    client_ref: clientRef,
  });
  return mapHerdDay({ ...m, waiting_for: m.waiting_for });
};

/** Below, above or on plan: no threshold, the sign of the variance. */
export type Appetite = "below" | "above" | "on_plan";

export type FeedTotals = { plannedKg: number; actualKg: number; belowPlan: number; abovePlan: number; onPlan: number };

const mapTotals = (t: any): FeedTotals => ({
  plannedKg: n(t?.planned_kg),
  actualKg: n(t?.actual_kg),
  belowPlan: n(t?.below_plan),
  abovePlan: n(t?.above_plan),
  onPlan: n(t?.on_plan),
});

export const toAppetite = (a: unknown): Appetite => (a === "below" || a === "above" ? a : "on_plan");

export type AnimalIntake = {
  animal: string;
  tag: string;
  plannedKg: number;
  actualKg: number;
  varianceKg: number;
  variancePct: number;
  appetite: Appetite;
};

export type HerdIntake = {
  herd: string;
  date: string;
  headCount: number;
  plannedKg: number;
  actualKg: number;
  varianceKg: number;
  variancePct: number;
  totals: FeedTotals;
  animals: AnimalIntake[];
};

export const getAnimalIntake = async (herd: string, date?: string): Promise<HerdIntake> => {
  const m = await call("feed_actuals.animal_intake", { herd, date });
  return {
    herd: m.herd,
    date: m.date,
    headCount: n(m.head_count),
    plannedKg: n(m.planned_kg),
    actualKg: n(m.actual_kg),
    varianceKg: n(m.variance_kg),
    variancePct: n(m.variance_pct),
    totals: mapTotals(m.totals),
    animals: (m.animals ?? []).map((a: any) => ({
      animal: a.animal,
      tag: a.tag ?? a.animal,
      plannedKg: n(a.planned_kg),
      actualKg: n(a.actual_kg),
      varianceKg: n(a.variance_kg),
      variancePct: n(a.variance_pct),
      appetite: toAppetite(a.appetite),
    })),
  };
};

export type ReportAnimal = {
  animal: string;
  tag: string;
  herd: string;
  plannedKg: number;
  actualKg: number;
  varianceKg: number;
  variancePct: number;
  appetite: Appetite;
  lastWeight: number | null;
  lastWeightDate: string;
  adg: number | null;
};

export type FeedReport = {
  date: string;
  herds: (Omit<HerdDay, "status" | "record" | "bom" | "remarks" | "plannedPerHead" | "actualPerHead" | "varianceKg" | "workOrder" | "transferEntry" | "manufactureEntry" | "issueEntry" | "waitingFor" | "session" | "fedKg"> & {
    dayState?: string;
    sessions?: DaySession["sessions"];
  })[];
  animals: ReportAnimal[];
  totals: FeedTotals;
};

const nullable = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

export const getDailyFeedReport = async (date?: string, herd?: string): Promise<FeedReport> => {
  const m = await call("daily_feed_report.daily_feed_report", { date, herd });
  return {
    date: m.date ?? date ?? "",
    herds: (m.herds ?? []).map((h: any) => {
      const d = mapHerdDay(h);
      return {
        herd: d.herd,
        herdName: d.herdName,
        date: d.date,
        headCount: d.headCount,
        amended: d.amended,
        plannedKg: d.plannedKg,
        actualKg: d.actualKg,
        components: d.components,
        draftEntries: d.draftEntries,
        dayState: h.day_state ?? "not_fed",
        sessions: mapSession({ sessions: h.sessions, state: h.day_state }).sessions,
      };
    }),
    animals: (m.animals ?? []).map((a: any) => ({
      animal: a.animal,
      tag: a.tag ?? a.animal,
      herd: a.herd,
      plannedKg: n(a.planned_kg),
      actualKg: n(a.actual_kg),
      varianceKg: n(a.variance_kg),
      variancePct: n(a.variance_pct),
      appetite: toAppetite(a.appetite),
      lastWeight: nullable(a.last_weight),
      lastWeightDate: a.last_weight_date ?? "",
      adg: nullable(a.adg),
    })),
    totals: mapTotals(m.totals),
  };
};
