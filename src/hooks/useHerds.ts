import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DEFAULT_BEEF_SETTINGS, getBootstrap, type BeefSettings } from "@/src/frappe/herd";
import { storage } from "@/src/services/storage";
import type { Herd } from "@/types";

/** One bootstrap call feeds the herd list and the beef settings. */
const useBootstrap = () =>
  useQuery({
    queryKey: ["herds"],
    queryFn: getBootstrap,
    staleTime: 5 * 60_000,
  });

export const useHerds = () => {
  const q = useBootstrap();
  return { ...q, data: q.data?.herds };
};

/** calf_separation_age_days, default_service_type, ... with Mutara's defaults until the server answers. */
export const useBeefSettings = (): BeefSettings => useBootstrap().data?.settings ?? DEFAULT_BEEF_SETTINGS;

const HERD_FACTS_KEY = "herd_facts";

export type HerdFacts = { breeding: string[]; calf: string[]; heifer: string[]; inCalf: string[] };

const EMPTY_FACTS: HerdFacts = { breeding: [], calf: [], heifer: [], inCalf: [] };

/**
 * Which herds are Breeding-class (the mating groups) and which are calf, heifer
 * and in-calf herds, from the herd list the app already fetches. The last answer
 * is kept on the phone so the Animals filters work offline.
 */
export function useHerdFacts(): HerdFacts {
  const { data } = useHerds();
  const [kept, setKept] = useState<HerdFacts>(EMPTY_FACTS);
  useEffect(() => {
    storage.getItem(HERD_FACTS_KEY).then((raw) => {
      try { if (raw) setKept({ ...EMPTY_FACTS, ...JSON.parse(raw) }); } catch {}
    });
  }, []);
  useEffect(() => {
    if (!data) return;
    storage.setItem(HERD_FACTS_KEY, JSON.stringify(factsFrom(data)));
  }, [data]);
  return data ? factsFrom(data) : kept;
}

export const factsFrom = (herds: Herd[]): HerdFacts => ({
  breeding: herds.filter((h) => h.isBreeding).map((h) => h.n),
  // Calf herds from Livestock Settings; the herd's own calf-rearing flag only
  // when the farm has not filled that table in.
  calf: (herds.some((h) => h.isCalf) ? herds.filter((h) => h.isCalf) : herds.filter((h) => h.isCalfRearing)).map((h) => h.n),
  heifer: herds.filter((h) => h.isHeifer).map((h) => h.n),
  inCalf: herds.filter((h) => h.isInCalf).map((h) => h.n),
});
