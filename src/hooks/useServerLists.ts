import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

/**
 * The lists a record screen reads from the server: event-type stock rules and
 * quantities (health-options), vets, the posting day / backdating window,
 * Livestock Settings and the livestock stock list. Never polled: they refetch
 * when a screen gains focus (if older than their 30 s staleness), when the app
 * returns to the foreground (see queryClient), on pull-to-refresh, and after
 * any successful save (see mutations).
 */
export const SERVER_LISTS = [
  "health-options",
  "vets",
  "posting-day",
  "livestock-settings",
  "livestock-stock",
  "batch-plan",
] as const;

const isServerList = (key: readonly unknown[]) => SERVER_LISTS.includes(key[0] as any);

/** Refetch the stale server lists whenever this screen gains focus. */
export function useRefreshOnFocus() {
  const qc = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      void qc.refetchQueries({ predicate: (q) => isServerList(q.queryKey), stale: true, type: "active" });
    }, [qc]),
  );
}

/** Pull-to-refresh for a record screen: refetch every mounted server list now. */
export function usePullToRefresh() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await qc.refetchQueries({ predicate: (q) => isServerList(q.queryKey), type: "active" });
    } finally {
      setRefreshing(false);
    }
  }, [qc]);
  return { refreshing, onRefresh };
}

/** Mark the stock lists stale and refetch the mounted ones: after any save. */
export const invalidateStock = (qc: ReturnType<typeof useQueryClient>) => {
  for (const key of ["health-options", "livestock-stock", "batch-plan"]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
};
