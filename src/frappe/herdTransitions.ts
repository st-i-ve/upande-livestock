import { createAnimalEvent } from "@/src/frappe/animalEvent";
import { getClient, todayISO } from "@/src/services/api";

export type HerdMove = {
  /** Animal name (the Frappe docname), which is what the event needs. */
  animal: string;
  /** Label for the operator — tag and burn name. */
  label: string;
  fromHerd: string;
  toHerd: string;
  reason: string;
  overdue: boolean;
};

/**
 * Animals the herd structure says are due to move, as the server works it out.
 *
 * This used to be an age ladder held here in the client: three settings fields
 * naming a weaning, weaner and bulling-heifer herd, with 2 / 4 / 12-month
 * thresholds hard-coded. None of those fields exist on this backend, so the
 * function returned nothing at all — and the rules had drifted from the real
 * ones anyway. The ladder is now a configured, ordered table (Livestock
 * Settings → growth_ladder) with its own days per rung, and `movement_suggestions`
 * reads it. One ladder, defined once, in the place the farm can change it.
 */
export async function computePendingHerdMoves(): Promise<HerdMove[]> {
  const client = await getClient();
  const res = await client.post(
    "/api/method/upande_livestock.api.operations.movement_suggestions",
    {},
  );
  const msg = res.data?.message;
  if (!msg || msg.error) throw new Error(msg?.error || "Could not read movement suggestions.");

  return (msg.growth ?? []).map((r: any) => ({
    animal: r.animal,
    label: r.label || r.animal,
    fromHerd: r.from_herd || "",
    toHerd: r.to_herd,
    reason: r.reason || "",
    overdue: !!r.overdue,
  }));
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
        animal: m.animal,
        currentHerd: m.fromHerd,
        operator,
        eventDate: todayISO(),
        toHerd: m.toHerd,
        remarks: `Ladder: ${m.reason}`,
      });
      out.push({ animal: m.label, ok: true });
    } catch (e: any) {
      out.push({ animal: m.label, ok: false, error: e?.message || "failed" });
    }
  }
  return out;
}
