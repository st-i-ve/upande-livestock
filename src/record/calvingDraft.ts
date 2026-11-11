import type { RetroDraft } from "@/src/breeding/birthWindow";

/**
 * What "Continue recording" keeps of a Calving form: the dam, the outcome (an
 * abortion's cause and notes), the calves, the backdated day, and the retro
 * path (the service with its type, straw and bull, the optional pregnancy
 * diagnosis, and the herd she was in that day).
 */
export type CalvingDraftCalf = {
  key: number;
  sex: "Female" | "Male";
  burnName: string;
  birthWt: string;
  coat: string;
  health: "Healthy" | "Weak" | "Needs Attention" | "Critical";
  herdPick: string;
  isStillborn: boolean;
  photo: unknown;
};

export type CalvingDraft<Dam extends { id: string } = { id: string }, Calf extends CalvingDraftCalf = CalvingDraftCalf> = {
  dam: Dam | null;
  outcome: "Live Birth" | "Still Birth" | "Abortion";
  abortionCause: string;
  coatNote: string;
  calves: Calf[];
  /** The backdated birth day ("" when not backdating). */
  day: string;
  retro: RetroDraft | null;
  /** The herd on the service date was chosen by hand (not her history's). */
  herdTouched: boolean;
  strawUom: string;
};

/** Anything typed or chosen? The defaults (a live birth, one healthy heifer calf, Unknown cause) are not. */
export function calvingFilled(d: CalvingDraft): boolean {
  if (d.dam) return true;
  if (d.outcome !== "Live Birth" || d.abortionCause !== "Unknown" || d.coatNote.trim()) return true;
  if (d.calves.length !== 1) return true;
  return d.calves.some(
    (c) =>
      c.sex !== "Female" ||
      c.health !== "Healthy" ||
      c.isStillborn ||
      !!c.photo ||
      !!(c.burnName.trim() || c.birthWt.trim() || c.coat.trim() || c.herdPick),
  );
}

/**
 * The retro path waiting to be put back after a restore. The form resets the
 * retro path whenever the dam or the birth day changes (a new birth check);
 * a restore changes both, so the kept retro path is held here and handed back
 * on the reset for exactly that dam and day.
 */
export type HeldRetro = { dam: string; day: string; retro: RetroDraft | null; herdTouched: boolean };

/**
 * On a dam / day change: what the retro path becomes, and what is still held.
 * The held one is used once, for its own dam and day; any other change starts
 * over, leaving it held only while no dam is picked yet (the first render).
 */
export function retroOnReset(
  held: HeldRetro | null,
  dam: string | null,
  day: string,
): { retro: RetroDraft | null; herdTouched: boolean; held: HeldRetro | null } {
  if (held && dam === held.dam && day === held.day) {
    return { retro: held.retro, herdTouched: held.herdTouched, held: null };
  }
  return { retro: null, herdTouched: false, held: dam ? (held && held.dam === dam ? held : null) : held };
}
