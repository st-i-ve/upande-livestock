import { useMemo } from "react";

import { buildSafetyAlerts } from "@/src/frappe/alerts";
import { useAnimals } from "./useAnimals";
import { useTodaysMilk } from "./useTodaysMilk";

export const useSafetyAlerts = () => {
  const a = useAnimals();
  const m = useTodaysMilk();

  const data = useMemo(
    () => buildSafetyAlerts(a.data ?? [], m.data ?? []),
    [a.data, m.data],
  );

  return {
    data,
    isLoading: a.isLoading || m.isLoading,
    error: a.error || m.error,
    refetch: async () => {
      await Promise.all([a.refetch(), m.refetch()]);
    },
  };
};
