import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  AnimalEventInput,
  createAnimalEvent,
} from "@/src/frappe/animalEvent";
import {
  CreateAnimalDiagnosisInput,
  createAnimalDiagnosis,
} from "@/src/frappe/animalDiagnosis";
import {
  CreateCalfFeedingInput,
  createCalfFeeding,
} from "@/src/frappe/calfFeeding";
import {
  CreateMilkRecordingInput,
  createMilkRecording,
} from "@/src/frappe/milkRecording";
import { manufactureHerdFeed } from "@/src/frappe/feeding";
import { isOfflineError } from "@/src/offline/dispatcher";
import {
  PendingMutationType,
  enqueue,
  newId,
} from "@/src/offline/queue";

// Invalidate everything that could have changed: animals (herd / dates / repro
// status / weight history / count), herds (head counts), and today's milk
// (recorded yield). Conservative but cheap — React Query will refetch only
// the queries that are mounted.
const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["animals"] });
  qc.invalidateQueries({ queryKey: ["animal"] });
  qc.invalidateQueries({ queryKey: ["herds"] });
  qc.invalidateQueries({ queryKey: ["herd"] });
  qc.invalidateQueries({ queryKey: ["milk"] });
  qc.invalidateQueries({ queryKey: ["health-cases"] });
  qc.invalidateQueries({ queryKey: ["diagnoses"] });
  qc.invalidateQueries({ queryKey: ["disposals"] });
};

/**
 * Result of an offline-aware mutation. On a clean direct submit, `queued`
 * is false and `data` is the Frappe response. If the network was down or
 * unreachable, `queued` is true and the submission is parked in the
 * persistent queue — callers should surface a "queued" message instead of
 * a hard error.
 */
export type OfflineMutationResult = {
  queued: boolean;
  data: any;
};

const tryDirectOrEnqueue = async <T extends object>(
  type: PendingMutationType,
  payload: T,
  fn: (input: T) => Promise<any>,
  label: string,
): Promise<OfflineMutationResult> => {
  try {
    const data = await fn(payload);
    return { queued: false, data };
  } catch (err) {
    if (isOfflineError(err)) {
      const queued = await enqueue({
        id: newId(),
        type,
        payload,
        label,
        createdAt: new Date().toISOString(),
      });
      return { queued: true, data: queued };
    }
    throw err;
  }
};

// ---------------------------------------------------------------------------

const labelEvent = (i: AnimalEventInput): string => `${i.eventType} · ${i.animal}`;
const labelMilk = (i: CreateMilkRecordingInput): string =>
  `Milk · ${i.herd}${i.milkingTime ? ` · ${i.milkingTime}` : ""}`;
const labelCalfFeed = (i: CreateCalfFeedingInput): string =>
  `Calf feeding · ${i.calf}`;
const labelDx = (i: CreateAnimalDiagnosisInput): string =>
  `Diagnosis · ${i.animal}`;

// ---------------------------------------------------------------------------

export const useCreateAnimalEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AnimalEventInput) =>
      tryDirectOrEnqueue("AnimalEvent", input, createAnimalEvent, labelEvent(input)),
    onSuccess: () => invalidateAll(qc),
  });
};

export const useCreateMilkRecording = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMilkRecordingInput) =>
      tryDirectOrEnqueue("MilkRecording", input, createMilkRecording, labelMilk(input)),
    onSuccess: () => invalidateAll(qc),
  });
};

export const useCreateCalfFeeding = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCalfFeedingInput) =>
      tryDirectOrEnqueue("CalfFeeding", input, createCalfFeeding, labelCalfFeed(input)),
    onSuccess: () => invalidateAll(qc),
  });
};

export const useCreateAnimalDiagnosis = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnimalDiagnosisInput) =>
      tryDirectOrEnqueue("AnimalDiagnosis", input, createAnimalDiagnosis, labelDx(input)),
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
      manufactureHerdFeed(v.herd, v.portion ?? 1, v.postingDate, v.bomNo),
    onSuccess: () => invalidateAll(qc),
  });
};

