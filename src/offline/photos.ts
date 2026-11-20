import { Directory, File, Paths } from "expo-file-system";

import { discardCalfPhoto } from "@/src/frappe/calfPhoto";
import type { FileAsset } from "@/src/frappe/files";
import { discardSlipPhoto } from "@/src/frappe/slipPhoto";

/**
 * A picture waiting in the offline queue. The picker leaves it in the OS cache,
 * which the system may clear before there is signal, so a queued recording keeps
 * its own copy here; the queue deletes it when the recording is sent or dropped.
 */
const dir = () => new Directory(Paths.document, "queued-photos");

const isOurs = (uri?: string | null): uri is string => !!uri && uri.startsWith(dir().uri);

/** A durable copy of `asset`, or the asset itself when it cannot be copied. */
export function keepQueuedPhoto(asset: FileAsset): FileAsset {
  try {
    const d = dir();
    if (!d.exists) d.create();
    const ext = (asset.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
    const target = new File(d, `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`);
    new File(asset.uri).copy(target);
    return { ...asset, uri: target.uri, name: asset.name || target.name };
  } catch {
    return asset;
  }
}

function discardOne(uri?: string | null) {
  discardCalfPhoto(uri);
  discardSlipPhoto(uri);
  if (!isOurs(uri)) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

/** Delete every durable picture a payload carries (any object with a `uri`). */
export function discardPayloadPhotos(payload: unknown, depth = 0): void {
  if (!payload || typeof payload !== "object" || depth > 5) return;
  const o = payload as Record<string, unknown>;
  if (typeof o.uri === "string" && typeof o.name === "string") discardOne(o.uri);
  for (const v of Object.values(o)) discardPayloadPhotos(v, depth + 1);
}
