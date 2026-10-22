import type { Herd } from "@/types";
import { getClient } from "@/src/services/api";

/**
 * Every herd, as the server describes it.
 *
 * This used to read /api/resource/Herds with `custom_herd_category`,
 * `custom_is_milking`, `custom_is_dry` and `custom_cost_center`. None of them
 * exist on the Herds doctype any more — which herds are milking or dry is
 * answered by Livestock Settings, and a category is worked out from that — so
 * the whole list failed with "Field not permitted in query". The bootstrap
 * bundle returns each herd already classified, in one call, so the phone does
 * not decide what a milking herd is.
 */
const BOOTSTRAP =
  "/api/method/upande_livestock.serverscripts.mobile.get_bootstrap_bundle.get_bootstrap_bundle";

export const mapHerd = (row: Record<string, any>): Herd => ({
  n: row.name,
  herdName: row.label || row.name,
  cat: row.category ?? "",
  cnt: Number(row.heads ?? 0),
  hasBom: !!row.has_bom,
  isMilking: !!row.is_milking,
  isDry: !!row.is_dry,
  isCalfRearing: !!row.is_calf_rearing,
  isHeifer: !!row.is_heifer,
});

export const getHerds = async (): Promise<Herd[]> => {
  const client = await getClient();
  const res = await client.post(BOOTSTRAP, {});
  const msg = res.data?.message;
  if (!msg || msg.error) throw new Error(msg?.error || "Could not load herds.");
  return ((msg.herds ?? []) as any[]).map(mapHerd);
};
