import type { DayComponent, HerdDay } from "@/src/frappe/feedActuals";

/** Pure helpers for the feeding day sheet, tested without a phone. */

/** A typed kg box -> a number, or null when it is not a usable non-negative amount. */
export const parseKg = (raw: string): number | null => {
  const t = raw.trim().replace(",", ".");
  if (t === "" || !/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? v : null;
};

export const fmtKg = (v: number): string =>
  `${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;

export const signedKg = (v: number): string => {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? "+" : ""}${r.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;
};

export const signedPct = (v: number): string => {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? "+" : ""}${r}%`;
};

/** What the server will be sent: only the boxes the operator changed, and the
 *  ones left unparsable. Left-out components keep their value on the server. */
export const changedKg = (
  components: readonly DayComponent[],
  typed: Record<string, string>,
): { changes: Record<string, number>; invalid: string[] } => {
  const changes: Record<string, number> = {};
  const invalid: string[] = [];
  for (const c of components) {
    const raw = typed[c.itemCode];
    if (raw === undefined) continue;
    const v = parseKg(raw);
    if (v === null) {
      invalid.push(c.itemName);
      continue;
    }
    if (Math.abs(v - c.actualKg) > 1e-9) changes[c.itemCode] = v;
  }
  return { changes, invalid };
};

/** Mixing needs the day not already mixed; amending needs the same. */
export const dayIsOpen = (d: Pick<HerdDay, "status">): boolean => d.status === "Planned" || d.status === "Amended";

export const statusTone = (status: string): "default" | "warning" | "success" =>
  status === "Waiting for stock" ? "warning" : status === "Manufactured" ? "success" : "default";

export const appetiteLabel = (a: "below" | "above" | "on_plan"): string =>
  a === "below" ? "Below plan" : a === "above" ? "Above plan" : "On plan";
