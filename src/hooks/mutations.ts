import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  AnimalEventInput,
  createAnimalEvent,
} from "@/src/frappe/animalEvent";
import { CreateCheckUpInput, createCheckUp } from "@/src/frappe/checkUp";
import { TreatAnimalInput, treatAnimal } from "@/src/frappe/treatment";
import {
  CreateMilkRecordingInput,
  createMilkRecording,
} from "@/src/frappe/milkRecording";
import { manufactureHerdFeed } from "@/src/frappe/feeding";
import { invalidateStock } from "@/src/hooks/useServerLists";
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
  // A save may have moved stock: what the pickers and the Stock list show must
  // be read again, not trusted for another 30 s.
  invalidateStock(qc);
};

/**
 * Result of the one offline-aware mutation (milking). `queued` is true when the
 * network was down and the milking was parked in the persistent queue.
 */
export type OfflineMutationResult = {
  queued: boolean;
  data: any;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Mark a milking as taken without signal, with the phone's time. */
const stampOffline = <T extends object>(payload: T): T => {
  const d = new Date();
  const capturedAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return { ...payload, offline: true, capturedAt };
};

/**
 * MILKING ONLY. Every other event moves stock or is checked live by the server,
 * so it is sent directly and never queued. Milking is the one thing a parlour
 * must be able to record without signal.
 */
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
        payload: type === "MilkRecording" ? stampOffline(payload) : payload,
        label,
        createdAt: new Date().toISOString(),
      });
      return { queued: true, data: queued };
    }
    throw err;
  }
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

const labelMilk = (i: CreateMilkRecordingInput): string =>
  `Milk · ${i.herd}${i.milkingTime ? ` · ${i.milkingTime}` : ""}`;

// ---------------------------------------------------------------------------

export const useCreateAnimalEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AnimalEventInput) =>
      sendNow(() => createAnimalEvent(input)),
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

