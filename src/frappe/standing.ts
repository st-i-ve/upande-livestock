import { useAuthStore } from "@/src/auth/authStore";
import { getClient } from "@/src/services/api";
import { storage } from "@/src/services/storage";

const STANDING =
  "/api/method/upande_livestock.serverscripts.animals.animal_standing.animal_standing";

export type Peers = { avg: number | null; n: number; top: number | null };

export type StandingMetric = {
  key: string;
  label: string;
  unit: string;
  better: "higher" | "lower" | null;
  value: number | null;
  herd: Peers;
  group: Peers;
};

export type Standing = {
  asOf: string;
  animal: string;
  herd: { name: string; n: number };
  group: { key: string; label: string; n: number };
  metrics: StandingMetric[];
};

/** The last answer is kept per site and animal, so a cow looked at once can be
 *  looked at again without signal, with its date shown. */
const cacheKey = (id: string) =>
  `standing:${useAuthStore.getState().instanceUrl}:${id}`;

export type StandingResult = Standing & { cached: boolean };

export async function getStanding(id: string): Promise<StandingResult> {
  try {
    const client = await getClient();
    const res = await client.post(STANDING, { payload: { animal: id } });
    const m = res.data?.message;
    if (!m || m.error) throw new Error(m?.error ?? "No answer");
    await storage.setItem(cacheKey(id), JSON.stringify(m)).catch(() => {});
    return { ...(m as Standing), cached: false };
  } catch (err) {
    const raw = await storage.getItem(cacheKey(id)).catch(() => null);
    if (raw) {
      try {
        return { ...(JSON.parse(raw) as Standing), cached: true };
      } catch {
        /* fall through to the error */
      }
    }
    throw err;
  }
}
