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

const API = "/api/method/upande_livestock.serverscripts.breeding";

export type StrawItem = { value: string; itemName: string; label: string };
const item = (r: any): StrawItem => ({ value: String(r.value), itemName: String(r.item_name || r.value), label: String(r.label || r.item_name || r.value) });

/** The straw Items a sire can have, and the one his name or code points at. Online only. */
export const getSireItems = async (sireName: string, code: string, current = ""): Promise<{ items: StrawItem[]; suggested: StrawItem | null; breeds: string[]; supplier: string | null }> => {
  const client = await getClient();
  const m = (await client.post(`${API}.sire_items.sire_items`, { payload: { sire_name: sireName, sire_code: code, current } })).data?.message;
  if (!m || m.error) throw new Error(m?.error || "no items");
  return { items: (m.items ?? []).map(item), suggested: m.suggested ? item(m.suggested) : null, breeds: (m.breeds ?? []).map(String), supplier: m.supplier ? String(m.supplier) : null };
};

/** Make the sire's straw Item (Livestock Manager). Returns its code. */
export const createSireItem = async (sireName: string, code: string): Promise<string> => {
  const client = await getClient();
  const m = (await client.post(`${API}.create_sire_item.create_sire_item`, { payload: { sire_name: sireName, sire_code: code } })).data?.message;
  if (!m || m.error) throw new Error(m?.error || "could not create the item");
  return String(m.item);
};

/** Add a sire; returns the new record's name. */
export const saveSire = async (f: { sireName: string; code: string; type: string; sexed: boolean; breed: string; semenItem: string; animal: string }): Promise<string> => {
  const client = await getClient();
  const payload = { sire_name: f.sireName, sire_code: f.code, sire_type: f.type, sexed: f.sexed ? 1 : 0, breed: f.breed, semen_item: f.semenItem, animal: f.animal, active: 1 };
  const m = (await client.post(`${API}.save_sire.save_sire`, { payload })).data?.message;
  if (!m || m.error) throw new Error(m?.error || "could not save the sire");
  return String(m.name);
};
