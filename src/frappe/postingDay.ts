import { getClient, todayISO } from "@/src/services/api";
import { STORAGE_KEYS, storage } from "@/src/services/storage";

/**
 * Today as the server counts it, and whether Livestock Settings has Backdating
 * Open ticked (`custom_backdating_open`, ticked by a manager). The server
 * enforces it on every write; the phone only uses it to decide what to show.
 */
export type PostingDay = { today: string; backdatingOpen: boolean };

const METHOD = "/api/method/upande_livestock.serverscripts.settings.posting_day.posting_day";

/** Fresh from the server, remembered for offline. Offline: the last known answer,
 *  or closed with the device's date when there never was one. */
export const getPostingDay = async (): Promise<PostingDay> => {
  try {
    const client = await getClient();
    const res = await client.get(METHOD);
    const m = res.data?.message;
    if (!m || m.error || !m.today) throw new Error("posting_day gave no answer");
    const day: PostingDay = { today: String(m.today), backdatingOpen: !!m.backdating_open };
    await storage.setItem(STORAGE_KEYS.POSTING_DAY, JSON.stringify(day));
    return day;
  } catch {
    try {
      const raw = await storage.getItem(STORAGE_KEYS.POSTING_DAY);
      const last = raw ? JSON.parse(raw) : null;
      // The remembered "today" is stale; only the open/closed answer is reused.
      if (last && typeof last.backdatingOpen === "boolean") {
        return { today: todayISO(), backdatingOpen: last.backdatingOpen };
      }
    } catch {
      // fall through to closed
    }
    return { today: todayISO(), backdatingOpen: false };
  }
};
