import { Directory, File, Paths } from "expo-file-system";

import type { FileAsset } from "./files";

/**
 * The lab slip photo of a quality sheet waiting in the offline queue.
 *
 * The picker leaves a photo in the OS cache, which the system may clear before
 * the phone finds signal. A queued sheet therefore keeps its own copy here, which
 * the queue deletes when the sheet is sent or dropped (`discardSlipPhoto`).
 */
const dir = () => new Directory(Paths.document, "quality-slips");

const isOurs = (uri?: string | null): uri is string => !!uri && uri.startsWith(dir().uri);

/** A durable copy of `asset`, or the asset itself when it cannot be copied. */
export function keepSlipPhoto(asset: FileAsset): FileAsset {
  try {
    const d = dir();
    if (!d.exists) d.create();
    const ext = (asset.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
    const target = new File(d, `slip-${Date.now()}.${ext}`);
    new File(asset.uri).copy(target);
    return { ...asset, uri: target.uri, name: target.name };
  } catch {
    return asset;
  }
}

export function discardSlipPhoto(uri?: string | null): void {
  if (!isOurs(uri)) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone: nothing left to clean up.
  }
}
