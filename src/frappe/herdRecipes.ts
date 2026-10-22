import { getClient } from "@/src/services/api";

/**
 * A herd's recipe picker: the standing ration (from `Herds.bom`) plus every
 * tuned BOM ever mixed for this herd. Backed by the read-only whitelisted
 * method `herd_recipes` — a plain single-purpose endpoint, not one of the
 * multiplexed `record_feeding` actions, so it is called directly rather than
 * through `feeding.ts`'s `callMethod`.
 */
const HERD_RECIPES =
  "upande_livestock.serverscripts.feeding.herd_recipes.herd_recipes";

export type HerdRecipeLine = {
  itemCode: string;
  itemName: string;
  /** Per-head amount in the RECIPE's own unit of measure — `BOM Item.qty`,
   *  never `stock_qty`. Hay reads 2.0 Kilogram here, not the 0.14 BALE it is
   *  stocked in at a 0.07 conversion factor. Pass this straight through to
   *  the manual-feed rows and to the server; never scale or convert it on
   *  the phone — see the identical warning on `ManualFeedLine.qty`. */
  qty: number;
  uom: string;
};

export type HerdRecipe = {
  bomNo: string;
  itemCode: string;
  itemName: string;
  kind: string; // "Standing" | "Tuned"
  isStanding: boolean;
  /** Creation timestamp of the BOM, as Frappe stores it (naive datetime
   *  string) — only used to tell two tunes of the same ration apart in the
   *  picker, never parsed for anything that matters. */
  created: string;
  perHeadQty: number;
  uom: string;
  lines: HerdRecipeLine[];
};

export type HerdRecipes = {
  herd: string;
  /** The herd's registered ration — `Herds.bom`. Always first in `recipes`
   *  and always the picker's default. */
  standingBom: string;
  recipes: HerdRecipe[];
};

export const getHerdRecipes = async (herd: string): Promise<HerdRecipes> => {
  const client = await getClient();
  const res = await client.post(`/api/method/${HERD_RECIPES}`, { herd });
  const m = res.data?.message ?? {};
  if (m.error) throw new Error(m.error);
  return {
    herd: m.herd,
    standingBom: m.standing_bom,
    recipes: (m.recipes ?? []).map((r: any) => ({
      bomNo: r.bom_no,
      itemCode: r.item_code,
      itemName: r.item_name,
      kind: r.kind,
      isStanding: !!r.is_standing,
      created: r.created,
      perHeadQty: Number(r.per_head_qty ?? 0),
      uom: r.uom ?? "",
      lines: (r.lines ?? []).map((l: any) => ({
        itemCode: l.item_code,
        itemName: l.item_name,
        qty: Number(l.qty ?? 0),
        uom: l.uom ?? "",
      })),
    })),
  };
};
