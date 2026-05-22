import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  getMilkRecordingsForDate,
  mapTodaysMilkByHerd,
  todayISO,
} from "@/src/frappe/milkRecording";
import { useHerds } from "./useHerds";

/** Today's milk recordings, grouped by herd into rows for the home screen. */
export const useTodaysMilk = () => {
  const herdsQ = useHerds();
  const milkQ = useQuery({
    queryKey: ["milk", "today", todayISO()],
    queryFn: () => getMilkRecordingsForDate(todayISO()),
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    if (!milkQ.data || !herdsQ.data) return [];
    return mapTodaysMilkByHerd(milkQ.data, herdsQ.data);
  }, [milkQ.data, herdsQ.data]);

  return {
    data: rows,
    isLoading: milkQ.isLoading || herdsQ.isLoading,
    error: milkQ.error || herdsQ.error,
    refetch: async () => {
      await Promise.all([milkQ.refetch(), herdsQ.refetch()]);
    },
  };
};
