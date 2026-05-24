import { frappeCreateAndSubmit } from "@/src/services/api";

import { getDocument } from "./generic";

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

/**
 * Snapshot of a Work Order's MFG row layout, with the few fields the mobile
 * caller cares about. The full doc has plenty more — we only set what's
 * needed to drive Frappe's status transition to "Completed".
 */
const datetimeNow = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * Resolves the Work Order's `production_item` from a BOM. BOMs have an
 * `item` link to the produced Item.
 */
const resolveProductionItem = async (bomNo: string): Promise<string | null> => {
  const bom = await getDocument<{ item?: string; item_code?: string }>(
    "BOM",
    bomNo,
    ["item", "item_code"],
  );
  return bom?.item ?? bom?.item_code ?? null;
};

/**
 * Create + submit a Work Order for a herd's TMR feeding. The doc is created
 * with qty == material_transferred_for_manufacturing == produced_qty so
 * Frappe's status calculator drives it to "Completed" on submit, matching
 * the shape the desktop UX produces.
 *
 * required_items are auto-filled by Frappe from the BOM on insert — we do
 * not pass them.
 */
export const createFeedingWorkOrder = async (
  input: CreateFeedingWorkOrderInput,
): Promise<any> => {
  const productionItem =
    input.productionItem ?? (await resolveProductionItem(input.bomNo));
  if (!productionItem) {
    throw new Error(`Could not resolve a production item from BOM ${input.bomNo}.`);
  }

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
    material_transferred_for_manufacturing: input.qty,
    produced_qty: input.qty,
    wip_warehouse: input.wipWarehouse,
    fg_warehouse: fg,
    transfer_material_against: "Work Order",
    use_multi_level_bom: 0,
    skip_transfer: 0,
    description: input.description || `TMR ${input.herd}`,
    stock_uom: "Kilogram",
    planned_start_date: stamp,
    actual_start_date: stamp,
    actual_end_date: stamp,
  };

  return frappeCreateAndSubmit("Work Order", body);
};
