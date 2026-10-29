/** One bull who was in the female's herd around the conception date. */
export type SireCandidate = { animal: string; label: string; basis: string };

export type SireResult = {
  /** The bull the server settled on: exactly one candidate (inferred) or the user's choice. */
  sireAnimal: string | null;
  label: string;
  inferred: boolean;
  basis: string;
  candidates: SireCandidate[];
};

export const NO_SIRE: SireResult = { sireAnimal: null, label: "", inferred: false, basis: "", candidates: [] };

/** Normalise `sire_candidates` / the sire fields of a service or PD reply. */
export function parseSire(m: any): SireResult {
  if (!m || typeof m !== "object") return NO_SIRE;
  const candidates: SireCandidate[] = Array.isArray(m.candidates)
    ? m.candidates.map((c: any) => ({ animal: String(c.animal), label: String(c.label ?? c.animal), basis: String(c.basis ?? "") }))
    : [];
  return {
    sireAnimal: m.sire_animal || null,
    label: m.label ?? m.sire_label ?? "",
    inferred: !!(m.inferred ?? m.sire_inferred),
    basis: m.basis ?? m.sire_basis ?? "",
    candidates,
  };
}

/**
 * What the sire line should say on the form:
 *  - one bull: he is named, and the herdsman may keep him or pick "unknown";
 *  - several: the herdsman must pick (or say unknown);
 *  - none: a plain warning.
 */
export type SireState =
  | { kind: "inferred"; label: string; basis: string }
  | { kind: "choose"; candidates: SireCandidate[] }
  | { kind: "none"; basis: string };

export function sireState(r: SireResult): SireState {
  if (r.sireAnimal) return { kind: "inferred", label: r.label || r.sireAnimal, basis: r.basis };
  if (r.candidates.length > 1) return { kind: "choose", candidates: r.candidates };
  if (r.candidates.length === 1) {
    const c = r.candidates[0];
    return { kind: "inferred", label: c.label, basis: c.basis };
  }
  return { kind: "none", basis: r.basis };
}
