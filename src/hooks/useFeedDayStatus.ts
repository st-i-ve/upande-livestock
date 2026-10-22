import { useQuery } from "@tanstack/react-query";

import { getFeedDayStatus } from "@/src/frappe/feeding";

/** How much of today's ration a herd has had, and what is still owed.
 *
 *  The farm feeds twice a day, so a screen showing only "this herd needs 5,106
 *  kg" cannot tell an operator whether the morning already happened. Short
 *  stale time on purpose: two people at the same parlour should not each think
 *  they owe the whole day. */
export const useFeedDayStatus = (herd: string | null | undefined) =>
  useQuery({
    queryKey: ["feedDayStatus", herd],
    queryFn: () => getFeedDayStatus(herd as string),
    enabled: !!herd,
    staleTime: 5_000,
  });
