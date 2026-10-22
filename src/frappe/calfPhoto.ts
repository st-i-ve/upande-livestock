import { Directory, File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

import { uploadFile, type FileAsset } from "./files";

/**
 * The calf's photo. The phone only RECORDS it: the picture is chosen (camera,
 * or the gallery when the camera is unavailable or refused) while the form is
 * filled in, is uploaded when the calving is sent, and the server makes it the
 * new calf Animal's `image` (the Attach Image field the form and lists show).
 *
 * Calving needs a connection (it creates an animal and moves stock), so the
 * photo is uploaded straight from where the picker left it. The one exception
 * is a calving an older build queued offline: it holds a durable copy under
 * `calf-photos`, which the queue still uploads when it drains and then removes
 * (`discardCalfPhoto`).
 */

export type PickOutcome =
  | { status: "picked"; asset: FileAsset }
  | { status: "cancelled" }
  | { status: "denied" }
  | { status: "failed"; message: string };

// Only older builds copied the photo here (to survive the OS clearing its cache
// while a calving sat in the queue). New photos are used where the picker put them.
const photoDir = () => new Directory(Paths.document, "calf-photos");

const isOurs = (uri?: string | null): uri is string =>
  !!uri && uri.startsWith(photoDir().uri);

/** Delete a durable photo copy. Ignores anything that is not one of ours. */
export function discardCalfPhoto(uri?: string | null): void {
  if (!isOurs(uri)) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone, or not deletable: nothing left to clean up.
  }
}

const toAsset = (a: ImagePicker.ImagePickerAsset): FileAsset => {
  const ext = (a.uri.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return {
    uri: a.uri,
    name: `calf-${Date.now()}.${ext}`,
    mimeType: a.mimeType || `image/${ext === "png" ? "png" : "jpeg"}`,
  };
};

// A calf photo is for identification, not print. Compressing on the handset
// keeps the upload viable on a farm connection.
const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.6,
  allowsEditing: false,
  exif: false,
};

/** Camera first; the gallery when the camera is refused or cannot open. */
export async function pickCalfPhoto(source: "camera" | "gallery" = "camera"): Promise<PickOutcome> {
  try {
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.granted) {
        try {
          const shot = await ImagePicker.launchCameraAsync(OPTIONS);
          if (shot.canceled || !shot.assets?.length) return { status: "cancelled" };
          return { status: "picked", asset: toAsset(shot.assets[0]) };
        } catch {
          // No camera on this device (or it would not open): fall through.
        }
      } else {
        return { status: "denied" };
      }
    }
    const lib = await ImagePicker.launchImageLibraryAsync(OPTIONS);
    if (lib.canceled || !lib.assets?.length) return { status: "cancelled" };
    return { status: "picked", asset: toAsset(lib.assets[0]) };
  } catch (e: any) {
    return { status: "failed", message: e?.message || "Could not get the photo." };
  }
}

/**
 * Upload the photo and return its URL, for the calving payload's `photo`.
 *
 * The server sets the calf's `image` from it when it creates the calf, in the
 * same call as the calving — so there is no second step to lose. (Frappe does
 * NOT point an Attach Image field at a file just because the File names that
 * field; attaching after the fact would leave the calf with no picture.)
 *
 * Public: a private File will not render in the Animal form or its lists.
 */
export const uploadCalfPhoto = (asset: FileAsset): Promise<string> => uploadFile(asset, false);
