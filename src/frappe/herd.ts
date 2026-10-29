import type { Herd } from "@/types";
import { getClient } from "@/src/services/api";

/**
 * Every herd, as the server describes it.
 *
 * The bootstrap bundle returns each herd already classified (herd class, breeding
 * flag, females / bulls counts) in one call, so the phone does not decide what a
 * breeding herd is.
 */
const BOOTSTRAP =
  "/api/method/upande_livestock.serverscripts.mobile.get_bootstrap_bundle.get_bootstrap_bundle";

export const mapHerd = (row: Record<string, any>): Herd => ({
  n: row.name,
  herdName: row.label || row.name,
  cat: row.category ?? "",
  cnt: Number(row.heads ?? 0),
  hasBom: !!row.has_bom,
  herdClass: row.herd_class ?? "",
  isBreeding: !!row.is_breeding,
  females: row.females == null ? undefined : Number(row.females),
  bulls: row.bulls == null ? undefined : Number(row.bulls),
  fedHeads: row.fed_heads == null ? null : Number(row.fed_heads),
  isCalfRearing: !!row.is_calf_rearing,
  isHeifer: !!row.is_heifer,
  isCalf: !!row.is_calf,
  isInCalf: !!row.is_in_calf,
});

/** The beef settings the phone needs, from the bootstrap bundle's `settings`. */
export type BeefSettings = {
  calfSeparationAgeDays: number;
  defaultServiceType: "Natural" | "A.I.";
  breedingBullMinAgeMonths: number;
  conceptionWindowDays: number;
  kinshipCheck: boolean;
};

export const DEFAULT_BEEF_SETTINGS: BeefSettings = {
  calfSeparationAgeDays: 210,
  defaultServiceType: "Natural",
  breedingBullMinAgeMonths: 18,
  conceptionWindowDays: 10,
  kinshipCheck: true,
};

export const mapBeefSettings = (m: Record<string, any> | undefined): BeefSettings => {
  const d = DEFAULT_BEEF_SETTINGS;
  const num = (v: any, fallback: number) => (v == null || v === "" || Number.isNaN(Number(v)) ? fallback : Number(v));
  return {
    calfSeparationAgeDays: num(m?.calf_separation_age_days, d.calfSeparationAgeDays),
    defaultServiceType: m?.default_service_type === "A.I." ? "A.I." : "Natural",
    breedingBullMinAgeMonths: num(m?.breeding_bull_min_age_months, d.breedingBullMinAgeMonths),
    conceptionWindowDays: num(m?.conception_window_days, d.conceptionWindowDays),
    kinshipCheck: m?.kinship_check == null ? d.kinshipCheck : !!Number(m.kinship_check),
  };
};

export type Bootstrap = { herds: Herd[]; settings: BeefSettings };

export const getBootstrap = async (): Promise<Bootstrap> => {
  const client = await getClient();
  const res = await client.post(BOOTSTRAP, {});
  const msg = res.data?.message;
  if (!msg || msg.error) throw new Error(msg?.error || "Could not load herds.");
  return {
    herds: ((msg.herds ?? []) as any[]).map(mapHerd),
    settings: mapBeefSettings(msg.settings),
  };
};

export const getHerds = async (): Promise<Herd[]> => (await getBootstrap()).herds;
