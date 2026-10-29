import type { SeparationDue, SeparationOption } from "@/src/hooks/useEligibility";

export const optionOf = (d: SeparationDue, stream: string): SeparationOption | undefined =>
  d.options.find((o) => o.stream === stream);

/** Wording for the row's second line: "230 days old, 20 over · 168 kg". */
export function dueLine(d: SeparationDue): string {
  const over = d.over_days > 0 ? `, ${d.over_days} over` : "";
  const wt = d.weight_kg != null ? ` · ${d.weight_kg} kg` : "";
  return `${d.age_days} days old${over} · ${d.herd}${wt}`;
}

/** Remarks stored on a calf-separation move that is not a breeding selection. */
export const separationRemarks = (stream: string, herd: string) => `Calf separation: weaned to ${stream.toLowerCase()} (${herd})`;
