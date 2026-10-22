import { getClient } from "@/src/services/api";

/**
 * Livestock Settings as upande_livestock actually declares it.
 *
 * The previous shape here was a list of `custom_*` names from an older Kaitet
 * site; 25 of its 31 fields do not exist on this doctype, so reading them
 * returned undefined and writing them wrote nowhere. The names below are the
 * live ones.
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
  // No drug/semen warehouse here: each Livestock Event Type owns its Default Store,
  // served per event by `items_by_event` (see src/frappe/eventItems.ts).
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

export const getLivestockSettings = async (): Promise<LivestockSettingsDoc> => {
  const client = await getClient();
  const res = await client.get(
    "/api/resource/Livestock Settings/Livestock Settings",
  );
  return (res.data?.data ?? {}) as LivestockSettingsDoc;
};
