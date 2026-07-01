import { useQuery } from "@tanstack/react-query";

import { getHerdFeedInfo } from "@/src/frappe/feeding";

/** Manufacture preview + live store availability for a herd's TMR. */
export const useHerdFeedInfo = (herd: string | null | undefined) =>
  useQuery({
    queryKey: ["herdFeedInfo", herd],
    queryFn: () => getHerdFeedInfo(herd as string),
    enabled: !!herd,
    staleTime: 15_000,
  });
