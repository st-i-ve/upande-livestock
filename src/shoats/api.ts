import { OpsError } from "@/src/frappe/opsError";
import type { StockChoice } from "@/src/frappe/eventItems";
import { getClient } from "@/src/services/api";

/**
 * Shoat (sheep and goat) herds, counted by number. Every call is a whitelisted
 * method under `upande_livestock.serverscripts.shoats`; a refusal comes back as
 * `{error, code?}` with HTTP 200 and is thrown as an OpsError so the screens show
 * the server's own words.
 */
const NS = "/api/method/upande_livestock.serverscripts.shoats";

export type Species = "Sheep" | "Goat";

/** One head-count class on a herd: ewes/does, rams/bucks, lambs/kids, others. */
export type HeadClass = { key: string; label: string; head: number };

export type ShoatHerd = {
  name: string;
  label: string;
  species: Species | string;
  head: number;
  classes: HeadClass[];
  avgKg: number | null;
  liveWeightKg: number | null;
  lastSampleDate: string | null;
  paddock: string | null;
  withdrawalUntil: string | null;
  expectedBirth: string | null;
};

export type LedgerEntry = {
  name: string;
  date: string;
  eventType: string;
  /** One line the server wrote: "Birth: 12 lambs alive, 1 dead". */
  summary: string;
  head: number | null;
  variance: number | null;
};

export type ShoatHerdDetail = ShoatHerd & { ledger: LedgerEntry[] };

export type ShoatOptions = {
  causes: string[];
  treatmentTypes: string[];
  paddocks: string[];
  drugs: StockChoice[];
  gestationDays: number;
};

const num = (v: any): number | null => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

export const mapClass = (r: Record<string, any>): HeadClass => ({
  key: String(r.key ?? r.class ?? r.name),
  label: String(r.label ?? r.key ?? r.class ?? r.name),
  head: Number(r.head ?? r.count ?? 0),
});

export const mapShoatHerd = (r: Record<string, any>): ShoatHerd => ({
  name: r.name,
  label: r.label || r.herd_name || r.name,
  species: r.species ?? "",
  head: Number(r.head ?? r.heads ?? 0),
  classes: ((r.classes ?? []) as any[]).map(mapClass),
  avgKg: num(r.avg_kg ?? r.average_kg),
  liveWeightKg: num(r.live_weight_kg),
  lastSampleDate: r.last_sample_date ?? null,
  paddock: r.paddock ?? null,
  withdrawalUntil: r.withdrawal_until ?? null,
  expectedBirth: r.expected_birth ?? null,
});

export const mapLedger = (r: Record<string, any>): LedgerEntry => ({
  name: r.name,
  date: r.date ?? r.event_date ?? "",
  eventType: r.event_type ?? "",
  summary: r.summary ?? "",
  head: num(r.head ?? r.head_after),
  variance: num(r.variance),
});

const unwrap = (res: any): any => {
  const m = res?.data?.message;
  if (!m) throw new Error("The server answered with nothing.");
  if (m.error) throw new OpsError(m.error, m.code);
  return m;
};

export const listShoatHerds = async (species?: Species | null): Promise<ShoatHerd[]> => {
  const client = await getClient();
  const m = unwrap(await client.get(`${NS}.herds.shoat_herds`, { params: species ? { species } : {} }));
  return ((m.herds ?? []) as any[]).map(mapShoatHerd);
};

export const getShoatHerd = async (herd: string): Promise<ShoatHerdDetail> => {
  const client = await getClient();
  const m = unwrap(await client.get(`${NS}.herds.shoat_herd`, { params: { herd } }));
  const h = m.herd ?? m;
  return { ...mapShoatHerd(h), ledger: ((m.ledger ?? h.ledger ?? []) as any[]).map(mapLedger) };
};

export const getShoatOptions = async (): Promise<ShoatOptions> => {
  const client = await getClient();
  const m = unwrap(await client.get(`${NS}.options.shoat_options`));
  return {
    causes: m.causes ?? [],
    treatmentTypes: m.treatment_types ?? [],
    paddocks: m.paddocks ?? [],
    drugs: m.drugs ?? [],
    gestationDays: Number(m.gestation_days ?? 150),
  };
};

// -- recording -----------------------------------------------------------

export type Counts = Record<string, number>;

export type RecordResult = { name?: string; head?: number | null; variance?: number | null; warnings: string[]; raw: any };

const post = async (fn: string, payload: Record<string, any>): Promise<RecordResult> => {
  const client = await getClient();
  const m = unwrap(await client.post(`${NS}.${fn}`, payload));
  return { name: m.name, head: num(m.head), variance: num(m.variance), warnings: m.warnings ?? [], raw: m };
};

export type WeighSample = { herd: string; headClass?: string; animalsWeighed: number; averageKg: number; eventDate?: string };

export const recordWeighSample = (s: WeighSample) =>
  post("record.record_weight_sample", {
    herd: s.herd,
    class: s.headClass || undefined,
    animals_weighed: s.animalsWeighed,
    average_kg: s.averageKg,
    event_date: s.eventDate,
  });

export type CountEventType =
  | "Head Count"
  | "Birth"
  | "Death"
  | "Purchase"
  | "Sale"
  | "Slaughter"
  | "Transfer Out"
  | "Weaning"
  | "Mating";

export type CountEvent = {
  herd: string;
  eventType: CountEventType;
  eventDate?: string;
  counts: Counts;
  cause?: string;
  toHerd?: string;
  toPaddock?: string;
  reason?: string;
  amount?: number;
  remarks?: string;
  operator?: string | null;
  /** Mating: rams or bucks put in with the females, and when they come out. */
  ramsIn?: number;
  endDate?: string;
  /** Birth: lambs or kids born alive and born dead. */
  bornAlive?: number;
  bornDead?: number;
  /** Weaning: the class the weaned young move into (or `toHerd`). */
  toClass?: string;
};

export const recordCountEvent = (e: CountEvent) =>
  post("record.record_count_event", {
    herd: e.herd,
    event_type: e.eventType,
    event_date: e.eventDate,
    counts: e.counts,
    cause: e.cause || undefined,
    to_herd: e.toHerd || undefined,
    to_paddock: e.toPaddock || undefined,
    reason: e.reason || undefined,
    amount: e.amount || undefined,
    remarks: e.remarks || undefined,
    recorded_by: e.operator || undefined,
    rams_in: e.ramsIn || undefined,
    end_date: e.endDate || undefined,
    born_alive: e.bornAlive,
    born_dead: e.bornDead,
    to_class: e.toClass || undefined,
  });

export type Treatment = {
  herd: string;
  treatmentType: string;
  itemCode: string;
  warehouse?: string;
  dosePerHead: number;
  numberTreated: number;
  withdrawalDays?: number;
  eventDate?: string;
  remarks?: string;
  operator?: string | null;
};

export const recordTreatment = (t: Treatment) =>
  post("record.record_treatment", {
    herd: t.herd,
    treatment_type: t.treatmentType,
    item_code: t.itemCode,
    warehouse: t.warehouse || undefined,
    dose_per_head: t.dosePerHead,
    number_treated: t.numberTreated,
    withdrawal_days: t.withdrawalDays,
    event_date: t.eventDate,
    remarks: t.remarks || undefined,
    recorded_by: t.operator || undefined,
  });

export type Feeding = { herd: string; eventDate?: string; remarks?: string; operator?: string | null };

export const recordFeeding = (f: Feeding) =>
  post("record.record_feeding", {
    herd: f.herd,
    event_date: f.eventDate,
    remarks: f.remarks || undefined,
    recorded_by: f.operator || undefined,
  });
