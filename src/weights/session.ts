/**
 * What Record → Weight does with its form after a save, kept apart from the
 * screen so it can be tested: which animals stay on the list, the kilos to
 * write to the local rows, and the line the success tick shows.
 */
import type { WeighingMode, WeightOutcome } from "@/src/frappe/weights";

export type Entry = { weight: string; girth: string; bcs: string };
export const EMPTY_ENTRY: Entry = { weight: "", girth: "", bcs: "" };

export const num = (v: string) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
export const kg = (n: number) => (Math.round(n * 10) / 10).toString();

type Pick = { id: string; name?: string };

export type FormState<A extends Pick> = {
  selected: A[];
  entries: Record<string, Entry>;
  groupFigure: string;
};

/** Everything saved and nothing refused: the tick shows and the form clears. */
export const allSaved = (o: WeightOutcome) => o.count > 0 && o.failed.length === 0;

/**
 * The form after a save. All saved: empty, ready for the next animal. Some
 * refused: only those stay, with their typed figures, to correct and resend.
 */
export function formAfterSave<A extends Pick>(state: FormState<A>, o: WeightOutcome): FormState<A> {
  if (allSaved(o)) return { selected: [], entries: {}, groupFigure: "" };
  const bad = new Set(o.failed.map((f) => f.animal));
  return {
    selected: state.selected.filter((a) => bad.has(a.id)),
    entries: Object.fromEntries(Object.entries(state.entries).filter(([id]) => bad.has(id))),
    groupFigure: "",
  };
}

/** The kilos each recorded animal now carries, for the local row. */
export function savedWeights<A extends Pick>(
  mode: WeighingMode,
  state: FormState<A>,
  o: WeightOutcome,
): { id: string; kg: number }[] {
  const figure = num(state.groupFigure);
  const head = state.selected.length || 1;
  return o.recorded
    .map((r) => {
      const w =
        mode === "each" ? num((state.entries[r.animal] ?? EMPTY_ENTRY).weight)
        : mode === "platform" ? figure / head
        : figure;
      return { id: r.animal, kg: Math.round(w * 10) / 10 };
    })
    .filter((w) => w.kg > 0);
}

/** "Weight saved — 312 kg for LE151", or "3 weights saved — LE151, LE152, LE153". */
export function savedMessage<A extends Pick>(saved: { id: string; kg: number }[], selected: A[]): string {
  const label = (id: string) => selected.find((a) => a.id === id)?.name || id;
  if (saved.length === 0) return "Weights saved";
  if (saved.length === 1) return `Weight saved — ${kg(saved[0].kg)} kg for ${label(saved[0].id)}`;
  const names = saved.slice(0, 3).map((w) => label(w.id)).join(", ");
  return `${saved.length} weights saved — ${names}${saved.length > 3 ? "…" : ""}`;
}
