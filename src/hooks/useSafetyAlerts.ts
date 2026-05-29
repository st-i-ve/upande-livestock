import { useMemo } from "react";

import { buildSafetyAlerts } from "@/src/frappe/alerts";
import { useAnimals } from "./useAnimals";
import { useBreedingAlerts } from "./useBreedingAlerts";
import { useTodaysMilk } from "./useTodaysMilk";

export const useSafetyAlerts = () => {
  const a = useAnimals();
  const m = useTodaysMilk();
  const b = useBreedingAlerts();

  const data = useMemo(
    () => [...buildSafetyAlerts(a.data ?? [], m.data ?? []), ...b.data],
    [a.data, m.data, b.data],
  );

  return {
    data,
    isLoading: a.isLoading || m.isLoading || b.isLoading,
    error: a.error || m.error || b.error,
    refetch: async () => {
      await Promise.all([a.refetch(), m.refetch(), b.refetch()]);
    },
  };
};
