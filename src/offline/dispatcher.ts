import { createAnimalEvent } from "@/src/frappe/animalEvent";
import { createCheckUp } from "@/src/frappe/checkUp";
import { treatAnimal } from "@/src/frappe/treatment";
import { createAnimalDisposal } from "@/src/frappe/animalDisposal";
import { createMilkRecording } from "@/src/frappe/milkRecording";
import { extractFrappeError } from "@/src/services/api";

import {
  PendingMutation,
  PendingMutationType,
  loadQueue,
  markAttempt,
  remove,
} from "./queue";

/**
 * Items an older build queued before stock and vet fees became the server's job.
 * Rejected as an application-level error (it carries a `response`), so the
 * drain reports it on the Pending screen and moves on rather than treating it
 * as a dead network and stalling everything behind it.
 */
async function retiredBatchDrugIssue(): Promise<never> {
  const err: any = new Error(
    "This drug / vet-fee entry was queued by an older version of the app, which posted stock from the phone. Re-enter it on the web, then discard this item.",
  );
  err.response = { status: 410 };
  throw err;
}

/** Health files are opened through a treatment, and closed on the web. Anything an
 *  older build queued is reported on the Pending screen rather than replayed. */
async function retiredHealthCase(): Promise<never> {
  const err: any = new Error(
    "Health files are opened by recording a treatment and closed on the web. Record it again there, then discard this item.",
  );
  err.response = { status: 410 };
  throw err;
}

/** Per-session calf feeding never had a home on this backend. Reported, not posted. */
async function retiredCalfFeeding(): Promise<never> {
  const err: any = new Error(
    "Per-session calf feeding is not recorded from the phone. Discard this item.",
  );
  err.response = { status: 410 };
  throw err;
}

/** The phone no longer creates animals: a purchase is `buy_in_animal` and a calf
 *  is made by the birth, both on the server. Anything queued by an old build is
 *  surfaced on the Pending screen rather than posted to fields that are gone. */
async function retiredAnimalCreate(): Promise<never> {
  const err: any = new Error(
    "New animals are no longer created from the phone. Register this one on the web, then discard this item.",
  );
  err.response = { status: 410 };
  throw err;
}

/**
 * Registry mapping each PendingMutationType to the function that submits it.
 * Adding a new offline-aware mutation: add a member to PendingMutationType,
 * wire its createXxx here, and call enqueue with that type in the hook.
 */
const HANDLERS: Record<PendingMutationType, (payload: any) => Promise<any>> = {
  AnimalEvent: createAnimalEvent,
  MilkRecording: createMilkRecording,
  AnimalDisposal: createAnimalDisposal,
  Animal: retiredAnimalCreate,
  CalfFeeding: retiredCalfFeeding,
  AnimalDiagnosis: createCheckUp,
  Treatment: treatAnimal,
  AnimalHealthCase: retiredHealthCase,
  BatchDrugIssue: retiredBatchDrugIssue,
  AnimalHealthCaseUpdate: retiredHealthCase,
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
  // An operations endpoint that answers `{error: "..."}` does so with HTTP 200
  // and no axios response attached to the thrown error. Without this check it
  // looks identical to being offline, and a refused entry — a cow with no open
  // service, a store that cannot cover the dose — would be queued and retried
  // forever instead of shown to the operator.
  if (e.isServerRejection) return false;
  // No HTTP response means we never got past the network — typical when
  // offline, DNS fails, or the server is unreachable.
  if (!e.response) return true;
  if (e.code === "ECONNABORTED" || e.code === "ERR_NETWORK") return true;
  return false;
};
