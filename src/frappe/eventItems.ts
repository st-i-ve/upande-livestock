
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
  /** False for an item of the event's groups that no store holds. Still
   *  pickable: the record is saved and its stock issue waits as a draft. */
  in_stock?: boolean;
};

/** Is this choice held in no store? (An older server sent only held items.) */
export const outOfStock = (choice: StockChoice | undefined): boolean =>
  !!choice && (choice.in_stock === false || !(choice.locations?.length ?? 0));

const nameOf = (c: StockChoice): string => c.item_name || c.label || c.value;

const fmtQty = (n: number): string => String(Math.round(n * 1000) / 1000);

/** What the picker says under an item: "none in store — saved as a draft", or
 *  "12 ml in Main Store (+1 more)". */
export const choiceMeta = (c: StockChoice): string => {
  if (outOfStock(c)) return "none in store — saved as a draft";
  const more = (c.locations?.length ?? 0) > 1 ? ` (+${c.locations!.length - 1} more)` : "";
  return `${fmtQty(c.qty ?? 0)} ${c.uom ?? ""} in ${c.warehouse}${more}`.replace(/ {2,}/g, " ");
};

/** The picker row as one line: "Oxytet · none in store — saved as a draft". */
export const choiceLabel = (c: StockChoice): string => `${nameOf(c)} · ${choiceMeta(c)}`;

/** In-stock items first, out-of-stock after them; each group keeps the server's order. */
export const sortChoices = (choices: StockChoice[]): StockChoice[] => [
  ...choices.filter((c) => !outOfStock(c)),
  ...choices.filter((c) => outOfStock(c)),
];

export type ItemsByEvent = Record<string, StockChoice[]>;

/** Quantity of the item in one store, or undefined when the store holds none. */
export const qtyAt = (choice: StockChoice | undefined, warehouse: string): number | undefined =>
  choice?.locations?.find((l) => l.warehouse === warehouse)?.qty;

/**
 * HEADS-UP ONLY. The phone records what happened on the ground; the server
 * decides what the store can bear. A record the store cannot cover is still
 * saved; its stock issue waits as a draft on Transactions until the stock is in
 * (a storekeeper posts it). So this never blocks a save: it only lets the
 * operator see, before saving, that the store will not cover the line.
 */
export const coverNotice = (itemName: string): string =>
  `The store can't cover ${itemName}. The record is still saved; the stock issue waits as a draft on Transactions until the stock is in.`;

/**
 * The notice for one line against the quantities the picker already showed: the
 * item is one the stores hold none of, or the quantity is above what the chosen
 * store holds. Null when the store covers it (or nothing is picked yet).
 */
export const lineNotice = (
  choices: StockChoice[] | undefined,
  line: { itemCode: string; warehouse?: string; qtyNeeded?: number; label?: string },
): string | null => {
  if (!line.itemCode) return null;
  const choice = (choices ?? []).find((c) => c.value === line.itemCode);
  if (!choice) return null;
  const name = line.label || nameOf(choice);
  if (outOfStock(choice)) return coverNotice(name);
  const need = line.qtyNeeded ?? 0;
  if (need <= 0 || !line.warehouse) return null;
  return need > (qtyAt(choice, line.warehouse) ?? 0) ? coverNotice(name) : null;
};

export type IssueLine = {
  itemCode: string;
  warehouse: string;
  qtyNeeded: number;
  label?: string; // item name, for a friendlier message
};

/** The first line's notice, or null. */
export const findShortage = (choices: StockChoice[] | undefined, lines: IssueLine[]): string | null => {
  for (const l of lines) {
    const n = lineNotice(choices, l);
    if (n) return n;
  }
  return null;
};

/** A stock issue the server saved as a draft because the store was short.
 *  `items` may name the lines when the server sends them. */
export type StockDraft = {
  name: string;
  stock_entry_type: string;
  short: string;
  items?: unknown;
};

/** The drafts a server reply carries (`stock_drafts`, see common/envelope.run). */
export const stockDraftsOf = (reply: any): StockDraft[] =>
  Array.isArray(reply?.stock_drafts) ? (reply.stock_drafts as StockDraft[]) : [];

/** Every draft across several replies (one per cow, say), merged by name. */
export const stockDraftsIn = (replies: any[]): StockDraft[] => {
  const byName = new Map<string, StockDraft>();
  for (const r of replies) for (const d of stockDraftsOf(r)) byName.set(d.name, d);
  return [...byName.values()];
};

/**
 * The server's outcome for the stock side of a save, in words for the
 * confirmation: empty when everything posted, else each draft by name and why
 * it is waiting, and who posts it.
 */
export const stockOutcomeText = (replies: any[]): string => {
  const drafts = stockDraftsIn(replies);
  if (!drafts.length) return "";
  const lines = drafts.map((d) => `${d.stock_entry_type} ${d.name}${d.short ? `: ${d.short}` : ""}`);
  return (
    `Saved. The store could not cover it, so ${drafts.length === 1 ? "this stock issue is" : "these stock issues are"} a draft. ` +
    `A storekeeper will post ${drafts.length === 1 ? "it" : "them"} from Transactions once the stock is in.\n${lines.join("\n")}`
  );
};

/** The title for a save's confirmation: says so when a stock issue is a draft. */
export const savedTitle = (base: string, replies: any[], done = "recorded"): string =>
  stockDraftsIn(replies).length ? `${base} saved: stock issue is a draft` : `${base} ${done}`;

/** What the server said aloud about stock (`stock_warnings`, see common/envelope.run),
 *  for example an item issued at zero because it has no cost. Merged and de-duplicated. */
export const stockWarningsOf = (replies: any[]): string[] => {
  const seen = new Set<string>();
  for (const r of replies) {
    if (Array.isArray(r?.stock_warnings)) for (const w of r.stock_warnings) seen.add(String(w));
  }
  return [...seen];
};
