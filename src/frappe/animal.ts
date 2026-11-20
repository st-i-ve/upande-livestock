import type { Animal } from "@/types";
import type { Family } from "@/src/family";
import { useAuthStore } from "@/src/auth/authStore";
import { getClient } from "@/src/services/api";
import { storage } from "@/src/services/storage";

type AnimalRow = Record<string, any>;

export type AnimalDetail = Animal & {
  acquisitionDate: string | null;
  origin: string | null;
  sire: string | null;
  dam: string | null;
  status: string | null;
  /** Males: "Feedlot" or "Breeding", set by the move that decided it. */
  stream: string | null;
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
  sire: row.sire_name || row.sire || null,
  dam: row.dam ?? null,
  stream: row.stream || null,
  status: row.status ?? null,
  tag: row.tag_number ?? null,
  breed: row.breed ?? null,
  image: row.image ?? null,
});

const ANIMAL_PROFILE =
  "/api/method/upande_livestock.serverscripts.animals.animal_profile.animal_profile";

export type BullState = {
  state: "At rest" | "In breeding cycle";
  lastService: string | null;
  reason: string;
};

/** The cycle the server describes; a female's carries days in milk (see AnimalProfile.cycle). */
export type CycleState = {
  kind?: "repro" | "growth" | "bull" | "unknown" | "retired";
  stage: string;
  /** "Breeding bull" or "Young bull". */
  class?: string;
  bull?: BullState;
  dayInStage?: number;
  nextUp?: string;
  nextOn?: string | null;
};

export type AnimalProfile = {
  id: string;
  name: string;
  sex: string | null;
  herd: string;
  breed: string | null;
  bornOn: string | null;
  stage: "heifer" | "fresh" | "open" | "served" | "confirmed" | "dry" | "retired" | string;
  photo: string | null;
  /** ~240 px version of `photo`. */
  thumb?: string | null;
  dam: string | null;
  sire: string | null;
  cycle: CycleState & { daysInMilk: number | null };
  /** True when this is the last saved answer, shown because the phone is offline. */
  cached?: boolean;
};

const profileKey = (id: string) => `animal-profile:${useAuthStore.getState().instanceUrl}:${id}`;

/**
 * What the desk's Animals page shows about the animal (the same `animal_profile`
 * call, so stage and cycle read the same on both). The last answer is kept per
 * site and animal, so one looked at once still opens without signal.
 */
export const getAnimalProfile = async (id: string): Promise<AnimalProfile | null> => {
  try {
    const client = await getClient();
    const res = await client.post(ANIMAL_PROFILE, { payload: { animal: id } });
    const m = res.data?.message;
    if (!m || m.error) return null;
    await storage.setItem(profileKey(id), JSON.stringify(m)).catch(() => {});
    return m as AnimalProfile;
  } catch (err) {
    const raw = await storage.getItem(profileKey(id)).catch(() => null);
    if (raw) {
      try {
        return { ...(JSON.parse(raw) as AnimalProfile), cached: true };
      } catch {
        /* fall through */
      }
    }
    throw err;
  }
};

/**
 * One animal's online extras: "in treatment" and the
 * stream. Best effort: a user without health permissions simply sees no
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

const ANIMAL_FAMILY =
  "/api/method/upande_livestock.serverscripts.animals.animal_family.animal_family";

const familyKey = (id: string) => `animal-family:${useAuthStore.getState().instanceUrl}:${id}`;

/**
 * Her dam and sire, every calf she or he left (sold and dead ones too, with
 * their status), and a male's record as a sire. The last answer is kept, like
 * the profile; with neither signal nor a saved answer, null (the caller works
 * it out from the phone's own animals).
 */
export const getAnimalFamily = async (id: string): Promise<Family | null> => {
  try {
    const client = await getClient();
    const res = await client.post(ANIMAL_FAMILY, { payload: { animal: id } });
    const m = res.data?.message;
    if (!m || m.error) return null;
    await storage.setItem(familyKey(id), JSON.stringify(m)).catch(() => {});
    return m as Family;
  } catch {
    const raw = await storage.getItem(familyKey(id)).catch(() => null);
    if (raw) {
      try {
        return JSON.parse(raw) as Family;
      } catch {
        /* fall through */
      }
    }
    return null;
  }
};
