/**
 * The server's inbreeding preview (`movement.kinship_check`). Warn, never block:
 * the herdsman sees what it says before he confirms, and the move still goes
 * through.
 */
export type KinshipConflict = {
  other: string;
  other_label?: string;
  relation: "sire-daughter" | "dam-son" | "full-siblings" | "half-siblings" | string;
  shared_parent?: string | null;
  message?: string;
};

export type KinshipCheck = {
  warnings: string[];
  conflicts: KinshipConflict[];
  /** The move would be a selection (male into a Breeding herd). */
  selection: boolean;
  noteRequired: boolean;
  stream: "Feedlot" | "Breeding" | null;
};

export const NO_KINSHIP: KinshipCheck = {
  warnings: [],
  conflicts: [],
  selection: false,
  noteRequired: false,
  stream: null,
};

/** Normalise the server reply; missing keys mean "nothing to say". */
export function parseKinship(m: any): KinshipCheck {
  if (!m || typeof m !== "object") return NO_KINSHIP;
  const conflicts: KinshipConflict[] = Array.isArray(m.conflicts) ? m.conflicts : [];
  const fromConflicts = conflicts.map((c) => c.message).filter((x): x is string => !!x);
  const warnings: string[] = Array.isArray(m.warnings) && m.warnings.length ? m.warnings.map(String) : fromConflicts;
  return {
    warnings,
    conflicts,
    selection: !!m.selection,
    noteRequired: !!m.note_required,
    stream: m.stream === "Feedlot" || m.stream === "Breeding" ? m.stream : null,
  };
}

/** Warnings from several previews or write replies, de-duplicated, order kept. */
export const mergeWarnings = (...lists: (string[] | undefined | null)[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lists) for (const w of l ?? []) if (w && !seen.has(w)) { seen.add(w); out.push(w); }
  return out;
};
