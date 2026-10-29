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

export const CLASS_KEYS = ["females", "males", "young", "others"] as const;
export type ClassKey = (typeof CLASS_KEYS)[number];

/** One head-count class on a herd: ewes/does, rams/bucks, lambs/kids, others. */
export type HeadClass = { key: ClassKey; label: string; head: number };

export type ClassLabels = Record<ClassKey, string>;

export type NextDue = { mating: string; expectedBirthDate: string; daysToDue: number | null; femalesServed: number };

export type ShoatHerd = {
  name: string;
  label: string;
  species: Species | string;
  breed: string;
  /** Total head on the ledger. */
  head: number;
  classes: HeadClass[];
  labels: ClassLabels;
  avgKg: number | null;
  liveWeightKg: number | null;
  weightDate: string | null;
  weightBasis: string;
  paddock: string | null;
  withdrawalUntil: string | null;
  inWithdrawal: boolean;
  lastCountDate: string | null;
  hasRation: boolean;
  nextDue: NextDue | null;
};

/** One line of the ledger, signed, as the server writes it. */
export type LedgerEntry = {
  name: string;
  date: string;
  eventType: string;
  counts: Record<ClassKey, number>;
  bornDead: number;
  change: number;
  headAfter: number;
  cause: string;
  otherHerd: string;
  paddock: string;
  reason: string;
  amount: number;
  matingStart: string | null;
  matingEnd: string | null;
  expectedBirthDate: string | null;
  variance: Record<ClassKey, number> | null;
};

export type Mating = {
  name: string;
  matingStart: string | null;
  matingEnd: string | null;
  expectedBirthDate: string | null;
  daysToDue: number | null;
  status: string;
  femalesServed: number;
  malesIn: number;
  bornAlive: number;
  bornDead: number;
};

export type WeightSample = { name: string; date: string; sampleClass: string; animalsWeighed: number; averageKg: number };

export type ShoatTreatment = {
  name: string;
  date: string;
  treatmentType: string;
  productName: string;
  numberTreated: number;
  doseUom: string;
  quantity: number;
  withdrawalEnd: string | null;
};

export type ShoatHerdDetail = ShoatHerd & {
  ledger: LedgerEntry[];
  weights: WeightSample[];
  matings: Mating[];
  treatments: ShoatTreatment[];
};

export type ShoatOptions = {
  causes: string[];
  treatmentTypes: string[];
  drugStore: string;
  drugs: StockChoice[];
  gestationDays: number;
};

const num = (v: any): number | null => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const int = (v: any): number => Math.round(Number(v ?? 0)) || 0;

const DEFAULT_LABELS: ClassLabels = { females: "Ewes", males: "Rams", young: "Lambs", others: "Others" };

export const mapShoatHerd = (r: Record<string, any>): ShoatHerd => {
  const labels: ClassLabels = { ...DEFAULT_LABELS, ...(r.labels ?? {}) };
  const h = r.head ?? {};
  const total = typeof h === "number" ? h : int(h.total);
  return {
    name: r.name,
    label: r.label || r.name,
    species: r.species ?? "",
    breed: r.breed ?? "",
    head: total,
    classes: CLASS_KEYS.map((k) => ({ key: k, label: labels[k], head: typeof h === "number" ? 0 : int(h[k]) })),
    labels,
    avgKg: num(r.avg_weight_kg),
    liveWeightKg: num(r.live_weight_kg),
    weightDate: r.weight_date ?? null,
    weightBasis: r.weight_basis ?? "none",
    paddock: r.paddock || null,
    withdrawalUntil: r.withdrawal_until ?? null,
    inWithdrawal: !!r.in_withdrawal,
    lastCountDate: r.last_count_date ?? null,
    hasRation: !!r.has_ration,
    nextDue: r.next_due
      ? {
          mating: r.next_due.mating,
          expectedBirthDate: r.next_due.expected_birth_date,
          daysToDue: num(r.next_due.days_to_due),
          femalesServed: int(r.next_due.females_served),
        }
      : null,
  };
};

