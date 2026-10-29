import type { ClassKey, Counts, HeadClass, LedgerEntry } from "@/src/shoats/api";
import { CLASS_KEYS } from "@/src/shoats/api";

const toInt = (v: string): number => {
  const n = Math.floor(Number(String(v).replace(",", ".")));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Typed class figures (strings) to the counts the server takes: whole numbers, zero and blank dropped. */
export const cleanCounts = (typed: Record<string, string>): Counts =>
  Object.fromEntries(Object.entries(typed).map(([k, v]) => [k, toInt(v)] as const).filter(([, n]) => n > 0)) as Counts;

export const totalOf = (counts: Counts): number => Object.values(counts).reduce((a, n) => a + (n ?? 0), 0);

/** Head counted minus head on the ledger; positive means more on the ground than on the books. */
export const countVariance = (counted: number, ledgerHead: number): number => counted - ledgerHead;

/** "+3 more than the books" / "2 fewer than the books" / "matches the books". */
export const varianceText = (variance: number): string =>
  variance === 0 ? "matches the books" : variance > 0 ? `+${variance} more than the books` : `${-variance} fewer than the books`;

/** A removal (death, sale, slaughter, transfer out) cannot take more than a class holds. */
export const overdrawn = (counts: Counts, classes: HeadClass[]): HeadClass[] =>
  classes.filter((c) => (counts[c.key] ?? 0) > c.head);

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Mating start plus the gestation days (sheep and goats: 150 by default). */
export const expectedBirthFrom = (matingDate: string, gestationDays: number): string => addDays(matingDate, gestationDays);

/** Last day of the withdrawal period after a treatment. */
export const withdrawalEnd = (treatedOn: string, days: number): string => addDays(treatedOn, days);

/** Weight total of a sample is average times animals weighed; live weight is average times head. */
export const liveWeight = (averageKg: number, head: number): number => Math.round(averageKg * head);

export const kg = (n: number | null | undefined): string => (n == null ? "—" : `${Math.round(n * 10) / 10} kg`);

/** "62 ewes · 3 rams · 24 lambs": classes holding any head, as the herd list shows them. */
export const classSummary = (classes: HeadClass[]): string =>
  classes
    .filter((k) => k.head > 0)
    .map((k) => `${k.head} ${k.label.toLowerCase()}`)
    .join(" · ");

/** Head Count sends every class, zeros included: a zero is a count, not a blank. */
export const allCounts = (typed: Record<string, string>, classes: HeadClass[]): Counts =>
  Object.fromEntries(classes.map((k) => [k.key, Math.max(0, Math.floor(Number(typed[k.key] ?? 0)) || 0)] as const)) as Counts;

/** Counted figures start at what the books hold, so the herdsman changes only what differs. */
export const prefillFromLedger = (classes: HeadClass[]): Record<string, string> =>
  Object.fromEntries(classes.map((k) => [k.key, String(k.head)] as const));

const plural = (n: number, label: string) => `${n} ${label.toLowerCase()}`;

/** One readable line for a ledger entry: "12 lambs born alive, 1 born dead", "2 ewes died of Disease", "Counted 87 (2 fewer than the books)". */
export function ledgerSummary(e: LedgerEntry, labels: Record<ClassKey, string>): string {
  const parts = CLASS_KEYS.filter((k) => e.counts[k] > 0).map((k) => plural(e.counts[k], labels[k]));
  const list = parts.join(", ");
  const total = CLASS_KEYS.reduce((a, k) => a + e.counts[k], 0);
  switch (e.eventType) {
    case "Head Count": {
      const v = e.variance ? CLASS_KEYS.reduce((a, k) => a + (e.variance?.[k] ?? 0), 0) : 0;
      return `Counted ${total} (${varianceText(v)})`;
    }
    case "Birth":
      return `${plural(e.counts.young, labels.young)} born alive${e.bornDead ? `, ${e.bornDead} born dead` : ""}`;
    case "Death":
      return `${list} died${e.cause ? ` of ${e.cause}` : ""}`;
    case "Purchase":
      return `${list} bought${e.amount ? ` for ${e.amount}` : ""}`;
    case "Sale":
    case "Slaughter":
      return `${list} ${e.eventType === "Sale" ? "sold" : "slaughtered"}${e.amount ? ` for ${e.amount}` : ""}`;
    case "Transfer In":
      return `${list} in from ${e.otherHerd}`;
    case "Transfer Out":
      return `${list} out to ${e.otherHerd}${e.paddock ? ` (${e.paddock})` : ""}`;
    case "Weaning": {
      const moved = e.counts.females + e.counts.males + e.counts.others;
      return `${moved} weaned${e.otherHerd ? ` to ${e.otherHerd}` : ""}`;
    }
    case "Mating":
      return `${plural(e.counts.females, labels.females)} put to ${plural(e.counts.males, labels.males)}${e.expectedBirthDate ? `, due ${e.expectedBirthDate}` : ""}`;
    default:
      return list;
  }
}
