import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  amendFeedDay,
  getAnimalIntake,
  getDailyFeedReport,
  getFeedDayProgram,
  manufactureFeedActuals,
  resetFeedDay,
} from "@/src/frappe/feedActuals";
import { invalidateStock } from "@/src/hooks/useServerLists";
import { isOfflineError } from "@/src/services/network";

const NOT_RECORDED =
  "Could not reach the server. Nothing was recorded. Check your connection and try again.";

/** Sent now or not at all, like every feeding write: a dead network is
 *  reported, never queued. */
const sendNow = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    if (isOfflineError(err)) throw new Error(NOT_RECORDED);
    throw err;
  }
};

export const useFeedDayProgram = (date: string, herd?: string) =>
  useQuery({
    queryKey: ["feedDay", date, herd ?? ""],
    queryFn: () => getFeedDayProgram(date, herd),
    staleTime: 5_000,
  });

export const useAnimalIntake = (herd: string | undefined, date: string, enabled = true) =>
  useQuery({
    queryKey: ["feedIntake", herd, date],
    queryFn: () => getAnimalIntake(herd as string, date),
    enabled: !!herd && enabled,
    staleTime: 5_000,
  });

export const useDailyFeedReport = (date: string, herd?: string) =>
  useQuery({
    queryKey: ["feedReport", date, herd ?? ""],
    queryFn: () => getDailyFeedReport(date, herd),
    staleTime: 10_000,
  });

const useInvalidateFeed = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["feedDay"] });
    qc.invalidateQueries({ queryKey: ["feedIntake"] });
    qc.invalidateQueries({ queryKey: ["feedReport"] });
    qc.invalidateQueries({ queryKey: ["feedDayStatus"] });
    qc.invalidateQueries({ queryKey: ["herdFeedInfo"] });
    invalidateStock(qc);
  };
};

export const useAmendFeedDay = () => {
  const done = useInvalidateFeed();
  return useMutation({
    mutationFn: (v: { herd: string; date: string; kgByItem: Record<string, number>; remarks?: string }) =>
      sendNow(() => amendFeedDay(v.herd, v.date, v.kgByItem, v.remarks)),
    onSuccess: done,
  });
};

export const useResetFeedDay = () => {
  const done = useInvalidateFeed();
  return useMutation({
    mutationFn: (v: { herd: string; date: string }) => sendNow(() => resetFeedDay(v.herd, v.date)),
    onSuccess: done,
  });
};

export const useManufactureActuals = () => {
  const done = useInvalidateFeed();
  return useMutation({
    mutationFn: (v: { herd: string; date: string; employee?: string | null }) =>
      sendNow(() => manufactureFeedActuals(v.herd, v.date, v.employee)),
    onSuccess: done,
  });
};
