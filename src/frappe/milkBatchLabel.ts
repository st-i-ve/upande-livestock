/** Milked batches as the phone shows them (pure, so it is tested without a phone). */
export type MilkBatch = {
  key: string;
  date: string;
  shift: string;
  total_kg: number;
  herds: string[];
  /** The recording the test links to (the batch's largest). */
  milk_recording: string;
  /** A quality test already exists against this batch. */
  tested: boolean;
  /** A recording of the batch still awaits a lab result. */
  pending?: boolean;
  /** Every Milk Recording of the batch (herds milked then), so the result is written to each. */
  recordings?: { name: string; herd?: string; net_yield_kg?: number }[];
};

/** How a batch reads in the picker: "2026-11-19 · Morning · 350.5 kg · Herd A, Herd B (tested)". */
export const batchLabel = (b: MilkBatch): string =>
  `${b.date} · ${b.shift} · ${Math.round(b.total_kg * 10) / 10} kg · ${b.herds.join(", ")}${b.pending ? " (awaiting result)" : b.tested ? " (tested)" : ""}`;

/** Batches awaiting a result first; otherwise the order given (newest first). */
export const pendingFirst = (batches: MilkBatch[]): MilkBatch[] =>
  [...batches].sort((a, b) => Number(!!b.pending) - Number(!!a.pending));

/** What the server needs to write a result onto the batch: date, shift, link, every recording. */
export const batchFields = (b: MilkBatch): Record<string, string | string[]> => ({
  sample_date: b.date,
  shift: b.shift,
  milk_recording: b.milk_recording,
  recordings: (b.recordings ?? []).map((r) => r.name),
});
