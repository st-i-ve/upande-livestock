import { getClient } from "@/src/services/api";
import { findStoreShortage, type IssueLine } from "@/src/frappe/stock";

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

// Any of the *_options endpoints returns the full map; health's is the lightest
// that is always installed.
const OPTIONS =
  "/api/method/upande_livestock.serverscripts.health.health_options.health_options";

export const getItemsByEvent = async (): Promise<ItemsByEvent> => {
  const client = await getClient();
  const res = await client.post(OPTIONS, {});
  const msg = res.data?.message;
  if (!msg || msg.error) throw new Error(msg?.error || "Could not load store items.");
  return (msg.items_by_event ?? {}) as ItemsByEvent;
};

/** Quantity of the item in one store, or undefined when the store holds none. */
export const qtyAt = (choice: StockChoice | undefined, warehouse: string): number | undefined =>
  choice?.locations?.find((l) => l.warehouse === warehouse)?.qty;

/**
 * HEADS-UP ONLY. The phone records what happened on the ground; the server
 * decides what the store can bear. An event recorded today with the store short
 * is saved with its Stock Entry left as a draft (posted later from the web
 * Transactions page); a backdated short issue is refused by the server with an
 * error. So this never blocks a save — it only lets the operator see, before
 * and while submitting, that the store looked short.
 *
 * Over-issue check against the quantities the picker already showed; lines the
 * picker knows nothing about (free-picked items) fall back to a live Bin read.
 * Returns a message for the first short line, or null.
 */
export const findShortage = async (
  choices: StockChoice[] | undefined,
  lines: IssueLine[],
): Promise<string | null> => {
  const byCode = new Map((choices ?? []).map((c) => [c.value, c]));
  const unknown: IssueLine[] = [];
  for (const l of lines) {
    if (!l.itemCode || !l.warehouse || l.qtyNeeded <= 0) continue;
    const choice = byCode.get(l.itemCode);
    if (!choice) {
      unknown.push(l);
      continue;
    }
    const have = qtyAt(choice, l.warehouse) ?? 0;
    if (l.qtyNeeded > have) {
      return `Not enough ${l.label || choice.item_name || l.itemCode} in ${l.warehouse}: need ${l.qtyNeeded}, only ${have} in stock.`;
    }
  }
  return unknown.length ? findStoreShortage(unknown) : null;
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
