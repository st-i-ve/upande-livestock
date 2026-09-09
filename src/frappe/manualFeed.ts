import { getClient } from "@/src/services/api";
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
      lines: input.lines.map((l) => ({ item_code: l.itemCode, qty: l.qty })),
    },
  });
  const message = res.data?.message ?? res.data;
  if (message?.error) throw new Error(message.error);
  return message as ManufactureResult;
};
