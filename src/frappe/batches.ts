import { getClient } from "@/src/services/api";

/** What the batch rule would take for an item in a store, and what else is there. */
export type BatchPlan = {
  item_code: string;
  warehouse: string;
  tracked: boolean;
  available: { batch_no: string; qty: number; expiry_date?: string | null }[];
};

const EVENT_BATCHES =
  "/api/method/upande_livestock.serverscripts.common.item_batches.event_batches";

/**
 * Ask the server which batches an item holds in a store. A blank batch on the
 * issue means "the rule chooses" (first expiry first out), so the phone only
 * offers this as an override — the same answer the web StockPicker shows.
 */
export const getBatchPlan = async (
  itemCode: string,
  warehouse: string,
  qty: number,
): Promise<BatchPlan | null> => {
  const client = await getClient();
  const res = await client.post(EVENT_BATCHES, {
    lines: JSON.stringify([{ item_code: itemCode, qty, warehouse }]),
  });
  const msg = res.data?.message;
  if (!msg || msg.error) return null;
  return (msg.lines?.[0] as BatchPlan) ?? null;
};
