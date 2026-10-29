import { NO_KINSHIP, parseKinship, type KinshipCheck } from "@/src/beef/kinship";
import { getClient } from "@/src/services/api";

const KINSHIP =
  "/api/method/upande_livestock.serverscripts.movement.kinship_check.kinship_check";

/**
 * Would putting `animal` into `herd` bring a sire, dam, son, daughter or sibling
 * together? Advice only: a failed preview resolves to "nothing to say" so a flaky
 * check never blocks a move (the server warns again when the move is saved).
 */
export async function kinshipCheck(animal: string, herd: string): Promise<KinshipCheck> {
  if (!animal || !herd) return NO_KINSHIP;
  try {
    const client = await getClient();
    const res = await client.post(KINSHIP, { payload: { animal, herd } });
    const m = res.data?.message;
    return m && !m.error ? parseKinship(m) : NO_KINSHIP;
  } catch {
    return NO_KINSHIP;
  }
}
