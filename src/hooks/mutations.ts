import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  AnimalEventInput,
  createAnimalEvent,
} from "@/src/frappe/animalEvent";
import { CreateCheckUpInput, createCheckUp } from "@/src/frappe/checkUp";
import { TreatAnimalInput, treatAnimal } from "@/src/frappe/treatment";
import { manufactureHerdFeed } from "@/src/frappe/feeding";
import { invalidateStock } from "@/src/hooks/useServerLists";
import { isOfflineError } from "@/src/services/network";

// Invalidate everything that could have changed: animals (herd / dates / repro
// status / weight history / count) and herds (head counts). Conservative but cheap — React Query will refetch only
// the queries that are mounted.
const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["animals"] });
  qc.invalidateQueries({ queryKey: ["animal"] });
  qc.invalidateQueries({ queryKey: ["herds"] });
  qc.invalidateQueries({ queryKey: ["herd"] });
  // Who is due to leave their mother, who may be served or diagnosed: the server decides again.
  qc.invalidateQueries({ queryKey: ["eligibility"] });
  qc.invalidateQueries({ queryKey: ["health-cases"] });
  qc.invalidateQueries({ queryKey: ["diagnoses"] });
  qc.invalidateQueries({ queryKey: ["disposals"] });
  // A save may have moved stock: what the pickers and the Stock list show must
  // be read again, not trusted for another 30 s.
  invalidateStock(qc);
};

/** Sent now or not at all. A dead network is reported, never queued, and the
 *  form keeps what was typed. */
const sendNow = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    if (isOfflineError(err)) {
      throw new Error(
        "Could not reach the server. Nothing was recorded. Check your connection and try again.",
      );
    }
    throw err;
  }
};

// ---------------------------------------------------------------------------

export const useCreateAnimalEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AnimalEventInput) =>
      sendNow(() => createAnimalEvent(input)),
    onSuccess: () => invalidateAll(qc),
  });
};

export const useCreateCheckUp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCheckUpInput) =>
      sendNow(() => createCheckUp(input)),
    onSuccess: () => invalidateAll(qc),
  });
};

export const useTreatAnimal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TreatAnimalInput) =>
      sendNow(() => treatAnimal(input)),
    onSuccess: () => invalidateAll(qc),
  });
};

// Animal feeding is a two-stage, server-orchestrated flow (Work Order + stock
// entries, then Material Issue) that needs a live connection and current stock
// — so these run directly rather than through the offline queue.
export const useManufactureHerdFeed = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { herd: string; portion?: number; postingDate?: string; bomNo?: string }) =>
      sendNow(() => manufactureHerdFeed(v.herd, v.portion ?? 1, v.postingDate, v.bomNo)),
    onSuccess: () => invalidateAll(qc),
  });
};

