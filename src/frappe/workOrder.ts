import { frappeCreateAndSubmit, frappeInsertDraft } from "@/src/services/api";

import { getDocument } from "./generic";
import { getStockBins } from "./stock";

export type CreateFeedingWorkOrderInput = {
  /** Herd doc name — written to custom_herd. */
  herd: string;
  /** BOM doc name, e.g. "BOM-Bullying Heifers-004". */
  bomNo: string;
  /** Production Item (BOM output). If absent we resolve from the BOM. */
  productionItem?: string;
  /** Total feed delivered (kg). Drives qty + material_transferred + produced. */
  qty: number;
  /** custom_no_of_cows — usually the herd's number_of_animals. */
  noOfCows: number;
  company: string;
  /** Manufacturing WIP + FG warehouse (same for TMR). */
  wipWarehouse: string;
  fgWarehouse?: string;
  description?: string;
};

export type StockShortfall = {
  itemCode: string;
  itemName: string;
  requiredQty: number;
  availableQty: number;
  uom: string;
};

export type FeedingWorkOrderResult = {
  /** The submitted Work Order (Completed) or the Draft on shortfall. */
  workOrder: any;
  /** True when stock check failed and the doc was saved as Draft. */
  draft: boolean;
  /** Items that came up short, only set when `draft` is true. */
  shortfalls: StockShortfall[];
};

const datetimeNow = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

type BomDoc = {
  item?: string;
  item_code?: string;
  quantity?: number;
  items?: Array<{
    item_code: string;
    item_name?: string;
    qty: number;
    stock_qty?: number;
    stock_uom?: string;
    uom?: string;
    source_warehouse?: string;
  }>;
};

/** Pulls BOM with its `items` child table for requirements computation. */
const fetchBom = (bomNo: string) => getDocument<BomDoc>("BOM", bomNo);

/**
 * For a given Work Order target qty, scale BOM line quantities to the
 * required production. BOMs publish per-batch quantities (`bom.quantity`);
 * if the WO produces a different qty we scale linearly.
 */
const scaleRequirements = (bom: BomDoc, targetQty: number) => {
  const batchQty = Number(bom.quantity ?? 1) || 1;
  const factor = targetQty / batchQty;
  return (bom.items ?? []).map((row) => ({
    itemCode: row.item_code,
    itemName: row.item_name || row.item_code,
    requiredQty: Number(row.stock_qty ?? row.qty ?? 0) * factor,
    uom: row.stock_uom || row.uom || "",
    sourceWarehouse: row.source_warehouse || "",
  }));
};

/**
 * Compare required quantities (per BOM × WO qty) to current Bin balances
 * at each item's source warehouse. Items with no source_warehouse on the
 * BOM line fall back to the Work Order's WIP warehouse.
 */
const checkStock = async (
  requirements: ReturnType<typeof scaleRequirements>,
  fallbackWarehouse: string,
): Promise<StockShortfall[]> => {
  const shortfalls: StockShortfall[] = [];
  for (const r of requirements) {
    if (r.requiredQty <= 0) continue;
    const wh = r.sourceWarehouse || fallbackWarehouse;
    const bins = await getStockBins({
      warehouse: wh,
      itemCodeLike: r.itemCode,
      includeEmpty: true,
      limit: 5,
    });
    // The bin query uses LIKE; pick the exact match if present.
    const exact = bins.find((b) => b.itemCode === r.itemCode);
    const available = exact?.actualQty ?? bins[0]?.actualQty ?? 0;
    if (available < r.requiredQty) {
      shortfalls.push({
        itemCode: r.itemCode,
        itemName: r.itemName,
        requiredQty: r.requiredQty,
        availableQty: available,
        uom: r.uom,
      });
    }
  }
  return shortfalls;
};

/**
 * Create a Work Order for TMR feeding. Pre-flight checks raw-material
 * stock at the source warehouse; on shortfall the WO is saved as Draft
 * (docstatus=0) so the user can review and submit manually from desktop
 * after stock arrives. With sufficient stock the WO is created + submitted
 * straight to "Completed" via the standard insert→submit two-step.
 *
 * Returns the doc plus a boolean + shortfall list so the caller can show
 * the operator what to top up.
 */
export const createFeedingWorkOrder = async (
  input: CreateFeedingWorkOrderInput,
): Promise<FeedingWorkOrderResult> => {
  const bom = await fetchBom(input.bomNo);
  if (!bom) throw new Error(`BOM ${input.bomNo} not found.`);
  const productionItem = input.productionItem ?? bom.item ?? bom.item_code;
  if (!productionItem) {
    throw new Error(`Could not resolve a production item from BOM ${input.bomNo}.`);
  }

  const requirements = scaleRequirements(bom, input.qty);
  const shortfalls = await checkStock(requirements, input.wipWarehouse);

  const fg = input.fgWarehouse ?? input.wipWarehouse;
  const stamp = datetimeNow();
  const body: Record<string, any> = {
    naming_series: "MFG-WO-.YYYY.-",
    production_item: productionItem,
    bom_no: input.bomNo,
    custom_herd: input.herd,
    custom_no_of_cows: input.noOfCows,
    company: input.company,
    qty: input.qty,
    wip_warehouse: input.wipWarehouse,
    fg_warehouse: fg,
    transfer_material_against: "Work Order",
    use_multi_level_bom: 0,
    skip_transfer: 0,
    description: input.description || `TMR ${input.herd}`,
    stock_uom: "Kilogram",
    planned_start_date: stamp,
  };

  if (shortfalls.length > 0) {
    // Save as Draft only — no actual dates, no submit. The user reviews
    // and tops up stock before submitting.
    const draft = await frappeInsertDraft("Work Order", body);
    return { workOrder: draft, draft: true, shortfalls };
  }

  // Sufficient stock: drive the WO through to Completed by setting the
  // transferred + produced quantities + actual dates, then submit.
  body.material_transferred_for_manufacturing = input.qty;
  body.produced_qty = input.qty;
  body.actual_start_date = stamp;
  body.actual_end_date = stamp;

  const submitted = await frappeCreateAndSubmit("Work Order", body);
  return { workOrder: submitted, draft: false, shortfalls: [] };
};
