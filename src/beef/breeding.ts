import type { Animal, Herd } from "@/types";

/** The server's minimum for the note that must accompany a selection move. */
export const NOTE_MIN_LENGTH = 20;

export const SELECTION_NOTE_PROMPT = "Describe the bull and why you are keeping him for breeding";

const byName = (herds: Herd[], name: string): Herd | undefined => herds.find((h) => h.n === name);

export const isBreedingHerd = (herds: Herd[], name: string): boolean => !!byName(herds, name)?.isBreeding;

/**
 * A *selection* is a male moving into a Breeding-class herd from a herd that is
 * not one: it decides his stream, and the server wants the herdsman's note.
 */
export function isSelectionMove(
  animal: Pick<Animal, "sex" | "herd">,
  toHerd: string,
  herds: Herd[],
): boolean {
  return animal.sex === "M" && isBreedingHerd(herds, toHerd) && !isBreedingHerd(herds, animal.herd);
}

/** The animals in `selected` that make this move a selection. */
export const selectionAnimals = (selected: Animal[], toHerd: string, herds: Herd[]): Animal[] =>
  selected.filter((a) => isSelectionMove(a, toHerd, herds));

/** `null` when the note is long enough, else what to tell the herdsman. */
export function selectionNoteError(note: string): string | null {
  const n = note.trim().length;
  if (n >= NOTE_MIN_LENGTH) return null;
  return `${SELECTION_NOTE_PROMPT} (at least ${NOTE_MIN_LENGTH} characters, ${n} so far).`;
}

export type BreedingCard = {
  herd: string;
  females: number;
  bulls: number;
  /** Bulls running with the herd, by name, from the phone's own animal list. */
  bullNames: string[];
};

const monthsOld = (dob: string, now = Date.now()) => {
  const t = Date.parse(dob);
  return Number.isNaN(t) ? 0 : (now - t) / (30.44 * 86_400_000);
};

/**
 * One highlighted card per Breeding-class herd (the mating groups: heifers with
 * their bulls, the cow groups, the bull reserve). Counts come from the server's herd row when it
 * sent them; otherwise they are counted from the local animals.
 */
export function breedingCards(
  herds: Herd[],
  animals: Animal[],
  bullMinAgeMonths = 18,
  now = Date.now(),
): BreedingCard[] {
  return herds
    .filter((h) => h.isBreeding)
    .map((h) => {
      const here = animals.filter((a) => a.herd === h.n);
      const bulls = here.filter(
        (a) => a.sex === "M" && (!a.dob || monthsOld(a.dob, now) >= bullMinAgeMonths),
      );
      const females = here.filter((a) => a.sex === "F");
      return {
        herd: h.n,
        females: h.females ?? females.length,
        bulls: h.bulls ?? bulls.length,
        bullNames: bulls.map((b) => b.name || b.id),
      };
    })
    .sort((a, b) => a.herd.localeCompare(b.herd));
}

/** Breeding-herd animals first, for the Service / PD pickers. */
export function breedingFirst<T extends { herd: string }>(items: T[], breedingHerds: Set<string>): T[] {
  const inBreeding = items.filter((i) => breedingHerds.has(i.herd));
  const rest = items.filter((i) => !breedingHerds.has(i.herd));
  return [...inBreeding, ...rest];
}
