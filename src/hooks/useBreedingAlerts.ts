import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { buildBreedingAlerts, fetchCycleEvents } from "@/src/frappe/breedingAlerts";

import { useAnimals } from "./useAnimals";

export function useBreedingAlerts() {
  const { data: animals = [] } = useAnimals();
  const events = useQuery({
    queryKey: ["breeding", "cycle-events"],
    queryFn: fetchCycleEvents,
    staleTime: 5 * 60 * 1000,
  });

  const data = useMemo(() => {
    const nameById = new Map<string, string>();
    for (const a of animals) nameById.set(a.id, a.name);
    return buildBreedingAlerts(events.data ?? [], nameById);
  }, [events.data, animals]);

  return {
    data,
    isLoading: events.isLoading,
    error: events.error,
    refetch: events.refetch,
  };
}
