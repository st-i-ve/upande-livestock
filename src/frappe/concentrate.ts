import { getClient } from "@/src/services/api";

/**
 * The week's concentrate mixing list.
 *
 * The farm mixes concentrate weekly and feeds the TMR twice a day out of the
 * store, so the question at the mixer is not what one herd needs today but what
 * to put through to reach next week. That is one number per concentrate, summed
 * over every herd that eats it — read off the herds by the server, never typed
 * in here. The last time it was carried by hand a herd was asking for
 * forty-five tonnes a day.
 */
const PLAN = "upande_livestock.serverscripts.mobile.get_concentrate_plan.get_concentrate_plan";

export type ConcentrateShort = {
  itemCode: string;
  itemName: string;
  requiredQty: number;
  available: number;
  shortQty: number;
};

export type ConcentrateRow = {
  itemCode: string;
  itemName: string;
  perDayKg: number;
  neededKg: number;
  onHandKg: number;
  toMixKg: number;
  batches: number;
  /** Days of cover at the current rate, or null when nothing eats it. */
  daysCover: number | null;
  /** False when the raw materials are not in the store. A plan that says "mix
   *  6.3 tonnes" while there is no canola looks like a decision has been made. */
  canMix: boolean;
  short: ConcentrateShort[];
  herds: { herd: string; heads: number; perHeadKg: number }[];
};

export type ConcentratePlan = {
  days: number;
  batchKg: number;
  concentrates: ConcentrateRow[];
  totalToMixKg: number;
  totalBatches: number;
};

export const getConcentratePlan = async (days = 7): Promise<ConcentratePlan> => {
  const client = await getClient();
  const res = await client.post(`/api/method/${PLAN}`, { days });
  const m = res.data?.message ?? {};
  if (m.error) throw new Error(m.error);
  return {
    days: Number(m.days ?? days),
    batchKg: Number(m.batch_kg ?? 1000),
    totalToMixKg: Number(m.total_to_mix_kg ?? 0),
    totalBatches: Number(m.total_batches ?? 0),
    concentrates: (m.concentrates ?? []).map((c: any) => ({
      itemCode: c.item_code,
      itemName: c.item_name,
      perDayKg: Number(c.per_day_kg ?? 0),
      neededKg: Number(c.needed_kg ?? 0),
      onHandKg: Number(c.on_hand_kg ?? 0),
      toMixKg: Number(c.to_mix_kg ?? 0),
      batches: Number(c.batches ?? 0),
      daysCover: c.days_cover == null ? null : Number(c.days_cover),
      canMix: !!c.can_mix,
      short: (c.short ?? []).map((s: any) => ({
        itemCode: s.item_code,
        itemName: s.item_name,
        requiredQty: Number(s.required_qty ?? 0),
        available: Number(s.available ?? 0),
        shortQty: Number(s.short_qty ?? 0),
      })),
      herds: (c.herds ?? []).map((h: any) => ({
        herd: h.herd,
        heads: Number(h.heads ?? 0),
        perHeadKg: Number(h.per_head_kg ?? 0),
      })),
    })),
  };
};
