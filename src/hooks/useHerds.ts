import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getHerds } from "@/src/frappe/herd";
import { storage } from "@/src/services/storage";
import type { Herd } from "@/types";

export const useHerds = () =>
  useQuery({
    queryKey: ["herds"],
    queryFn: getHerds,
    staleTime: 5 * 60_000,
  });

const HERD_FACTS_KEY = "herd_facts";

export type HerdFacts = { milking: string[]; calf: string[] };

/**
 * Which herds are milking (Livestock Settings) and which rear calves
 * (Herds.custom_is_calf_rearing), from the herd list the app already fetches.
 * The last answer is kept on the phone so the Animals filters work offline.
 */
export function useHerdFacts(): HerdFacts {
  const { data } = useHerds();
  const [kept, setKept] = useState<HerdFacts>({ milking: [], calf: [] });
  useEffect(() => {
    storage.getItem(HERD_FACTS_KEY).then((raw) => {
      try { if (raw) setKept(JSON.parse(raw)); } catch {}
    });
  }, []);
  useEffect(() => {
    if (!data) return;
    storage.setItem(HERD_FACTS_KEY, JSON.stringify(factsFrom(data)));
  }, [data]);
  return data ? factsFrom(data) : kept;
}

const factsFrom = (herds: Herd[]): HerdFacts => ({
  milking: herds.filter((h) => h.isMilking).map((h) => h.n),
  calf: herds.filter((h) => h.isCalfRearing).map((h) => h.n),
});
