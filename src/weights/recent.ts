/**
 * The recently-weighed guard on Record → Weight. An animal weighed less than
 * RECENT_DAYS before the day being recorded is worth a second look: the
 * operator may have picked her by mistake. It is a warning only; the farm may
 * weigh twice on purpose and the server refuses nothing.
 */
export const RECENT_DAYS = 7;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Whole days from ISO date `a` to ISO date `b` (b - a), by calendar day. */
export function daysBetween(a: string, b: string): number | null {
  const pa = parse(a);
  const pb = parse(b);
  if (pa === null || pb === null) return null;
  return Math.round((pb - pa) / 86_400_000);
}

function parse(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export type RecentWeighing = { id: string; label: string; date: string; kg: number; daysAgo: number };

/**
 * Days since she was last weighed, when that is less than RECENT_DAYS either
 * side of `onDay` (the day being recorded: today, or the backdated day).
 * Weighed exactly a week ago is a normal weekly round and is not flagged.
 */
export function recentlyWeighed(lastDate: string | null | undefined, onDay: string): number | null {
  if (!lastDate) return null;
  const d = daysBetween(lastDate, onDay);
  if (d === null || Math.abs(d) >= RECENT_DAYS) return null;
  return d;
}

/** "Mon 8 Nov" */
export function shortDay(iso: string): string {
  const t = parse(iso);
  if (t === null) return iso;
  const d = new Date(t);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function agoPhrase(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days > 1) return `${days} days ago`;
  return days === -1 ? "the day after" : `${-days} days after`;
}

const kgText = (n: number) => `${Math.round(n * 10) / 10} kg`;

/** One line per animal: "LE151 was weighed 3 days ago (Mon 8 Nov, 309 kg)." */
export function recentLine(r: RecentWeighing): string {
  const ago = agoPhrase(r.daysAgo);
  const when = r.daysAgo < 0 ? `${ago} this date` : ago;
  return `${r.label} was weighed ${when} (${shortDay(r.date)}${r.kg > 0 ? `, ${kgText(r.kg)}` : ""}).`;
}

/** The warning shown when the pick (or the save) includes recently weighed animals. */
export function recentMessage(list: RecentWeighing[]): string {
  if (list.length === 0) return "";
  if (list.length === 1) return `${recentLine(list[0])} You can skip this animal or weigh it again.`;
  return `${list.map(recentLine).join("\n")}\nYou can skip these ${list.length} animals or weigh them again.`;
}

/**
 * The animals in `list` that were weighed recently, relative to `onDay`,
 * labelled by the name the farm calls her (LE151), not her long RFID tag.
 */
export function findRecent<T extends { id: string; name?: string; lastWt: number; lastWtDate?: string | null }>(
  list: T[],
  onDay: string,
): RecentWeighing[] {
  const out: RecentWeighing[] = [];
  for (const a of list) {
    const days = recentlyWeighed(a.lastWtDate, onDay);
    if (days !== null) out.push({ id: a.id, label: a.name || a.id, date: a.lastWtDate!, kg: a.lastWt, daysAgo: days });
  }
  return out;
}
