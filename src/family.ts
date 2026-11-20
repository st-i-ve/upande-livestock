/**
 * What an animal's page shows by sex, and her family, as pure functions so the
 * rules are tested apart from the screen.
 *
 * A male never shows a female's figures (parity, in-calf, calving interval,
 * services per conception, PD or Service actions). A male kept for breeding —
 * the Breeding stream, the "bull" stage, a Breeding-class herd, or a sire on
 * record (the server's `breedingBull`) — shows his record as a sire. Any other
 * male is a steer: weights and gain, no breeding section.
 */

export type Sections = {
  /** Her repro figures: parity, PD, Service, calving. */
  female: boolean;
  /** His record as a sire: cows bred, services, last service, conception rate. */
  bull: boolean;
  /** A male on the weight ladder, with no breeding section. */
  steer: boolean;
};

export type SectionFacts = {
  sex?: string | null;
  stage?: string | null;
  stream?: string | null;
  /** Herds.herd_class of his current herd, when known. */
  herdClass?: string | null;
  /** The server's verdict (animal_family.breedingBull). */
  breedingBull?: boolean | null;
};

export const isMale = (sex?: string | null) => String(sex ?? "").toUpperCase().startsWith("M");

export function sectionsFor(a: SectionFacts): Sections {
  if (!isMale(a.sex)) return { female: true, bull: false, steer: false };
  const bull =
    !!a.breedingBull || a.stage === "bull" || a.stream === "Breeding" || a.herdClass === "Breeding";
  return { female: false, bull, steer: !bull };
}

/** The standing measures that only mean something for a female. */
export const FEMALE_MEASURES = ["parity", "services_per_conception", "calving_interval"] as const;

export function measuresFor<T extends { key: string }>(metrics: T[], male: boolean): T[] {
  return male ? metrics.filter((m) => !(FEMALE_MEASURES as readonly string[]).includes(m.key)) : metrics;
}

export type Kin = {
  /** Null for a sire known only by a name written in (an A.I. bull). */
  id: string | null;
  name: string;
  tag?: string | null;
  sex: string | null;
  dob: string | null;
  status?: string | null;
  /** False once sold, dead, culled or disabled. */
  active: boolean;
  herd?: string | null;
  photo?: string | null;
  thumb?: string | null;
  onRecord?: boolean;
};

export type BullRecord = {
  cows: number;
  services: number;
  lastService: string | null;
  conceptions: number;
  conceptionRate: number | null;
};

export type Family = {
  parents: { dam: Kin | null; sire: Kin | null };
  offspring: Kin[];
  sons: number;
  daughters: number;
  bred: BullRecord | null;
  breedingBull: boolean;
  /** Worked out from the phone's own animals (offline): sold calves are missing. */
  local?: boolean;
};

export type KnownParent = { role: "Dam" | "Sire"; kin: Kin };

/**
 * What the family tree draws: only the parents that are known (no "not
 * recorded" boxes), the offspring only when there are some, and nothing at all
 * when the animal has neither a parent nor a calf on record.
 */
export function treeParts(family: Family | null | undefined): {
  parents: KnownParent[];
  offspring: boolean;
  show: boolean;
} {
  if (!family) return { parents: [], offspring: false, show: false };
  const parents: KnownParent[] = [];
  if (family.parents.dam) parents.push({ role: "Dam", kin: family.parents.dam });
  if (family.parents.sire) parents.push({ role: "Sire", kin: family.parents.sire });
  const offspring = family.offspring.length > 0;
  return { parents, offspring, show: parents.length > 0 || offspring };
}

export function countOffspring(kids: { sex: string | null }[]) {
  let sons = 0;
  let daughters = 0;
  for (const k of kids) {
    if (isMale(k.sex)) sons += 1;
    else if (String(k.sex ?? "").toUpperCase().startsWith("F")) daughters += 1;
  }
  return { sons, daughters, total: kids.length };
}

/** Youngest first; calves with no birth date last. */
export function sortOffspring<T extends { dob: string | null; id: string | null }>(kids: T[]): T[] {
  return [...kids].sort((a, b) => {
    if (a.dob && b.dob) return a.dob < b.dob ? 1 : a.dob > b.dob ? -1 : String(a.id).localeCompare(String(b.id));
    if (a.dob) return -1;
    if (b.dob) return 1;
    return String(a.id).localeCompare(String(b.id));
  });
}

/** The phone's own row shape (src/db/animals.ts): `sire` is the sire's id or written name. */
export type LocalKin = {
  id: string;
  name: string;
  tag?: string | null;
  sex: string;
  dob: string;
  dam?: string | null;
  sire?: string | null;
  status?: string | null;
  herd?: string;
  image?: string | null;
  thumb?: string | null;
};

const toKin = (r: LocalKin): Kin => ({
  id: r.id,
  name: r.name,
  tag: r.tag ?? null,
  sex: isMale(r.sex) ? "Male" : "Female",
  dob: r.dob || null,
  status: r.status ?? null,
  active: !r.status || r.status === "Active",
  herd: r.herd ?? null,
  photo: r.image ?? null,
  thumb: r.thumb ?? null,
  onRecord: true,
});

/**
 * Her family from the phone's own animals, for when there is no signal. Only
 * animals still on the farm are on the phone, so disposed calves are missing.
 */
export function localFamily(me: LocalKin, all: LocalKin[]): Family {
  const ids = new Set([me.id, me.name].filter(Boolean));
  const male = isMale(me.sex);
  const kids = all.filter(
    (r) => r.id !== me.id && (male ? !!r.sire && ids.has(r.sire) : r.dam === me.id),
  );
  const byKey = (key?: string | null) =>
    key ? all.find((r) => r.id === key) ?? all.find((r) => r.name === key) ?? null : null;
  const dam = byKey(me.dam);
  const sire = byKey(me.sire);
  const offspring = sortOffspring(kids.map(toKin));
  return {
    parents: {
      dam: dam ? toKin(dam) : me.dam ? { id: me.dam, name: me.dam, sex: "Female", dob: null, active: false, onRecord: false } : null,
      sire: sire ? toKin(sire) : me.sire ? { id: null, name: me.sire, sex: "Male", dob: null, active: false, onRecord: false } : null,
    },
    offspring,
    ...countOffspring(offspring),
    bred: null,
    breedingBull: male && offspring.length > 0,
    local: true,
  };
}
