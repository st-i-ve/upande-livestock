import { useQuery } from "@tanstack/react-query";

import { getItemsByEvent } from "@/src/frappe/eventItems";

/**
 * The in-stock items an event type may use, with the store and quantity for
 * each. `undefined` while loading or if the call failed; an absent key means
 * the event type is not set to post stock (Livestock Event Type).
 */
export const useEventItems = (eventType: string) => {
  const q = useQuery({
    queryKey: ["items-by-event"],
    queryFn: getItemsByEvent,
    staleTime: 60_000,
  });
  return { ...q, choices: q.data?.[eventType] };
};
