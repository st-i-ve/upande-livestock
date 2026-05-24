import { getDocument } from "./generic";

export type ItemSnapshot = {
  itemCode: string;
  itemName: string;
  stockUom: string;
  /** Per-unit cost. Prefers `last_purchase_rate` (price of the last buy);
   *  falls back to `valuation_rate` (current weighted-average); 0 if both
   *  are unset. */
  rate: number;
  rateSource: "last_purchase" | "valuation" | "none";
};

/**
 * Pulls just enough of an Item to drive a Treatment / Drug row in a form:
 * the friendly name + UOM + per-unit cost. Used to auto-fill the rate
 * column when an operator picks a drug.
 */
export const getItemSnapshot = async (
  name: string,
): Promise<ItemSnapshot | null> => {
  if (!name) return null;
  const row = await getDocument<{
    item_code: string;
    item_name?: string;
    stock_uom?: string;
    last_purchase_rate?: number;
    valuation_rate?: number;
  }>("Item", name, [
    "item_code",
    "item_name",
    "stock_uom",
    "last_purchase_rate",
    "valuation_rate",
  ]);
  if (!row) return null;

  const lastBuy = Number(row.last_purchase_rate ?? 0);
  const valuation = Number(row.valuation_rate ?? 0);
  const rate = lastBuy > 0 ? lastBuy : valuation;
  const rateSource: ItemSnapshot["rateSource"] =
    lastBuy > 0 ? "last_purchase" : valuation > 0 ? "valuation" : "none";

  return {
    itemCode: row.item_code ?? name,
    itemName: row.item_name || row.item_code || name,
    stockUom: row.stock_uom || "",
    rate,
    rateSource,
  };
};
