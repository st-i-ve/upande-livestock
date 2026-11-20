import AsyncStorage from "@react-native-async-storage/async-storage";
import { getConfig, type KitApi } from "@upande/mobile-kit";
import { create } from "zustand";

import { getClient } from "@/src/services/api";

/**
 * The link to Upande Mobile (the `upande_mobile` Frappe app, the kit's
 * server side: device register, crash and API reports, Report a problem,
 * support chat and its push) is held off until the site the phone is signed
 * in to has that app. Until then the kit's calls to it are refused here,
 * before they leave the phone, and its monitoring, support and push stay off,
 * so a site without it (Mutara live, today) never sees a failing call. Once
 * upande_mobile is installed there, the next sign-in or launch finds it
 * (checkKitServer) and the kit is used in full, with no new release.
 */
export const KIT_SERVER_APP = "upande_mobile";
const KEY = "kit.server.ready";

type KitServer = { ready: boolean; site: string | null };

export const useKitServer = create<KitServer>(() => ({ ready: false, site: null }));

/** Is this a call to the Upande Mobile app on the server? */
export const isKitServerCall = (url: string): boolean => url.includes(`/${KIT_SERVER_APP}.`);

/** Turns the kit's server features on or off to match. */
export function applyKitServer(ready: boolean): void {
  const cfg = getConfig();
  cfg.monitor = { ...(cfg.monitor ?? {}), enabled: ready };
  cfg.support = ready;
  cfg.push = ready;
}

/**
 * The kit talks to the site through the app's own signed-in client (the site
 * the person logged in to, with their session), and never to Upande Mobile
 * while the site has not got it.
 */
export const kitApi: KitApi = async <T,>(req: Parameters<KitApi>[0]): Promise<T> => {
  if (isKitServerCall(req.url) && !useKitServer.getState().ready) {
    throw new Error(`${KIT_SERVER_APP} is not installed on this site yet`);
  }
  const client = await getClient();
  const res = await client.request<T>({ method: req.method, url: req.url, params: req.params, data: req.data });
  return res.data;
};

function set(ready: boolean, site: string | null): void {
  useKitServer.setState({ ready, site });
  applyKitServer(ready);
}

/** What the last check found for this site, before asking again (so a launch starts right, offline too). */
export async function loadKitServer(site: string | null): Promise<void> {
  if (!site) return set(false, null);
  try {
    const saved = await AsyncStorage.getItem(`${KEY}:${site}`);
    set(saved === "1", site);
  } catch {
    set(false, site);
  }
}

/**
 * Asks the signed-in site which apps it has. Offline or refused, it keeps what
 * it last knew.
 */
export async function checkKitServer(site: string | null): Promise<void> {
  if (!site) return set(false, null);
  try {
    const client = await getClient();
    const res = await client.get<{ message?: Record<string, unknown> }>(getConfig().endpoints.versions);
    const ready = !!res.data?.message && KIT_SERVER_APP in res.data.message;
    set(ready, site);
    await AsyncStorage.setItem(`${KEY}:${site}`, ready ? "1" : "0").catch(() => {});
  } catch {
    // keep what it last knew
  }
}
