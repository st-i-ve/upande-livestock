import { useQuery } from "@tanstack/react-query";

import { getRecentEvents } from "@/src/frappe/animalEvent";

/**
 * Livestock Events for one animal, newest first — powers the timeline on
 * Animal Detail. Scoped server-side via the `animal` filter rather than
 * fetched for the whole herd and filtered on the handset.
 */
export const useAnimalEvents = (animal: string | undefined) =>
  useQuery({
    queryKey: ["animal-events", animal],
    queryFn: () => getRecentEvents({ animal, limit: 20 }),
    enabled: !!animal,
    staleTime: 30_000,
  });
