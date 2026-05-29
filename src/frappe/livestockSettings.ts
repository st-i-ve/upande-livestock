import { getClient } from "@/src/services/api";

/**
 * Pulls a single field value from the `Livestock Settings` single DocType.
 * Used to default Company, expense accounts, milk warehouse, milk price, etc.
 */
export const getLivestockSetting = async <T = string>(
  field: string,
): Promise<T | null> => {
  const client = await getClient();
  const res = await client.get("/api/method/frappe.client.get_single_value", {
    params: { doctype: "Livestock Settings", field },
  });
  return (res.data?.message ?? null) as T | null;
};

export const getDefaultCompany = (): Promise<string | null> =>
  getLivestockSetting<string>("custom_default_company");

/**
 * Full Livestock Settings document. Pulls every customisable field used by
 * the settings editor. Field names are taken verbatim from the server-scripts
 * reference doc (§2).
 */
export type LivestockSettingsDoc = {
  custom_default_company?: string;
  custom_default_credit_account?: string;
  custom_animal_asset_account?: string;
  custom_disposal_account?: string;
  custom_animal_sale_income_account?: string;
  custom_insurance_receivable_account?: string;
  custom_insurance_income_account?: string;
  custom_milk_income_account?: string;
  custom_vet_expense_account?: string;
  custom_feed_expense_account?: string;
  custom_milk_item?: string;
  custom_milk_target_warehouse?: string;
  custom_milk_discard_warehouse?: string;
  custom_milking_stock_entry_type?: string;
  custom_milk_price_per_kg?: number;
  custom_semen_warehouse?: string;
  custom_drug_warehouse?: string;
  custom_animal_sale_item?: string;
  custom_farm?: string;
  custom_milk_business_unit?: string;
  custom_default_heifer_herd?: string;
  custom_default_bull_herd?: string;
  custom_default_dry_herd?: string;
  custom_default_payout_percent?: number;
  /** Lactating group the dam moves into post-calving. */
  custom_lactating_herd?: string;
  /** Animals aged 2-4 months (extracted from the 0-2 herd at ~3 months). */
  custom_weaning_herd?: string;
  /** Animals aged 4-12 months (weaners). */
  custom_weaner_herd?: string;
  /** Animals 12+ months — heifers ready for service. */
  custom_bulling_heifer_herd?: string;
  /** Heifers confirmed in-calf (post-PD-Confirmed) but not yet calved. */
  custom_incalf_heifer_herd?: string;
  /** Mature cows confirmed in-calf (post-PD-Confirmed). */
  custom_incalf_cow_herd?: string;
  /** Cost-centre / debit account for the vet expense JE posted from batch drug issues. */
  custom_vet_expense_credit_account?: string;
};

export const getLivestockSettings = async (): Promise<LivestockSettingsDoc> => {
  const client = await getClient();
  const res = await client.get(
    "/api/resource/Livestock Settings/Livestock Settings",
  );
  return (res.data?.data ?? {}) as LivestockSettingsDoc;
};

/**
 * Update a subset of fields on the Livestock Settings single doc. Uses
 * `frappe.client.set_value` for each provided key so we don't have to fetch
 * + send the whole doc back.
 */
export const updateLivestockSettings = async (
  patch: Partial<LivestockSettingsDoc>,
): Promise<void> => {
  const client = await getClient();
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  // Single-call multi-field update.
  await client.post("/api/method/frappe.client.set_value", {
    doctype: "Livestock Settings",
    name: "Livestock Settings",
    fieldname: Object.fromEntries(entries),
  });
};
