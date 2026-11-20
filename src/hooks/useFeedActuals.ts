import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAnimalIntake, getDailyFeedReport, getFeedDayProgram } from "@/src/frappe/feedActuals";
import { save } from "@/src/hooks/mutations";
import { invalidateStock } from "@/src/hooks/useServerLists";

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

// The day sheet's writes are saved to the phone's queue first (see mutations.ts) and
// sent when there is signal, in order for the herd: amend, then mix.
export const useAmendFeedDay = () => {
  const done = useInvalidateFeed();
  return useMutation({
    mutationFn: (v: { herd: string; date: string; kgByItem: Record<string, number>; remarks?: string }) =>
      save("FeedDay", { action: "amend", ...v }, `Feed amended · ${v.herd}`, [`herd:${v.herd}`]),
    onSuccess: done,
  });
};

export const useResetFeedDay = () => {
  const done = useInvalidateFeed();
  return useMutation({
    mutationFn: (v: { herd: string; date: string }) =>
      save("FeedDay", { action: "reset", ...v }, `Feed reset · ${v.herd}`, [`herd:${v.herd}`]),
    onSuccess: done,
  });
};

export const useManufactureActuals = () => {
  const done = useInvalidateFeed();
  return useMutation({
    mutationFn: (v: { herd: string; date: string; employee?: string | null }) =>
      save("FeedDay", { action: "mix", ...v }, `Feed mixed · ${v.herd}`, [`herd:${v.herd}`]),
    onSuccess: done,
  });
};
