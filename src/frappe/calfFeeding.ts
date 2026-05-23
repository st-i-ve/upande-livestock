import { frappeCreateAndSubmit, todayISO } from "@/src/services/api";

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
 * Create + submit a Calf Feeding event. On submit the server creates a
 * Material Issue Stock Entry from `sourceWarehouse` and a Journal Entry
 * Dr Feed Expense / Cr Stock-in-Transit.
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
  return frappeCreateAndSubmit("Calf Feeding", body);
};
