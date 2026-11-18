import { DEFAULT_FEED_TYPES, mapFeedTypes, type FeedTypes } from "@/src/beef/feedTypes";
import { storage } from "@/src/services/storage";

/**
 * The farm's feed types, kept on the phone (the last bootstrap answer) so the
 * feeding entries stay filtered offline.
 */
const KEY = "feed_types";

let current: FeedTypes = DEFAULT_FEED_TYPES;
let loaded: Promise<FeedTypes> | null = null;
let fromServer = false;

/** The server's fresh answer: kept in memory and on the phone. */
export const rememberFeedTypes = (ft: FeedTypes) => {
  current = ft;
  fromServer = true;
  storage.setItem(KEY, JSON.stringify(ft));
};

/** The kept answer, read from the phone once; the defaults until the server has said otherwise. */
export const loadFeedTypes = (): Promise<FeedTypes> => {
  if (!loaded) {
    loaded = storage
      .getItem(KEY)
      .then((raw) => {
        try {
          if (raw && !fromServer) current = mapFeedTypes(JSON.parse(raw));
        } catch {}
        return current;
      })
      .catch(() => current);
  }
  return loaded.then(() => current);
};

export const feedTypesNow = (): FeedTypes => current;
