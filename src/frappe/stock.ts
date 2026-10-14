import { listDocuments } from "./generic";

/**
 * On-hand quantity for an item at a warehouse (from its Bin balance).
 * Returns 0 when there is no Bin row (item never stocked there). Used to show
 * the operator what's in the store before issuing drugs / semen / dry-cow
 * tubes, and to block over-issue before submit.
 */
export const getItemStoreQty = async (
  itemCode: string,
  warehouse?: string,
): Promise<number> => {
  if (!itemCode || !warehouse) return 0;
  const bins = await listDocuments<{ actual_qty: number }>({
    doctype: "Bin",
    fields: ["actual_qty"],
    filters: [
      ["item_code", "=", itemCode],
      ["warehouse", "=", warehouse],
    ],
    limit: 1,
  });
  return Number(bins[0]?.actual_qty ?? 0);
};

export type IssueLine = {
  itemCode: string;
  warehouse: string;
  qtyNeeded: number;
  label?: string; // item name, for a friendlier message
};

/**
 * Verify each issue line against live Bin stock. Returns a human-readable
 * error for the first line that would over-issue (needed > on-hand), or null
 * when everything fits. ERPNext also blocks negative stock server-side; this
 * surfaces a clear message to the operator *before* submit.
 */
export const findStoreShortage = async (
  lines: IssueLine[],
): Promise<string | null> => {
  for (const l of lines) {
    if (!l.itemCode || !l.warehouse || l.qtyNeeded <= 0) continue;
    const available = await getItemStoreQty(l.itemCode, l.warehouse);
    if (l.qtyNeeded > available) {
      return `Not enough ${l.label || l.itemCode} in ${l.warehouse}: need ${l.qtyNeeded}, only ${available} in stock.`;
    }
  }
  return null;
};

/**
 * FIFO valuation rate for an item at a warehouse (from its Bin balance).
 * Used to show the operator the cost of drugs before a batch issue. Falls
 * back to the item's own valuation_rate when there's no Bin row, then 0.
 */
export const getItemValuationRate = async (
  itemCode: string,
  warehouse?: string,
): Promise<number> => {
  if (!itemCode) return 0;
  if (warehouse) {
    const bins = await listDocuments<{ valuation_rate: number }>({
      doctype: "Bin",
      fields: ["valuation_rate"],
      filters: [
        ["item_code", "=", itemCode],
        ["warehouse", "=", warehouse],
      ],
      limit: 1,
    });
    if (bins[0]?.valuation_rate) return Number(bins[0].valuation_rate);
  }
  const item = await listDocuments<{ valuation_rate: number }>({
    doctype: "Item",
    fields: ["valuation_rate"],
    filters: [["name", "=", itemCode]],
    limit: 1,
  });
  return Number(item[0]?.valuation_rate ?? 0);
};
