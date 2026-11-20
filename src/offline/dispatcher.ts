import { createAnimalEvent } from "@/src/frappe/animalEvent";
import { createCheckUp } from "@/src/frappe/checkUp";
import { treatAnimal } from "@/src/frappe/treatment";
import { createAnimalDisposal } from "@/src/frappe/animalDisposal";
import { createMilkRecording } from "@/src/frappe/milkRecording";
import { recordQualityTest } from "@/src/frappe/milkQualityTest";

import { OpsError } from "@/src/frappe/opsError";
import { recordWeights } from "@/src/frappe/weights";
import { recordMilkQuality } from "@/src/frappe/quality";
import { addAnimalPhoto } from "@/src/frappe/animalPhotos";
import { manufactureHerdFeed } from "@/src/frappe/feeding";
import { manualFeed } from "@/src/frappe/manualFeed";
import { amendFeedDay, manufactureFeedActuals, resetFeedDay } from "@/src/frappe/feedActuals";

import { drain, loadQueue, type PendingMutation, type PendingMutationType } from "./queue";
import { classify, type DrainResult, type Handler } from "./queueCore";

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
 * What each kind of queued recording sends. Every handler gets the item, and puts
 * the item's id on the request as its `client_ref`, so a send the phone never saw
 * answered is a no-op on the server when it is sent again.
 */
const withRef = <P extends object>(payload: P, item: PendingMutation): P & { clientRef: string } => ({
  ...payload,
  clientRef: item.id,
});

const HANDLERS: Record<PendingMutationType, Handler> = {
  AnimalEvent: (p, i) => createAnimalEvent(withRef(p, i as PendingMutation)),
  MilkRecording: (p, i) => createMilkRecording(withRef(p, i as PendingMutation)),
  MilkQualityTest: (p, i) => recordQualityTest(withRef(p, i as PendingMutation)),
  AnimalDisposal: (p, i) => createAnimalDisposal(withRef(p, i as PendingMutation)),
  AnimalDiagnosis: (p, i) => createCheckUp(withRef(p, i as PendingMutation)),
  Treatment: (p, i) => treatAnimal(withRef(p, i as PendingMutation)),
  Weights: async (p, i) => {
    const out = await recordWeights(withRef(p, i as PendingMutation));
    // The server saves each animal on its own; a refused one comes back in `failed`
    // inside an answer that is otherwise fine. It must reach the person, not be
    // counted as sent.
    if (out.failed?.length) {
      throw new OpsError(out.failed.map((f) => `${f.animal}: ${f.why}`).join("\n"));
    }
    return out;
  },
  MilkQuality: (p, i) => recordMilkQuality(withRef(p, i as PendingMutation)),
  Feeding: (p, i) => {
    if (p.action === "manual") return manualFeed(withRef(p.input, i as PendingMutation));
    return manufactureHerdFeed(p.herd, p.portion ?? 1, p.postingDate, p.bomNo, i.id);
  },
  FeedDay: (p, i) => {
    if (p.action === "amend") return amendFeedDay(p.herd, p.date, p.kgByItem, p.remarks, i.id);
    if (p.action === "reset") return resetFeedDay(p.herd, p.date, i.id);
    return manufactureFeedActuals(p.herd, p.date, p.employee, i.id);
  },
  // The picture goes up after its record (same keys, queued later). A photo of a
  // treatment still in the queue names it by client_ref; the server finds the case.
  AnimalPhoto: (p, i) => addAnimalPhoto({ ...p, clientRef: i.id }),
  Animal: retiredAnimalCreate,
  CalfFeeding: retiredCalfFeeding,
  AnimalHealthCase: retiredHealthCase,
  BatchDrugIssue: retiredBatchDrugIssue,
  AnimalHealthCaseUpdate: retiredHealthCase,
};

export type { DrainResult };

/** Send what is waiting. `force` ignores backoff (reconnect, foreground, Retry now). */
export const drainQueue = (opts: { force?: boolean; onStep?: () => void } = {}): Promise<DrainResult> =>
  drain(HANDLERS, opts);

/** Kept for callers that ask whether a failure was a dead network. */
export const isOfflineError = (err: unknown): boolean => classify(err) === "network";

