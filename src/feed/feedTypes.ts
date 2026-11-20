/**
 * Which ways of feeding the farm shows on the phone (Livestock Settings,
 * Feeding, Feed types; the bootstrap bundle's `feed_types`). Pure, so it is
 * tested without a phone. Off on the phone means hidden here, not refused:
 * the server refuses a mode only when it is off on the desk too.
 *
 *   system     the automatic run from the recipe (Animal feeding, System)
 *   manual     Manual configuration (Animal feeding, Manual configuration)
 *   day_sheet  the Feeding day sheet and the Daily feed report
 *
 * A server that does not send the setting means today's screens: System and
 * Manual on, the day sheet off (a server without the day sheet endpoints must
 * not show screens that would fail). Once the server sends it, every flag it
 * sends is obeyed; a flag it leaves out keeps that default.
 */
export type FeedTypes = { system: boolean; manual: boolean; day_sheet: boolean };

export const DEFAULT_FEED_TYPES: FeedTypes = { system: true, manual: true, day_sheet: false };

export const mapFeedTypes = (raw: unknown): FeedTypes => {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const flag = (v: unknown, fallback: boolean) => (v == null || v === "" ? fallback : v === true || Number(v) === 1);
  return {
    system: flag(m.system, DEFAULT_FEED_TYPES.system),
    manual: flag(m.manual, DEFAULT_FEED_TYPES.manual),
    day_sheet: flag(m.day_sheet, DEFAULT_FEED_TYPES.day_sheet),
  };
};

/** The feeding screens: route slug -> the modes any of which makes it worth opening. */
const MODES_FOR_ROUTE: Record<string, (keyof FeedTypes)[]> = {
  // Animal feeding holds the System and Manual configuration tabs.
  "feeding": ["system", "manual", "day_sheet"],
  "animal-feed": ["system", "manual"],
  "feed-day": ["day_sheet"],
  "feed-report": ["day_sheet"],
};

/** True when the entry at this href / route is offered under the feed types. */
export const isFeedRouteOn = (hrefOrRoute: string, feed: FeedTypes | null | undefined): boolean => {
  const leaf = hrefOrRoute.split("?")[0].replace(/\/$/, "").split("/").pop() ?? "";
  const modes = MODES_FOR_ROUTE[leaf];
  if (!modes) return true;
  const f = feed ?? DEFAULT_FEED_TYPES;
  return modes.some((m) => f[m]);
};

/** The Record menu without the feeding entries the feed types switched off. */
export const visibleFeedSections = <S extends { items: { href: string }[] }>(
  sections: readonly S[],
  feed: FeedTypes | null | undefined,
): S[] =>
  sections
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => isFeedRouteOn(it.href, feed)) }))
    .filter((sec) => sec.items.length > 0);

/** The tabs of Animal feeding that are on. */
export const feedingTabs = (feed: FeedTypes | null | undefined): ("system" | "manual")[] => {
  const f = feed ?? DEFAULT_FEED_TYPES;
  return [...(f.system ? (["system"] as const) : []), ...(f.manual ? (["manual"] as const) : [])];
};
