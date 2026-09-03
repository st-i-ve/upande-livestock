import { getClient } from "@/src/services/api";

/**
 * Animal feeding — two-stage flow backed by whitelisted methods in
 * upande_livestock/api/feeding.py:
 *   1. Manufacture — build the herd's TMR (Work Order + Material Transfer for
 *      Manufacture + Manufacture) into the feed store. Qty scales with head
 *      count: total = heads × BOM.quantity; raw materials scale by heads.
 *   2. Feed — issue a chosen quantity of the manufactured feed out of the store
 *      to the herd (Material Issue), attributed to the logged-in employee.
 */

// This used to call upande_livestock.api.feeding — the engine underneath the
// feed endpoints, which carried no permission check at all, so the handset was
// manufacturing feed and moving stock unguarded. The engine is no longer
// whitelisted; this goes through the guarded mobile entry point.
const RECORD_FEEDING =
  "upande_livestock.serverscripts.mobile.record_feeding.record_feeding";

const callMethod = async <T = any>(
  action: "info" | "manufacture" | "issue",
  args: Record<string, any>,
): Promise<T> => {
  const client = await getClient();
  const res = await client.post(`/api/method/${RECORD_FEEDING}`, {
    payload: { action, ...args },
  });
  return (res.data?.message ?? res.data) as T;
};

export type FeedBreakdownRow = {
  itemCode: string;
  itemName: string;
  perHeadQty: number;
  totalQty: number;
  uom: string;
};

export type HerdFeedInfo = {
  herd: string;
  bomNo: string;
  productionItem: string;
  productionItemName: string;
  heads: number;
  perHeadQty: number;
  totalManufactureQty: number;
  uom: string;
  store: string;
  availableInStore: number;
  breakdown: FeedBreakdownRow[];
};

export type ManufactureResult = {
  work_order: string;
  production_item: string;
  heads: number;
  per_head_qty: number;
  produced_qty: number;
  uom: string;
  store: string;
  transfer_stock_entry: string;
  manufacture_stock_entry: string;
};

export type FeedResult = {
  stock_entry: string;
  herd: string;
  production_item: string;
  issued_qty: number;
  uom: string;
  store: string;
  employee: string | null;
};

/** Preview: per-head BOM scaled by head count + how much finished feed is in the store. */
export const getHerdFeedInfo = async (herd: string): Promise<HerdFeedInfo> => {
  const m = await callMethod("info", { herd });
  return {
    herd: m.herd,
    bomNo: m.bom_no,
    productionItem: m.production_item,
    productionItemName: m.production_item_name,
    heads: Number(m.heads ?? 0),
    perHeadQty: Number(m.per_head_qty ?? 0),
    totalManufactureQty: Number(m.total_manufacture_qty ?? 0),
    uom: m.uom ?? "",
    store: m.store ?? "",
    availableInStore: Number(m.available_in_store ?? 0),
    breakdown: (m.breakdown ?? []).map((b: any) => ({
      itemCode: b.item_code,
      itemName: b.item_name,
      perHeadQty: Number(b.per_head_qty ?? 0),
      totalQty: Number(b.total_qty ?? 0),
      uom: b.uom ?? "",
    })),
  };
};

/** Stage A — manufacture the herd's TMR into the feed store. */
export const manufactureHerdFeed = (herd: string): Promise<ManufactureResult> =>
  callMethod("manufacture", { herd });

/** Stage B — issue `qty` of the manufactured feed to the herd (Material Issue). */
export const feedHerd = (
  herd: string,
  qty: number,
  employee?: string,
): Promise<FeedResult> => callMethod("issue", { herd, qty, employee });
