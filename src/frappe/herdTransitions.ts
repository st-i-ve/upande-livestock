import { createAnimalEvent } from "@/src/frappe/animalEvent";
import type { LivestockSettingsDoc } from "@/src/frappe/livestockSettings";
import { todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

export type HerdMove = {
  animal: Animal;
  toHerd: string;
  reason: string;
};

/**
 * Age-bucket transition rules (per the calving-to-service lifecycle):
 *   0-2 months  → kept in birth herd (heifer or bull, set on calving)
 *   2-4 months  → custom_weaning_herd at age 2 months
 *   4-12 months → custom_weaner_herd at age 4 months
 *   12+ months  → custom_bulling_heifer_herd at age 12 months (females only)
 *
 * Bulls follow the same age thresholds but stay in the bull herd unless
 * the operator manually re-shuffles them.
 *
 * Repro-status transitions are handled by Frappe server scripts on
 * Service / PD events; this helper only handles age-driven moves.
 */
export function computePendingHerdMoves(
  animals: Animal[],
  settings: LivestockSettingsDoc | undefined,
  today: string = todayISO(),
): HerdMove[] {
  if (!settings) return [];
  const moves: HerdMove[] = [];

  for (const a of animals) {
    if (!a.dob) continue;
    const ageMonths = monthsBetween(a.dob, today);
    if (ageMonths == null) continue;

    const target = pickTargetHerd(a, ageMonths, settings);
    if (target && target !== a.herd) {
      moves.push({
        animal: a,
        toHerd: target,
        reason: reasonFor(ageMonths, a.sex),
      });
    }
  }
  return moves;
}

function pickTargetHerd(
  a: Animal,
  ageMonths: number,
  s: LivestockSettingsDoc,
): string | null {
  // Bulls stay in bull herd unless explicitly moved. The age buckets above
  // are heifer-centric, so this helper is conservative on males.
  if (a.sex === "M") return null;

  if (ageMonths >= 12) return s.custom_bulling_heifer_herd || null;
  if (ageMonths >= 4) return s.custom_weaner_herd || null;
  if (ageMonths >= 2) return s.custom_weaning_herd || null;
  return null;
}

function reasonFor(ageMonths: number, sex: "F" | "M"): string {
  if (sex === "M") return `Age ${ageMonths.toFixed(1)} months`;
  if (ageMonths >= 12) return `12+ months → bulling heifer`;
  if (ageMonths >= 4) return `4-12 months → weaner`;
  if (ageMonths >= 2) return `2-4 months → weaning`;
  return `Age ${ageMonths.toFixed(1)} months`;
}

function monthsBetween(fromISO: string, toISO: string): number | null {
  if (!fromISO) return null;
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  const ms = b - a;
  return ms / (1000 * 60 * 60 * 24 * 30.4375);
}

/**
 * Submits one Movement event per planned move. Returns a per-animal result
 * list so the caller can surface partial failures.
 */
export async function applyHerdMoves(
  moves: HerdMove[],
  operator: string,
): Promise<{ animal: string; ok: boolean; error?: string }[]> {
  const out: { animal: string; ok: boolean; error?: string }[] = [];
  for (const m of moves) {
    try {
      await createAnimalEvent({
        eventType: "Movement",
        animal: m.animal.id,
        currentHerd: m.animal.herd,
        operator,
        eventDate: todayISO(),
        toHerd: m.toHerd,
        remarks: `Auto: ${m.reason}`,
      });
      out.push({ animal: m.animal.id, ok: true });
    } catch (e: any) {
      out.push({ animal: m.animal.id, ok: false, error: e?.message ?? String(e) });
    }
  }
  return out;
}
