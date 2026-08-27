import { todayISO } from "@/src/services/api";

import { OpsError } from "./opsError";

export type CalfFeedingSession = "AM" | "PM" | "Midday" | "Night";
export type CalfFeedType =
  | "Colostrum"
  | "Transitional Milk"
  | "Whole Milk"
  | "Milk Replacer"
  | "Starter Feed"
  | "Forage";

export type CreateCalfFeedingInput = {
  calf: string;                  // Animal name
  feedingDate?: string;          // ISO; default today
  feedingSession: CalfFeedingSession;
  company: string;
  feedType: CalfFeedType;
  feedItem: string;              // Frappe Item code
  sourceWarehouse: string;
  quantityKg: number;
  operator: string;              // Employee name
  colostrumSourceCow?: string;   // Animal name
  calfResponse?:
    | "Good Appetite"
    | "Slow / Hesitant"
    | "Refused"
    | "Sick / Off Feed";
  remarks?: string;
};

/**
 * Record a per-session calf feeding.
 *
 * NOT AVAILABLE on upande_livestock. This was written against a `Calf Feeding`
 * doctype that does not exist here; the two nearest things are `Calf Rearing`
 * (one lifetime record per calf — colostrum given, weaning weight, daily gain,
 * not a session log) and the herd feeding programme, which issues a ration to
 * a whole herd including the calf groups. Neither is a per-calf, per-session
 * bottle log.
 *
 * The screen behind this is not on the record menu, so nothing reaches it in
 * normal use. It fails loudly rather than posting to a missing doctype, so that
 * if it ever is wired up the gap is obvious instead of silent — and, being an
 * OpsError, the failure is never mistaken for being offline and queued.
 */
export const createCalfFeeding = async (
  input: CreateCalfFeedingInput,
): Promise<any> => {
  const body: Record<string, any> = {
    calf: input.calf,
    feeding_date: input.feedingDate || todayISO(),
    feeding_session: input.feedingSession,
    company: input.company,
    feed_type: input.feedType,
    feed_item: input.feedItem,
    source_warehouse: input.sourceWarehouse,
    quantity_kg: input.quantityKg,
    operator: input.operator,
  };
  if (input.colostrumSourceCow) body.colostrum_source_cow = input.colostrumSourceCow;
  if (input.calfResponse) body.calf_response = input.calfResponse;
  if (input.remarks) body.remarks = input.remarks;
  throw new OpsError(
    "Per-session calf feeding has no home on this system yet. Record the calf's " +
      "ration through the herd feeding programme, or its colostrum and weaning " +
      "figures on its Calf Rearing record.",
  );
};
