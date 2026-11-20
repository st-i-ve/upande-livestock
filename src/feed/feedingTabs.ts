import { routeAllowed, type Can } from "../auth/can.ts";
import { DEFAULT_FEED_TYPES, type FeedTypes } from "./feedTypes.ts";

/** The Feeding screen's tabs, in the desk's order with the desk's labels. */
export type FeedingTab = "system" | "manual" | "day_sheet";

export const FEEDING_TABS: { key: FeedingTab; label: string }[] = [
  { key: "system", label: "System" },
  { key: "manual", label: "Manual configuration" },
  { key: "day_sheet", label: "Day sheet" },
];

/** The phone's old route slug each tab used to live at: what the user's rights are checked against. */
const ROUTE_FOR_TAB: Record<FeedingTab, string> = {
  system: "animal-feed",
  manual: "animal-feed",
  day_sheet: "feed-day",
};

/** The tabs the farm has switched on (Feed types) and the user's role may use; the rest are hidden. */
export const feedingScreenTabs = (feed: FeedTypes | null | undefined, can: Can): FeedingTab[] => {
  const f = feed ?? DEFAULT_FEED_TYPES;
  return FEEDING_TABS.filter((t) => f[t.key] && routeAllowed(ROUTE_FOR_TAB[t.key], can)).map((t) => t.key);
};

export const isFeedingTab = (v: unknown): v is FeedingTab => FEEDING_TABS.some((t) => t.key === v);

/** The tab to open: the one asked for, else the last one used, else the first; always one that is shown. */
export const pickFeedingTab = (shown: readonly FeedingTab[], asked?: unknown, remembered?: unknown): FeedingTab | null =>
  [asked, remembered].find((t): t is FeedingTab => isFeedingTab(t) && shown.includes(t)) ?? shown[0] ?? null;
