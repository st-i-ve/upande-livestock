import type { Animal } from "@/types";
import { getClient } from "@/src/services/api";

export const ANIMAL_LIST_FIELDS = [
  "name",
  "burn_name",
  "sex",
  "date_of_birth",
  "current_herd",
  "repro_status",
  "days_in_milk",
  "parity",
  "last_weight_kg",
  "milk_safe_date",
  "in_treatment",
] as const;

type AnimalRow = Record<(typeof ANIMAL_LIST_FIELDS)[number], any> &
  Record<string, any>;

export type AnimalWeightRecord = {
  recordingDate: string;
  weightKg: number;
  bcs: number;
  dailyGainG: number;
  eventRef: string | null;
};

export type AnimalDetail = Animal & {
  acquisitionDate: string | null;
  origin: string | null;
  sire: string | null;
  dam: string | null;
  status: string | null;
  weightHistory: AnimalWeightRecord[];
};

const sexFromFrappe = (raw: any): "F" | "M" =>
  String(raw ?? "").toLowerCase().startsWith("m") ? "M" : "F";

const pregnantFromRepro = (raw: any): 0 | 1 =>
  String(raw ?? "").toLowerCase().includes("pregnant") ? 1 : 0;

export const mapAnimal = (row: AnimalRow): Animal => ({
  id: row.name,
  name: row.burn_name || row.name,
  sex: sexFromFrappe(row.sex),
  dob: row.date_of_birth ?? "",
  herd: row.current_herd ?? "",
  repro: row.repro_status ?? "",
  dim: row.days_in_milk ?? null,
  parity: row.parity ?? 0,
  lastWt: row.last_weight_kg ?? 0,
  milkSafe: row.milk_safe_date ?? null,
  inTreatment: row.in_treatment ? 1 : 0,
  pregnant: pregnantFromRepro(row.repro_status),
});

const mapWeightRow = (row: any): AnimalWeightRecord => ({
  recordingDate: row?.recording_date ?? "",
  weightKg: Number(row?.weight_kg ?? 0),
  bcs: Number(row?.bcs ?? 0),
  dailyGainG: Number(row?.daily_gain_g ?? 0),
  eventRef: row?.event_ref ?? null,
});

const mapAnimalDetail = (row: AnimalRow): AnimalDetail => ({
  ...mapAnimal(row),
  acquisitionDate: row.acquisition_date ?? null,
  origin: row.origin ?? null,
  sire: row.sire_name ?? null,
  dam: row.dam ?? null,
  status: row.status ?? null,
  weightHistory: Array.isArray(row.weight_history)
    ? row.weight_history.map(mapWeightRow)
    : [],
});

const safeMap = <T>(rows: any[], mapper: (r: any) => T): T[] => {
  const out: T[] = [];
  for (const r of rows) {
    try {
      out.push(mapper(r));
    } catch (e) {
      console.warn("[frappe/animal] row mapping failed", e, r);
    }
  }
  return out;
};

export const getAnimals = async (): Promise<Animal[]> => {
  const client = await getClient();
  const res = await client.get("/api/resource/Animal", {
    params: {
      fields: JSON.stringify(ANIMAL_LIST_FIELDS),
      limit_page_length: 1000,
      order_by: "name asc",
    },
  });
  const rows = (res.data?.data ?? []) as any[];
  return safeMap(rows, mapAnimal);
};

export const getAnimal = async (id: string): Promise<AnimalDetail | null> => {
  const client = await getClient();
  try {
    const res = await client.get(
      `/api/resource/Animal/${encodeURIComponent(id)}`,
    );
    const row = res.data?.data;
    if (!row) return null;
    return mapAnimalDetail(row);
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
};
