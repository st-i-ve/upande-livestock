import { getClient } from "@/src/services/api";
import { STORAGE_KEYS, storage } from "@/src/services/storage";

import { parseSires, type Sire } from "./sireList";

const METHOD = "/api/method/upande_livestock.serverscripts.breeding.sire_options.sire_options";

/** The last answer, from this phone's storage ([] when there never was one). */
export const cachedSires = async (): Promise<Sire[]> => {
  try {
    const raw = await storage.getItem(STORAGE_KEYS.SIRES);
    return raw ? parseSires(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
};

/**
 * Active sires from the server, remembered for offline. Offline (or a failed
 * call): the last answer; with none ever saved, an empty list, which the picker
 * answers with its "Sire not listed" free text.
 */
export const getSires = async (): Promise<Sire[]> => {
  try {
    const client = await getClient();
    const res = await client.post(METHOD, {});
    const msg = res.data?.message;
    if (!msg || msg.error || !Array.isArray(msg.sires)) throw new Error(msg?.error || "no sires");
    await storage.setItem(STORAGE_KEYS.SIRES, JSON.stringify(msg.sires));
    return parseSires(msg.sires);
  } catch {
    return cachedSires();
  }
};
