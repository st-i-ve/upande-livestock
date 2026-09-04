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
  action: "info" | "day" | "manufacture" | "issue",
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

/** How much of today's ration this herd has had, and what is still owed.
 *
 *  The farm feeds twice a day, so "what does this herd need" is not the
 *  question at the parlour — "what is owed now" is. Read from what was issued,
 *  so a run someone entered by hand counts too. */
export type FeedDayStatus = {
  herd: string;
  heads: number;
  runsPerDay: number;
  dayKg: number;
  issuedKg: number;
  remainingKg: number;
  runsDone: number;
  suggestedPortion: number;
  complete: boolean;
};

export const getFeedDayStatus = async (herd: string): Promise<FeedDayStatus> => {
  const m = await callMethod<any>("day", { herd });
  return {
    herd: m.herd,
    heads: Number(m.heads ?? 0),
    runsPerDay: Number(m.runs_per_day ?? 2),
    dayKg: Number(m.day_kg ?? 0),
    issuedKg: Number(m.issued_kg ?? 0),
    remainingKg: Number(m.remaining_kg ?? 0),
    runsDone: Number(m.runs_done ?? 0),
    suggestedPortion: Number(m.suggested_portion ?? 1),
    complete: !!m.complete,
  };
};

/** Stage A — mix the herd's TMR and issue it, all in one.
 *
 *  `portion` is the fraction of the day this run covers: the farm feeds twice,
 *  so 0.5 twice makes a day. Take it from `getFeedDayStatus` rather than
 *  assuming a half — a herd already fed once is owed the remainder. */
export const manufactureHerdFeed = (
  herd: string,
  portion = 1,
): Promise<ManufactureResult> => callMethod("manufacture", { herd, portion });

/** Issue `qty` of feed already sitting in the store, without mixing.
 *
 *  No screen calls this, and one should think before adding one:
 *  `manufactureHerdFeed` already issues everything it mixes, so calling this
 *  after it feeds the herd a second time out of whatever else the store holds.
 *  That was a real bug on the feeding screen, which ran the two as stages.
 *
 *  It remains because the endpoint does — a store balance left over from
 *  before mixing-and-feeding became one action still has to be issuable. */
export const feedHerd = (
  herd: string,
  qty: number,
  employee?: string,
): Promise<FeedResult> => callMethod("issue", { herd, qty, employee });
