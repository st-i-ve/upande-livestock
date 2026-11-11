import { getClient } from "@/src/services/api";
import { OpsError } from "@/src/frappe/opsError";
import type { ManufactureResult } from "./feeding";

const RECORD_FEEDING =
  "upande_livestock.serverscripts.mobile.record_feeding.record_feeding";

export type ManualFeedLine = {
  itemCode: string;
  itemName?: string;
  /** In the base BOM's recipe unit of measure — NOT the item's stock UOM.
   *  The server derives the conversion factor from the herd's own BOM, so
   *  send exactly the number the screen shows; do not convert it here. */
  qty: number;
  /** The line's unit, sent back with it: the recipe's own unit for a line
   *  seeded from a BOM (so it matches that row), Gram or Millilitre for a
   *  per-head dose (so 7 stays 7 g, not 7 kg), or a store unit the operator
   *  picked (Litre, BALE), which the server converts with the item's own
   *  table (`_tuned_bom.row_units`). */
  uom?: string;
};

export type ManualFeedInput = {
  herd: string;
  lines: ManualFeedLine[];
  /** How many animals were actually at the trough. Not the herd's head count —
   *  that is the number this screen exists to override. */
  heads: number;
  postingDate?: string;
  portion?: number;
  employee?: string;
  /** The recipe the operator was tuning from — the herd's standing ration, or
   *  a previously-tuned BOM picked instead. Sent as `base_bom` so the tuned
   *  BOM `manual_feed` builds descends from what was actually on screen,
   *  rather than from whichever BOM happens to be the herd's registered one.
   *  `manual_feed.py` already reads this key (`tuned_bom(herd, lines,
   *  base_bom=d.get("base_bom"))`) — it was simply never sent from here. */
  baseBom?: string;
  /** The group's kilos as weighed, on a farm not feeding by head count
   *  (`feed_day_status.feed_by_head_count` off): the server scales the tuned
   *  lines to it. Leave it out on a head-count farm; the server ignores it there. */
  totalQty?: number;
};

/** Mix and issue a ration the operator tuned by hand.
 *
 *  The server builds a BOM from these lines (reusing one if this exact tune has
 *  been mixed before), runs the same Work Order route the system path uses, and
 *  labels the resulting Feeding event "Manual".
 *
 *  `postingDate` backdates the run like `manufactureHerdFeed`'s does: the
 *  server refuses one the stores could not have covered that day and names
 *  each short item plus the earliest date that would work — that message is
 *  thrown here unchanged. */
export const manualFeed = async (
  input: ManualFeedInput,
): Promise<ManufactureResult> => {
  const client = await getClient();
  const res = await client.post(`/api/method/${RECORD_FEEDING}`, {
    payload: {
      action: "manual",
      herd: input.herd,
      heads: input.heads,
      portion: input.portion ?? 1,
      posting_date: input.postingDate,
      employee: input.employee,
      base_bom: input.baseBom,
      total_qty: input.totalQty,
      lines: input.lines.map((l) => (l.uom ? { item_code: l.itemCode, qty: l.qty, uom: l.uom } : { item_code: l.itemCode, qty: l.qty })),
    },
  });
  const message = res.data?.message ?? res.data;
  if (message?.error) throw new OpsError(message.error, message.code);
  return message as ManufactureResult;
};
