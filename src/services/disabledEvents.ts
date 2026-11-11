import { mapDisabledEvents } from "@/src/beef/events";
import { storage } from "@/src/services/storage";

/**
 * The farm's switched-off event types, kept on the phone (the last bootstrap
 * answer) so menus stay filtered offline, and held in memory for code outside
 * React (the birth check).
 */
const KEY = "disabled_events";

let current: string[] = [];
let loaded: Promise<string[]> | null = null;
let fromServer = false;

/** The server's fresh answer: kept in memory and on the phone. */
export const rememberDisabledEvents = (list: string[]) => {
  current = list;
  fromServer = true;
  storage.setItem(KEY, JSON.stringify(list));
};

/** The kept list, read from the phone once; [] until the server has ever said otherwise. */
export const loadDisabledEvents = (): Promise<string[]> => {
  if (!loaded) {
    loaded = storage
      .getItem(KEY)
      .then((raw) => {
        try {
          if (raw && !fromServer) current = mapDisabledEvents(JSON.parse(raw));
        } catch {}
        return current;
      })
      .catch(() => current);
  }
  return loaded.then(() => current);
};

export const disabledEventsNow = (): string[] => current;
