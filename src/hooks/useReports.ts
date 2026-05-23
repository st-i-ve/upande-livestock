import { useQuery } from "@tanstack/react-query";

import { getRecentEvents } from "@/src/frappe/animalEvent";
import { getHealthCases } from "@/src/frappe/animalHealthCase";
import { getMilkRecordingsBetween } from "@/src/frappe/milkRecording";
import { isoDaysAgo, todayISO } from "@/src/services/api";

/**
 * 30-day Milk Recordings — for the milk-yield report.
 */
export const useMilkLast30d = () =>
  useQuery({
    queryKey: ["report", "milk-30d"],
    queryFn: () => getMilkRecordingsBetween(isoDaysAgo(30), todayISO()),
    staleTime: 5 * 60_000,
  });

/**
 * 12-month Animal Events scoped by type — repro report uses Service / PD /
 * Calving counts; health report sums activity_cost on submit events.
 */
export const useEventsLast365d = () =>
  useQuery({
    queryKey: ["report", "events-365d"],
    queryFn: () => getRecentEvents({ since: isoDaysAgo(365), limit: 1000 }),
    staleTime: 5 * 60_000,
  });

/**
 * All Health Cases — needed for cost-by-condition rollups.
 */
export const useAllHealthCases = () =>
  useQuery({
    queryKey: ["report", "health-cases"],
    queryFn: () => getHealthCases(),
    staleTime: 5 * 60_000,
  });
