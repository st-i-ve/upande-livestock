import { useQuery } from "@tanstack/react-query";

import { getClient } from "@/src/services/api";

/**
 * Who may be offered for what, straight from the backend.
 *
 * The app used to decide this locally. That is right until a herd is renamed or
 * a new one is added, at which point the app quietly offers the wrong animals.
 *
 * The backend derives all of it from Herd Movement settings, so there is one
 * answer rather than two that can disagree. One call rather than four, because a
 * farm network is not a place to spend round trips.
 */
export type Eligibility = {
  /** Every Breeding-class herd (mating groups); they are service herds. */
  breeding_herds: string[];
  heifer_herds: string[];
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
  /** Calves at or past the separation age, with where each may go. */
  separation_due: SeparationDue[];
};

export type SeparationOption = {
  stream: "Heifer" | "Feedlot" | "Breeding" | string;
  /** Suggested destination herd; null when the herdsman must choose. */
  herd: string | null;
  /** Breeding stream: the herds he may choose from. */
  herds?: string[];
};

export type SeparationDue = {
  animal: string;
  label: string;
  sex: string;
  herd: string;
  age_days: number;
  over_days: number;
  weight_kg: number | null;
  options: SeparationOption[];
};

const EMPTY: Eligibility = {
  breeding_herds: [],
  separation_due: [],
  heifer_herds: [],
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
