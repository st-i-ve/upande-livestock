import { getClient } from "@/src/services/api";

/**
 * What the livestock stores hold, read-only. The server answers from the same
 * item groups and stores the event pickers use (field roles cannot read Bin, so
 * this goes through a whitelisted read, not the Bin doctype). Online only.
 */
export type StoreItem = {
  item_code: string;
  item_name: string;
  uom: string;
  qty: number;
  item_group: string | null;
  /** Event types that draw on this item's group. */
  events: string[];
};

export type StoreStock = { warehouse: string; items: StoreItem[] };

export type LivestockStock = { as_of: string; stores: StoreStock[]; count: number };

const PATH =
  "/api/method/upande_livestock.serverscripts.mobile.get_livestock_stock.get_livestock_stock";

export const getLivestockStock = async (): Promise<LivestockStock> => {
  const client = await getClient();
  const res = await client.post(PATH, {});
  const msg = res.data?.message;
  if (!msg || msg.error) throw new Error(msg?.error || "Could not load the stock.");
  return { as_of: msg.as_of ?? "", stores: msg.stores ?? [], count: msg.count ?? 0 };
};
