import type { Animal } from "@/types";
import { getClient } from "@/src/services/api";

type AnimalRow = Record<string, any>;

export type AnimalDetail = Animal & {
  acquisitionDate: string | null;
  origin: string | null;
  sire: string | null;
  dam: string | null;
  status: string | null;
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
  dim: null,
  parity: row.parity ?? 0,
  lastWt: row.last_weight_kg ?? 0,
  milkSafe: null,
  inTreatment: 0,
  pregnant: pregnantFromRepro(row.repro_status),
});

const mapAnimalDetail = (row: AnimalRow): AnimalDetail => ({
  ...mapAnimal(row),
  acquisitionDate: row.acquisition_date ?? null,
  origin: row.origin ?? null,
  sire: row.sire_name ?? null,
  dam: row.dam ?? null,
  status: row.status ?? null,
  tag: row.tag_number ?? null,
  breed: row.breed ?? null,
  image: row.image ?? null,
});

const ANIMAL_PROFILE =
  "/api/method/upande_livestock.serverscripts.animals.animal_profile.animal_profile";

export type AnimalProfile = {
  id: string;
  name: string;
  sex: string | null;
  herd: string;
  breed: string | null;
  bornOn: string | null;
  stage: "heifer" | "fresh" | "open" | "served" | "confirmed" | "dry" | "retired";
  photo: string | null;
  dam: string | null;
  sire: string | null;
  cycle: { daysInMilk: number | null };
};

/**
 * What the desk's Animals page shows about her — the same `animal_profile` call,
 * so the stage and the facts read the same on both. Online only; the phone's
 * local copy answers when there is no signal.
 */
export const getAnimalProfile = async (id: string): Promise<AnimalProfile | null> => {
  const client = await getClient();
  const res = await client.post(ANIMAL_PROFILE, { payload: { animal: id } });
  const m = res.data?.message;
  return m && !m.error ? (m as AnimalProfile) : null;
};

/**
 * One animal's online extras: the open health file's withdrawal date and "in
 * treatment". Best effort: a user without health permissions simply sees no
 * treatment banner, and the screen still opens.
 */
export const getAnimal = async (id: string): Promise<AnimalDetail | null> => {
  const client = await getClient();
  let row: AnimalRow | undefined;
  try {
    const res = await client.get(`/api/resource/Animal/${encodeURIComponent(id)}`);
    row = res.data?.data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
  if (!row) return null;
  const detail = mapAnimalDetail(row);

  const cases = await client
    .get("/api/resource/Livestock Health Case", {
      params: {
        fields: JSON.stringify(["name", "milk_safe_date"]),
        filters: JSON.stringify([
          ["animal", "=", id],
          ["docstatus", "=", 1],
          ["case_status", "in", ["Open", "Under Treatment"]],
        ]),
        limit_page_length: 1,
      },
    })
    .catch(() => null);
  const open = cases?.data?.data?.[0];
  if (open) {
    detail.inTreatment = 1;
    detail.milkSafe = open.milk_safe_date ?? null;
  }
  return detail;
};
