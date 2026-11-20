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
};

/** How a batch reads in the picker: "2026-11-19 · Morning · 350.5 kg · Herd A, Herd B (tested)". */
export const batchLabel = (b: MilkBatch): string =>
  `${b.date} · ${b.shift} · ${Math.round(b.total_kg * 10) / 10} kg · ${b.herds.join(", ")}${b.tested ? " (tested)" : ""}`;
