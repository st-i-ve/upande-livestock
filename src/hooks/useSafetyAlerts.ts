import { useMemo } from "react";

import { buildSafetyAlerts } from "@/src/frappe/alerts";
import { useAnimals } from "./useAnimals";
import { useBreedingAlerts } from "./useBreedingAlerts";
import { useMovementAlerts } from "./useMovementAlerts";
import { useTodaysMilk } from "./useTodaysMilk";

export const useSafetyAlerts = () => {
  const a = useAnimals();
  const m = useTodaysMilk();
  const b = useBreedingAlerts();
  // Animals that should have moved and have not. Folded in here so the action
  // queue is one list — a separate screen for it would be a second place to
  // remember to look.
  const mv = useMovementAlerts();

  const data = useMemo(
    () => [...buildSafetyAlerts(a.data ?? [], m.data ?? []), ...b.data, ...(mv.data ?? [])],
    [a.data, m.data, b.data, mv.data],
  );

  return {
    data,
    isLoading: a.isLoading || m.isLoading || b.isLoading || mv.isLoading,
    // Movement alerts must not blank the queue. They come from one endpoint that
    // an older backend will not have, and a 404 there should not hide the
    // withdrawal and treatment warnings that matter more.
    error: a.error || m.error || b.error,
    refetch: async () => {
      await Promise.all([a.refetch(), m.refetch(), b.refetch(), mv.refetch()]);
    },
  };
};
