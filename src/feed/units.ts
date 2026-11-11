/**
 * The units a feed line may be written in, and what one of each weighs.
 * The pure part is ported from the web app (frontend/src/lib/units.ts); the
 * figures are the server's (`feeding/_units.py`, through `feed_units` and
 * `herd_rations.units`): kilos per unit read off the item's own conversion
 * table, never guessed. "Kg" and "Kilogram" are both the kilogram (`isKg`).
 */
import { getClient } from "@/src/services/api";

export type UnitOption = {
  uom: string;
  /** Stock units per one of this unit. */
  factor: number | null;
  /** Kilograms in one of this unit, or null where nothing says. */
  kg: number | null;
};
export type ItemUnits = { stock_uom: string; uoms: UnitOption[] };
export type UnitsMap = Record<string, ItemUnits>;

const KG_NAMES = ["kg", "kilogram", "kgs", "kilograms"];
const DOSES = ["Gram", "Millilitre"];

/** Is this unit the kilogram, whatever the site calls it ("Kg", "Kilogram")? */
export function isKg(uom: string | null | undefined): boolean {
  return KG_NAMES.includes((uom || "").trim().toLowerCase());
}

/** SI mass units that need no table. */
const SI_KG: Record<string, number> = { gram: 0.001, g: 0.001, tonne: 1000, milligram: 0.000001 };

/** Kilograms in one `uom` of `item`, or null where nothing says. A per-head
 *  dose (g, ml) is not weighed and answers null. */
export function kgPerUnit(units: UnitsMap, item: string, uom: string | null | undefined): number | null {
  if (!uom || isKg(uom)) return 1;
  if (DOSES.includes(uom)) return null;
  const opt = units[item]?.uoms.find((o) => o.uom === uom);
  if (opt?.kg) return opt.kg;
  const si = SI_KG[uom.trim().toLowerCase()];
  return si ?? null;
}

/** The units other than kilos a line of `item` may be written in: its stock
 *  unit and its conversion table, kilogram rows and doses left out. */
export function storeUnits(units: UnitsMap, item: string): UnitOption[] {
  return (units[item]?.uoms ?? []).filter((o) => !isKg(o.uom) && !DOSES.includes(o.uom));
}

/** What a stock unit is per kilo, for "≈ 0.07 bale" beside a kilo line. */
export function stockEquivalent(
  units: UnitsMap,
  item: string,
  kilos: number,
): { qty: number; uom: string } | null {
  const u = units[item];
  if (!u || !u.stock_uom || isKg(u.stock_uom)) return null;
  const per = kgPerUnit(units, item, u.stock_uom);
  if (!per) return null;
  return { qty: Math.round((kilos / per) * 1000) / 1000, uom: u.stock_uom };
}

const FEED_UNITS = "upande_livestock.serverscripts.feeding.feed_units.feed_units";

/** {item_code: {stock_uom, uoms}} for each item; items the server does not
 *  answer for come back unitless, so they are not asked for again. */
export async function getFeedUnits(items: string[]): Promise<UnitsMap> {
  const want = [...new Set(items.filter(Boolean))].sort();
  if (!want.length) return {};
  const client = await getClient();
  const res = await client.post(`/api/method/${FEED_UNITS}`, { items: JSON.stringify(want) });
  const m = res.data?.message ?? {};
  if (m.error) throw new Error(m.error);
  const got: UnitsMap = {};
  for (const [code, u] of Object.entries<any>(m.units ?? {})) {
    got[code] = {
      stock_uom: u?.stock_uom ?? "",
      uoms: (u?.uoms ?? []).map((o: any) => ({
        uom: String(o.uom),
        factor: o.factor == null ? null : Number(o.factor),
        kg: o.kg == null ? null : Number(o.kg),
      })),
    };
  }
  for (const c of want) if (!got[c]) got[c] = { stock_uom: "", uoms: [] };
  return got;
}