const countsOf = (r: Record<string, any>): Record<ClassKey, number> => ({
  females: int(r.females),
  males: int(r.males),
  young: int(r.young),
  others: int(r.others),
});

export const mapLedger = (r: Record<string, any>): LedgerEntry => ({
  name: r.name,
  date: r.event_date ?? "",
  eventType: r.event_type ?? "",
  counts: countsOf(r),
  bornDead: int(r.born_dead),
  change: int(r.change),
  headAfter: int(r.head_after),
  cause: r.cause ?? "",
  otherHerd: r.other_herd ?? "",
  paddock: r.paddock ?? "",
  reason: r.reason ?? "",
  amount: Number(r.amount ?? 0),
  matingStart: r.mating_start ?? null,
  matingEnd: r.mating_end ?? null,
  expectedBirthDate: r.expected_birth_date ?? null,
  variance: r.variance ? countsOf(r.variance) : null,
});

const mapMating = (r: Record<string, any>): Mating => ({
  name: r.name,
  matingStart: r.mating_start ?? null,
  matingEnd: r.mating_end ?? null,
  expectedBirthDate: r.expected_birth_date ?? null,
  daysToDue: num(r.days_to_due),
  status: r.status ?? "",
  femalesServed: int(r.females_served),
  malesIn: int(r.males_in),
  bornAlive: int(r.born_alive),
  bornDead: int(r.born_dead),
});

const unwrap = (res: any): any => {
  const m = res?.data?.message;
  if (!m) throw new Error("The server answered with nothing.");
  if (m.error) throw new OpsError(m.error, m.code);
  return m;
};

export const listShoatHerds = async (species?: Species | null): Promise<ShoatHerd[]> => {
  const client = await getClient();
  const m = unwrap(await client.get(`${NS}.shoat_herds.shoat_herds`, { params: species ? { species } : {} }));
  return ((m.herds ?? []) as any[]).map(mapShoatHerd);
};

export const getShoatHerd = async (herd: string): Promise<ShoatHerdDetail> => {
  const client = await getClient();
  const m = unwrap(await client.get(`${NS}.shoat_herd.shoat_herd`, { params: { herd } }));
  return {
    ...mapShoatHerd(m.herd),
    ledger: ((m.ledger ?? []) as any[]).map(mapLedger),
    weights: ((m.weights ?? []) as any[]).map((w) => ({
      name: w.name, date: w.sample_date, sampleClass: w.sample_class, animalsWeighed: int(w.animals_weighed), averageKg: Number(w.average_kg ?? 0),
    })),
    matings: ((m.matings ?? []) as any[]).map(mapMating),
    treatments: ((m.treatments ?? []) as any[]).map((x) => ({
      name: x.name, date: x.treatment_date, treatmentType: x.treatment_type, productName: x.product_name || x.product || "",
      numberTreated: int(x.number_treated), doseUom: x.dose_uom ?? "", quantity: Number(x.quantity ?? 0), withdrawalEnd: x.withdrawal_end ?? null,
    })),
  };
};

export const getShoatOptions = async (): Promise<ShoatOptions> => {
  const client = await getClient();
  const m = unwrap(await client.get(`${NS}.shoat_options.shoat_options`));
  const store: string = m.drug_store ?? "";
  return {
    causes: m.death_causes ?? [],
    treatmentTypes: m.treatment_types ?? [],
    drugStore: store,
    // The same shape the cattle pickers read: the Drug Store is the one store.
    drugs: ((m.drugs ?? []) as any[]).map((d) => ({
      value: d.item_code,
      label: d.item_name || d.item_code,
      item_name: d.item_name,
      qty: Number(d.qty ?? 0),
      uom: d.uom,
      warehouse: store,
      locations: [{ warehouse: store, qty: Number(d.qty ?? 0) }],
    })),
    gestationDays: Number(m.gestation_days ?? 150),
  };
};

