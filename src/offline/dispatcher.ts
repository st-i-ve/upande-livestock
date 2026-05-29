import { createAnimal } from "@/src/frappe/animal";
import { createAnimalEvent } from "@/src/frappe/animalEvent";
import { createAnimalDiagnosis } from "@/src/frappe/animalDiagnosis";
import { createAnimalDisposal } from "@/src/frappe/animalDisposal";
import { createAnimalHealthCase, updateAnimalHealthCase } from "@/src/frappe/animalHealthCase";
import { createCalfFeeding } from "@/src/frappe/calfFeeding";
import { createMilkRecording } from "@/src/frappe/milkRecording";
import { createFeedingWorkOrder } from "@/src/frappe/workOrder";
import { submitBatchDrugIssue } from "@/src/frappe/batchDrugIssue";
import { extractFrappeError } from "@/src/services/api";

import {
  PendingMutation,
  PendingMutationType,
  loadQueue,
  markAttempt,
  remove,
} from "./queue";

/**
 * Registry mapping each PendingMutationType to the function that submits it.
 * Adding a new offline-aware mutation: add a member to PendingMutationType,
 * wire its createXxx here, and call enqueue with that type in the hook.
 */
const HANDLERS: Record<PendingMutationType, (payload: any) => Promise<any>> = {
  AnimalEvent: createAnimalEvent,
  MilkRecording: createMilkRecording,
  AnimalDisposal: createAnimalDisposal,
  Animal: createAnimal,
  CalfFeeding: createCalfFeeding,
  AnimalDiagnosis: createAnimalDiagnosis,
  AnimalHealthCase: createAnimalHealthCase,
  FeedingWorkOrder: createFeedingWorkOrder,
  BatchDrugIssue: submitBatchDrugIssue,
  AnimalHealthCaseUpdate: updateAnimalHealthCase,
};

/**
 * Direct call to the right handler. Throws on failure — the caller decides
 * whether to enqueue based on the error shape.
 */
export const dispatchDirect = (
  type: PendingMutationType,
  payload: any,
): Promise<any> => HANDLERS[type](payload);

let draining = false;

export type DrainResult = {
  succeeded: number;
  remaining: number;
  errors: { id: string; message: string }[];
};

/**
 * Walk the queue in FIFO order and try each mutation. Stops at the first
 * network-level failure (keeps order); on application-level failure, marks
 * the attempt + leaves the item in place so the user can review and decide
 * what to do via the Pending screen.
 */
export const drainQueue = async (): Promise<DrainResult> => {
  if (draining) return { succeeded: 0, remaining: (await loadQueue()).length, errors: [] };
  draining = true;
  let succeeded = 0;
  const errors: DrainResult["errors"] = [];
  try {
    let queue: PendingMutation[] = await loadQueue();
    for (const item of queue) {
      try {
        await HANDLERS[item.type](item.payload);
        await remove(item.id);
        succeeded += 1;
      } catch (err) {
        const message = extractFrappeError(err);
        await markAttempt(item.id, message);
        const isNetwork = !(err as any)?.response;
        errors.push({ id: item.id, message });
        if (isNetwork) {
          // Network problem — stop draining; we'll try again on next signal.
          break;
        }
        // Application-level error: keep going; the user must decide.
      }
    }
    queue = await loadQueue();
    return { succeeded, remaining: queue.length, errors };
  } finally {
    draining = false;
  }
};

/**
 * Helpers used by the offline-aware mutation hooks.
 */
export const isOfflineError = (err: unknown): boolean => {
  const e = err as any;
  if (!e) return false;
  // No HTTP response means we never got past the network — typical when
  // offline, DNS fails, or the server is unreachable.
  if (!e.response) return true;
  if (e.code === "ECONNABORTED" || e.code === "ERR_NETWORK") return true;
  return false;
};
