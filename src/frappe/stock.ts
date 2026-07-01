import { listDocuments } from "./generic";

export type StockBinRow = {
  itemCode: string;
  itemName: string;
  stockUom: string;
  warehouse: string;
  actualQty: number;
  projectedQty: number;
  valuationRate: number;
};

const mapBin = (row: any): StockBinRow => ({
  itemCode: row.item_code,
  itemName: row.item_name || row.item_code,
  stockUom: row.stock_uom || "",
  warehouse: row.warehouse,
  actualQty: Number(row.actual_qty ?? 0),
  projectedQty: Number(row.projected_qty ?? 0),
  valuationRate: Number(row.valuation_rate ?? 0),
});

/**
 * Stock balance from Frappe Bin DocType. Each row is one item × warehouse.
 * Filter by warehouse or by item-name pattern as needed.
 */
export const getStockBins = async (params: {
  warehouse?: string;
  itemCodeLike?: string;
  itemNameLike?: string;
  includeEmpty?: boolean;
  limit?: number;
}): Promise<StockBinRow[]> => {
  const filters: [string, string, any][] = [];
  if (params.warehouse) filters.push(["warehouse", "=", params.warehouse]);
  if (!params.includeEmpty) filters.push(["actual_qty", ">", 0]);
  if (params.itemCodeLike) filters.push(["item_code", "like", `%${params.itemCodeLike}%`]);
  if (params.itemNameLike) filters.push(["item_name", "like", `%${params.itemNameLike}%`]);

  const rows = await listDocuments({
    doctype: "Bin",
    fields: [
      "name",
      "item_code",
      "item_name",
      "stock_uom",
      "warehouse",
      "actual_qty",
      "projected_qty",
      "valuation_rate",
    ],
    filters,
    orderBy: "actual_qty desc",
    limit: params.limit ?? 200,
  });
  return rows.map(mapBin);
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
