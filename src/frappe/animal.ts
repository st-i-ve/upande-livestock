import type { Animal } from "@/types";
import { getClient } from "@/src/services/api";

// Fields that exist on the Animal doctype. `days_in_milk`, `milk_safe_date`,
// `in_treatment` and `insured_value` were trimmed off it (a lactation's day count
// is worked out from her events, a withdrawal date lives on her health case and
// insurance on its policy), so asking for them fails the whole list with "Field
// not permitted in query".
export const ANIMAL_LIST_FIELDS = [
  "name",
  "burn_name",
  "sex",
  "date_of_birth",
  "current_herd",
  "repro_status",
  "parity",
  "last_weight_kg",
] as const;

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
      // Retired animals (sold, dead, culled) are not offered to a form.
      filters: JSON.stringify([["disabled", "=", 0]]),
      limit_page_length: 1000,
      order_by: "name asc",
    },
  });
  const rows = (res.data?.data ?? []) as any[];
  return safeMap(rows, mapAnimal);
};

const ANIMAL_PROFILE =
  "/api/method/upande_livestock.serverscripts.animals.animal_profile.animal_profile";

/**
 * One animal, with what the server works out about her.
 *
 * Days in milk comes from `animal_profile` (her calving history decides it, not
 * a column), and the withdrawal date and "in treatment" from her open health
 * file. Both are best effort: a user without health permissions simply sees no
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

  const [profile, cases] = await Promise.all([
    client.post(ANIMAL_PROFILE, { payload: { animal: id } }).catch(() => null),
    client
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
      .catch(() => null),
  ]);
  const dim = profile?.data?.message?.cycle?.daysInMilk;
  if (typeof dim === "number") detail.dim = dim;
  const open = cases?.data?.data?.[0];
  if (open) {
    detail.inTreatment = 1;
    detail.milkSafe = open.milk_safe_date ?? null;
  }
  return detail;
};
