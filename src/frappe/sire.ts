import { NO_SIRE, parseSire, type SireResult } from "@/src/beef/sire";
import { getClient } from "@/src/services/api";

const SIRE_CANDIDATES =
  "/api/method/upande_livestock.serverscripts.breeding.sire_candidates.sire_candidates";

/**
 * Who was the mature bull in this female's herd around the conception date?
 * Advice only; the server infers again when the service or diagnosis is saved,
 * and a sire the herdsman picks always wins.
 */
export async function sireCandidates(animal: string, conceptionDate: string): Promise<SireResult> {
  if (!animal || !conceptionDate) return NO_SIRE;
  try {
    const client = await getClient();
    const res = await client.post(SIRE_CANDIDATES, { animal, conception_date: conceptionDate });
    const m = res.data?.message;
    return m && !m.error ? parseSire(m) : NO_SIRE;
  } catch {
    return NO_SIRE;
  }
}
