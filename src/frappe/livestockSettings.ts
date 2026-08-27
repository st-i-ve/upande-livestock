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
/**
 * Livestock Settings as upande_livestock actually declares it.
 *
 * The previous shape here was a list of `custom_*` names from an older Kaitet
 * site; 25 of its 31 fields do not exist on this doctype, so reading them
 * returned undefined and writing them wrote nowhere. The names below are the
 * live ones. Where a screen needs an older key, ALIASES maps it.
 */
export type LivestockSettingsDoc = {
  // --- finance -------------------------------------------------------------
  custom_default_company?: string;
  custom_default_credit_account?: string;

  // --- milk ----------------------------------------------------------------
  custom_milk_item?: string;
  custom_milk_target_warehouse?: string;
  custom_milk_discard_warehouse?: string;
  custom_milking_stock_entry_type?: string;

  // --- stores --------------------------------------------------------------
  drug_warehouse?: string;
  semen_warehouse?: string;
  semen_item?: string;
  custom_feed_wip_warehouse?: string;

  // --- calf routing (sex-aware; the server falls back to these) ------------
  female_calf_herd?: string;
  male_calf_herd?: string;
  default_calf_herd?: string;

  // --- lifecycle herds -----------------------------------------------------
  incalf_heifer_herd?: string;
  high_yield_herd?: string;
  low_yield_herd?: string;
  steamer_herd?: string;

  /** Ordered rungs: herd, the days an animal spends on it, where it goes next. */
  growth_ladder?: { herd?: string; days?: number; next_herd?: string }[];

  // --- bull culling --------------------------------------------------------
  cull_bulls_after_birth?: 0 | 1;
  bull_cull_max_days?: number;
  bull_cull_warn_percent?: number;

  // --- intervals the guards read ------------------------------------------
  gestation_period_days?: number;
  min_calving_interval_days?: number;
  min_vaccination_interval_days?: number;
  min_deworming_interval_days?: number;
  min_weight_recording_interval_days?: number;
  min_hoof_trimming_interval_days?: number;
  max_open_days?: number;
};

/**
 * Old field name -> live field name, for screens still written against the
 * previous schema. Read through `settingAlias` rather than adding the dead
 * names back onto the type.
 */
export const SETTING_ALIASES: Record<string, keyof LivestockSettingsDoc> = {
  custom_drug_warehouse: "drug_warehouse",
  custom_semen_warehouse: "semen_warehouse",
  custom_default_heifer_herd: "female_calf_herd",
  custom_default_bull_herd: "male_calf_herd",
  custom_incalf_heifer_herd: "incalf_heifer_herd",
  custom_lactating_herd: "high_yield_herd",
  custom_default_dry_herd: "steamer_herd",
};

/** Read a setting by either its live name or a retired alias. */
export const settingAlias = (
  doc: LivestockSettingsDoc | undefined,
  key: string,
): string | undefined => {
  if (!doc) return undefined;
  const live = (SETTING_ALIASES[key] ?? key) as keyof LivestockSettingsDoc;
  const v = doc[live];
  return v == null ? undefined : String(v);
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