// -- recording -----------------------------------------------------------

/** Head per class, by the server's generic keys (females, males, young, others). */
export type Counts = Partial<Record<ClassKey, number>>;

export type RecordResult = {
  /** The document made (count event, sample or treatment). */
  name?: string;
  /** The herd's head after the entry. */
  head: number | null;
  /** Head Count: counted minus the books, summed over the classes. */
  variance: number | null;
  warnings: string[];
  raw: any;
};

const post = async (fn: string, payload: Record<string, any>): Promise<RecordResult> => {
  const client = await getClient();
  const clean = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== "" && v !== null));
  const m = unwrap(await client.post(`${NS}.${fn}`, { payload: clean }));
  const created = m.created ?? {};
  const v = m.variance && typeof m.variance === "object" ? Object.values(m.variance as Record<string, number>).reduce((a, n) => a + Number(n || 0), 0) : num(m.variance);
  const h = m.head && typeof m.head === "object" ? int(m.head.total) : num(m.head);
  return { name: created.count_event ?? created.treatment ?? created.weight_sample, head: h, variance: v, warnings: m.warnings ?? [], raw: m };
};

export type WeighSample = { herd: string; sampleClass?: ClassKey | "All"; animalsWeighed: number; averageKg: number; eventDate?: string; operator?: string | null };

export const recordWeightSample = (s: WeighSample) =>
  post("record_weight_sample.record_weight_sample", {
    herd: s.herd,
    sample_class: s.sampleClass || "All",
    animals_weighed: s.animalsWeighed,
    average_kg: s.averageKg,
    event_date: s.eventDate,
    operator: s.operator,
  });

export type CountEventType = "Head Count" | "Birth" | "Death" | "Purchase" | "Sale" | "Slaughter" | "Transfer Out" | "Weaning" | "Mating";

export type CountEvent = {
  herd: string;
  eventType: CountEventType;
  eventDate?: string;
  counts: Counts;
  bornDead?: number;
  cause?: string;
  otherHerd?: string;
  paddock?: string;
  reason?: string;
  amount?: number;
  remarks?: string;
  operator?: string | null;
  matingStart?: string;
  matingEnd?: string;
};

export const recordCountEvent = (e: CountEvent) =>
  post("record_count_event.record_count_event", {
    herd: e.herd,
    event_type: e.eventType,
    event_date: e.eventDate,
    females: e.counts.females,
    males: e.counts.males,
    young: e.counts.young,
    others: e.counts.others,
    born_dead: e.bornDead,
    cause: e.cause,
    other_herd: e.otherHerd,
    paddock: e.paddock,
    reason: e.reason,
    amount: e.amount,
    remarks: e.remarks,
    mating_start: e.matingStart,
    mating_end: e.matingEnd,
    operator: e.operator,
  });

export type Treatment = {
  herd: string;
  treatmentType: string;
  product: string;
  warehouse?: string;
  dosePerHead: number;
  numberTreated: number;
  withdrawalDays?: number;
  diagnosis?: string;
  eventDate?: string;
  operator?: string | null;
};

export const recordTreatment = (t: Treatment) =>
  post("record_treatment.record_treatment", {
    herd: t.herd,
    treatment_type: t.treatmentType,
    product: t.product,
    warehouse: t.warehouse,
    dose_per_head: t.dosePerHead,
    number_treated: t.numberTreated,
    withdrawal_days: t.withdrawalDays,
    diagnosis: t.diagnosis,
    event_date: t.eventDate,
    operator: t.operator,
  });

/** Take back a record this phone made (used by the smoke script's cleanup, and a desk undo). */
export const cancelShoatRecord = async (kind: "count_event" | "treatment" | "weight_sample", name: string) => {
  const client = await getClient();
  return unwrap(await client.post(`${NS}.cancel_shoat_record.cancel_shoat_record`, { payload: { kind, name } }));
};
