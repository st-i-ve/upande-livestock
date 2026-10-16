
/**
 * What each event type may consume, and where it is held.
 *
 * The store is NOT a Livestock Settings field any more (`drug_warehouse` and
 * `semen_warehouse` are gone). Each Livestock Event Type carries its own rule —
 * Posts Stock Entry, Item Groups, Default Store — and the server resolves it
 * into `items_by_event`, which the web app's StockPicker reads from the same
 * options endpoints. One entry per item, with the quantity in every store that
 * holds any (`locations`, most-stocked first; `warehouse`/`qty` is the first).
 */
export type StockChoice = {
  value: string;
  label: string;
  item_name?: string;
  qty?: number;
  uom?: string;
  warehouse?: string;
  locations?: { warehouse: string; qty: number }[];
};

export type ItemsByEvent = Record<string, StockChoice[]>;

/** Quantity of the item in one store, or undefined when the store holds none. */
export const qtyAt = (choice: StockChoice | undefined, warehouse: string): number | undefined =>
  choice?.locations?.find((l) => l.warehouse === warehouse)?.qty;

export type IssueLine = {
  itemCode: string;
  warehouse: string;
  qtyNeeded: number;
  label?: string; // item name, for a friendlier message
};

/**
 * HEADS-UP ONLY. The phone records what happened on the ground; the server
 * decides what the store can bear. An event recorded today with the store short
 * is saved with its Stock Entry left as a draft (posted later from the web
 * Transactions page); a backdated short issue is refused by the server with an
 * error. So this never blocks a save — it only lets the operator see, before
 * and while submitting, that the store looked short.
 *
 * Over-issue check against the quantities the picker already showed. Returns a
 * message for the first short line, or null.
 */
export const findShortage = async (
  choices: StockChoice[] | undefined,
  lines: IssueLine[],
): Promise<string | null> => {
  const byCode = new Map((choices ?? []).map((c) => [c.value, c]));
  for (const l of lines) {
    if (!l.itemCode || !l.warehouse || l.qtyNeeded <= 0) continue;
    const choice = byCode.get(l.itemCode);
    if (!choice) continue;
    const have = qtyAt(choice, l.warehouse) ?? 0;
    if (l.qtyNeeded > have) {
      return `Not enough ${l.label || choice.item_name || l.itemCode} in ${l.warehouse}: need ${l.qtyNeeded}, only ${have} in stock.`;
    }
  }
  return null;
};

/** A stock issue the server saved as a draft because the store was short. */
export type StockDraft = { name: string; stock_entry_type: string; short: string };

/** The drafts a server reply carries (`stock_drafts`, see common/envelope.run). */
export const stockDraftsOf = (reply: any): StockDraft[] =>
  Array.isArray(reply?.stock_drafts) ? (reply.stock_drafts as StockDraft[]) : [];

/**
 * The server's outcome for the stock side of a submit, in words for the alert:
 * empty when everything posted, else which draft is waiting and why. Drafts
 * from several replies (one per cow) are merged by name.
 */
export const stockOutcomeText = (replies: any[]): string => {
  const byName = new Map<string, StockDraft>();
  for (const r of replies) for (const d of stockDraftsOf(r)) byName.set(d.name, d);
  if (!byName.size) return "";
  const lines = [...byName.values()].map((d) => `${d.stock_entry_type} ${d.name}: ${d.short}`);
  return `Saved with stock issue pending. The store was short, so the issue is a draft until it is posted from the web Transactions page.\n${lines.join("\n")}`;
};

/** What the server said aloud about stock (`stock_warnings`, see common/envelope.run),
 *  for example an item issued at zero because it has no cost. Merged and de-duplicated. */
export const stockWarningsOf = (replies: any[]): string[] => {
  const seen = new Set<string>();
  for (const r of replies) {
    if (Array.isArray(r?.stock_warnings)) for (const w of r.stock_warnings) seen.add(String(w));
  }
  return [...seen];
};
