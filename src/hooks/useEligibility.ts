import { useQuery } from "@tanstack/react-query";

import { getClient } from "@/src/services/api";

/**
 * Who may be offered for what, straight from the backend.
 *
 * The app used to decide this locally — milking filtered on a `custom_is_milking`
 * flag someone had ticked on each herd. That is right until a herd is renamed or
 * a new one is added, at which point the app quietly offers the wrong animals
 * and nobody notices until a milking is recorded against a dry cow.
 *
 * The backend derives all of it from Herd Movement settings, so there is one
 * answer rather than two that can disagree. One call rather than four, because a
 * farm network is not a place to spend round trips.
 */
export type Eligibility = {
  milking_herds: string[];
  service_herds: string[];
  service_wait_days: number;
  growth_ladder: {
    idx: number;
    herd: string;
    days_in_herd: number;
    max_days_in_herd: number;
    exits_on_service: boolean;
  }[];
  /** Where each rung leads. Null on the rung an animal leaves by being served. */
  next_herd: Record<string, string | null>;
  calf_herds: { female: string | null; male: string | null };
  /** Animals with a service still awaiting its pregnancy check. */
  diagnosable: string[];
};

const EMPTY: Eligibility = {
  milking_herds: [],
  service_herds: [],
  service_wait_days: 0,
  growth_ladder: [],
  next_herd: {},
  calf_herds: { female: null, male: null },
  diagnosable: [],
};

export const useEligibility = () =>
  useQuery({
    queryKey: ["eligibility"],
    queryFn: async (): Promise<Eligibility> => {
      const client = await getClient();
      const res = await client.post(
        "/api/method/upande_livestock.serverscripts.movement.eligibility.eligibility",
        {},
      );
      const msg = res.data?.message;
      if (!msg || msg.error) throw new Error(msg?.error || "Could not read eligibility.");
      return { ...EMPTY, ...msg };
    },
    // Settings change rarely; the herd an animal is in changes daily. Ten
    // minutes keeps the forms honest without a request per screen open.
    staleTime: 10 * 60_000,
  });
