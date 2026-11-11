import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getFeedUnits, type UnitsMap } from "@/src/feed/units";

const EMPTY: UnitsMap = {};

/** The units each of these feeds may be written in (`feed_units`), asked
 *  again only when the set of feeds changes, not on every quantity typed. */
export function useFeedUnits(codes: string[]): UnitsMap {
  const key = useMemo(() => [...new Set(codes.filter(Boolean))].sort(), [codes]);
  const q = useQuery({
    queryKey: ["feedUnits", key.join("|")],
    queryFn: () => getFeedUnits(key),
    enabled: key.length > 0,
    staleTime: 10 * 60_000,
  });
  return q.data ?? EMPTY;
}
