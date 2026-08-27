import * as ImagePicker from "expo-image-picker";

import { attachFile } from "./files";

export type CalfPhotoOutcome =
  | { status: "attached"; fileUrl: string }
  | { status: "cancelled" }
  | { status: "denied" }
  | { status: "failed"; message: string };

/**
 * Photograph a newborn calf and put the picture on its Animal record.
 *
 * Deliberately a post-submit step: the calf has no Animal to hang a photo on
 * until record_birth has created one, and a camera that fails — no permission,
 * a cancelled shot, a dead upload — must never cost the operator the birth
 * they already recorded. Every failure path therefore returns a value rather
 * than throwing.
 *
 * The picture is public (isPrivate: false): an Attach Image field renders on
 * the Animal form and in list views, and a private File will not load there.
 */
export async function captureAndAttachCalfPhoto(
  animalName: string,
): Promise<CalfPhotoOutcome> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { status: "denied" };

    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      // A calf photo is for identification, not print. Compressing on the
      // handset keeps the upload viable on a farm connection.
      quality: 0.6,
      allowsEditing: false,
      exif: false,
    });
    if (shot.canceled || !shot.assets?.length) return { status: "cancelled" };

    const asset = shot.assets[0];
    const ext = (asset.uri.split(".").pop() || "jpg").toLowerCase();
    const safe = animalName.replace(/[^A-Za-z0-9._-]+/g, "-");

    const { fileUrl } = await attachFile({
      doctype: "Animal",
      docname: animalName,
      fieldname: "image",
      isPrivate: false,
      asset: {
        uri: asset.uri,
        name: `calf-${safe}.${ext}`,
        mimeType: asset.mimeType || `image/${ext === "png" ? "png" : "jpeg"}`,
      },
    });
    return { status: "attached", fileUrl };
  } catch (e: any) {
    return { status: "failed", message: e?.message || "Upload failed." };
  }
}
