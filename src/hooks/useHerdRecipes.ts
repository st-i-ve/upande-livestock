import { useQuery } from "@tanstack/react-query";

import { getHerdRecipes } from "@/src/frappe/herdRecipes";

/** A herd's standing ration plus every recipe tuned for it before — what the
 *  feeding screen's recipe picker offers. Same 15s stale time as
 *  `useFeedDayStatus`: a tuned BOM made moments ago by another operator
 *  should show up here without a manual refresh. */
export const useHerdRecipes = (herd: string | null | undefined) =>
  useQuery({
    queryKey: ["herdRecipes", herd],
    queryFn: () => getHerdRecipes(herd as string),
    enabled: !!herd,
    staleTime: 15_000,
  });
