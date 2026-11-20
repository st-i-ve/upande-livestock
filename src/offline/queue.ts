import { extractFrappeError } from "@/src/services/api";
import { STORAGE_KEYS, storage } from "@/src/services/storage";

import { discardPayloadPhotos } from "./photos";
import {
  createQueue,
  makeUuid,
  type DrainResult,
  type Handler,
  type QueueItem,
} from "./queueCore";

/**
 * The phone's one queue of recordings. Every recording is saved here FIRST under
 * a client_ref (its id, a uuid) and sent from here by `dispatcher.ts` whenever
 * there is signal: on reconnect, on app foreground, and on the sync tick. State is
 * durable across restarts (AsyncStorage). The rules live in `queueCore.ts`, which
 * the tests drive; this file only wires it to storage and to photo cleanup.
 */

export type PendingMutationType =
  | "AnimalEvent"
  | "MilkRecording"
  /** A buyer's milk quality sheet. */
  | "MilkQualityTest"
  | "AnimalDisposal"
  | "AnimalDiagnosis"
  | "Treatment"
  /** Weighings (one session, one or more animals). */
  | "Weights"
  /** Feed a herd: manufacture / manual / issue (record_feeding). */
  | "Feeding"
  /** Feeding day sheet: amend / reset / mix the day's actuals. */
  | "FeedDay"
  /** The older Quality screen's figures against a recorded milking. */
  | "MilkQuality"
  /** An animal photo: uploaded after its record, linked by client_ref. */
  | "AnimalPhoto"
  /** Retired types, kept so an item an older build queued is reported, not lost. */
  | "Animal"
  | "CalfFeeding"
  | "AnimalHealthCase"
  | "BatchDrugIssue"
  | "AnimalHealthCaseUpdate";

export type PendingMutation = QueueItem & { type: PendingMutationType };

/** A queued milking the server refuses on a closed window is more than a day old;
 *  say what to do about it. The item stays in the list to edit, retry or discard. */
const messageOf = (err: unknown, item: QueueItem): string => {
  const message = extractFrappeError(err);
  return item.type === "MilkRecording" &&
    !/switched off/i.test(message) &&
    /backdating is closed|more than a day old/i.test(message)
    ? "This milking is more than a day old — ask the Livestock Manager to open backdating, then retry."
    : message;
};

export const queue = createQueue({
  messageOf,
  kv: {
    get: () => storage.getItem(STORAGE_KEYS.PENDING_QUEUE),
    set: (v) => storage.setItem(STORAGE_KEYS.PENDING_QUEUE, v),
  },
  onGone: (items) => items.forEach((i) => discardPayloadPhotos(i.payload)),
});

export const loadQueue = queue.load as () => Promise<PendingMutation[]>;
export const subscribe = queue.subscribe as (fn: (q: PendingMutation[]) => void) => () => void;
export const remove = queue.remove;
export const clear = queue.clear;
export const retryItem = queue.retry;
export const editItem = queue.edit;
export const drain = queue.drain as (
  handlers: Record<string, Handler>,
  opts?: { force?: boolean; onStep?: () => void },
) => Promise<DrainResult>;

/** The client_ref for a new recording. */
export const newId = (): string => makeUuid();

/**
 * Save a recording. Resolves once it is in durable storage, before anything is
 * sent. `keys` are the animals (or herds) it is about, so it is sent after earlier
 * recordings of the same animal.
 */
export const enqueue = async (entry: {
  id?: string;
  type: PendingMutationType;
  payload: any;
  label: string;
  keys?: string[];
  createdAt?: string;
}): Promise<PendingMutation> =>
  (await queue.enqueue({ ...entry, id: entry.id ?? newId() })) as PendingMutation;
