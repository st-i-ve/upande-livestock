/**
 * The Manual feeding lines' pure logic: a line's unit and what it weighs, the
 * unit picker's options, changing a line's unit, what is sent to the server,
 * and the group's typed total on a farm not feeding by head count.
 * The unit rules are the web app's (components/feeding/ManualConfig.tsx).
 */
import {
  isDoseUom,
  kgTotal,
  qtyForKilos,
  rowKilos,
  suggestedTotal,
  unitFromUom,
  type BalanceRow,
} from "@/src/feed/rationMaths";
import { isKg, kgPerUnit, storeUnits, type UnitsMap } from "@/src/feed/units";

/** One manual line. `qty` is per head in `uom`; `unit`/`kgPer`/`pct`/`locked`
 *  are what the ration maths reads (`pct` and `locked` are screen state only). */
export type ManualLine = BalanceRow & {
  itemCode: string;
  itemName: string;
  /** The unit as the server names it: the recipe row's own ("Kg",
   *  "Kilogram", "Litre"), Gram/Millilitre for a dose, or the stock unit of a
   *  hand-added feed. */
  uom: string;
  isDose: boolean;
};

const round = (x: number, p: number) => Math.round(x * 10 ** p) / 10 ** p;
const num = (v: string | number | null | undefined) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};

/** A line built from a recipe row or a hand-added item. */
export function manualLine(l: { itemCode: string; itemName: string; qty: number | string; uom: string; isDose?: boolean }): ManualLine {
  const isDose = l.isDose ?? isDoseUom(l.uom);
  return {
    itemCode: l.itemCode,
    itemName: l.itemName,
    uom: l.uom,
    isDose,
    unit: unitFromUom(l.uom, isDose),
    qty: String(l.qty ?? ""),
    pct: "",
    locked: false,
  };
}

/** The lines with the kilos in one of each line's unit from the item's table. */
export function withKgPer(rows: ManualLine[], units: UnitsMap): ManualLine[] {
  return rows.map((r) => {
    const kgPer = r.unit === "kg" || isDoseUom(r.unit) ? null : kgPerUnit(units, r.itemCode, r.uom);
    return r.kgPer === kgPer ? r : { ...r, kgPer };
  });
}

/** "g/head", "ml/head", "kg/head", "Litre/head". */
export function perHeadLabel(r: { uom: string; unit?: string }): string {
  if (r.uom === "Gram") return "g/head";
  if (r.uom === "Millilitre") return "ml/head";
  if (isKg(r.uom) || r.unit === "kg" || !r.uom) return "kg/head";
  return `${r.uom}/head`;
}

/** "3 Litre ≈ 4.20 kg" for a line in a store unit that converts; "" otherwise. */
export function kgEquivalent(r: ManualLine): string {
  if (r.unit === "kg" || isDoseUom(r.unit) || !r.kgPer) return "";
  return `${num(r.qty)} ${r.uom} ≈ ${rowKilos(r).toFixed(2)} kg`;
}

/**
 * What a line may be written in: kilos (under the name the line or item
 * already uses, "Kg" on live, "Kilogram" elsewhere, so the server matches the
 * recipe's row), then the units the store counts the item in, then the line's
 * own unit. A dose stays in its own unit.
 */
export function unitOptions(units: UnitsMap, r: { itemCode: string; uom: string; isDose?: boolean }): string[] {
  if (r.isDose || isDoseUom(r.uom)) return [r.uom];
  const own = r.uom || "";
  const u = units[r.itemCode];
  const kgName = isKg(own) ? own : u?.uoms.find((o) => isKg(o.uom))?.uom || (isKg(u?.stock_uom) ? u!.stock_uom : "Kg");
  const out = [kgName, ...storeUnits(units, r.itemCode).map((o) => o.uom)];
  if (own && !out.includes(own)) out.push(own);
  return out;
}

/** The picker's words for a unit: "Litre (1 ≈ 1.40 kg)". */
export function unitOptionLabel(units: UnitsMap, itemCode: string, uom: string): string {
  if (isKg(uom)) return `${uom} (kilos)`;
  const per = kgPerUnit(units, itemCode, uom);
  return per ? `${uom} (1 ≈ ${per.toFixed(2)} kg)` : `${uom} (no kilo figure)`;
}

/** The line in another unit: its kilos stay and the quantity follows, when
 *  both units have a kilo figure; otherwise only the unit changes. */
export function changeUnit(units: UnitsMap, r: ManualLine, uom: string): ManualLine {
  const was = kgPerUnit(units, r.itemCode, r.uom);
  const now = kgPerUnit(units, r.itemCode, uom);
  const unit = unitFromUom(uom, false);
  const next: ManualLine = { ...r, uom, unit, kgPer: unit === "kg" ? null : now };
  if (was && now && r.qty !== "") next.qty = String(qtyForKilos(next, num(r.qty) * was));
  return next;
}

/** The lines as `record_feeding` "manual" takes them: per head, each with its unit. */
export function linesToSend(rows: ManualLine[]): { itemCode: string; qty: number; uom?: string }[] {
  return rows
    .map((r) => ({ itemCode: r.itemCode, qty: num(r.qty), ...(r.uom ? { uom: r.uom } : {}) }))
    .filter((l) => l.qty > 0);
}

/** Kilos a head of the weighed lines (doses left out). */
export const perHeadKilos = (rows: ManualLine[]) => kgTotal(rows);

/**
 * The group's total on a farm not feeding by head count: what the operator
 * typed, or the suggestion (head count x per head x portion) while nothing has
 * been typed. On a head-count farm nothing is sent.
 */
export function groupTotal(
  byHeadCount: boolean,
  typed: string | null,
  perHeadKg: number,
  heads: number,
  portion = 1,
): { suggestion: number; shown: string; send: number | undefined; error: string | null } {
  const suggestion = suggestedTotal(perHeadKg, heads, portion);
  if (byHeadCount) return { suggestion, shown: "", send: undefined, error: null };
  const shown = typed ?? (suggestion > 0 ? String(round(suggestion, 3)) : "");
  const value = num(shown);
  return {
    suggestion,
    shown,
    send: value > 0 ? value : undefined,
    error: value > 0 ? null : "Enter the kilos this group was given.",
  };
}
