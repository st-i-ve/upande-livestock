import { useAuthStore } from "@/src/auth/authStore";
import { getClient } from "@/src/services/api";
import { storage } from "@/src/services/storage";

import { OpsError } from "./opsError";
import { pickCalfPhoto, type PickOutcome } from "./calfPhoto";
import { uploadFile, type FileAsset } from "./files";

/**
 * An animal's portfolio. The phone only RECORDS: it picks a picture, uploads
 * it (public, like the calf photo, so an image request needs no session) and
 * names what it is for. Whether a health case is hers and still open, which
 * calving a birth photo belongs to and who may add at all are the server's.
 */
const NS = "/api/method/upande_livestock.serverscripts.animals.animal_photos";

export type PhotoSource = "Profile" | "Birth" | "Health case" | "Event";

export type AnimalPhoto = {
  name: string | null;
  url: string;
  thumb: string | null;
  date: string;
  source: PhotoSource;
  ref_doctype: string;
  ref_name: string;
  caption: string;
  uploaded_by: string;
};

export type GalleryResult = { photos: AnimalPhoto[]; cached: boolean };

export type PhotoContext = "health_case" | "birth" | "profile";

const cacheKey = (id: string) => `gallery:${useAuthStore.getState().instanceUrl}:${id}`;

/** Newest first. The last answer is kept so a gallery seen once lists offline
 *  (its thumbnails are on the disk cache of expo-image). */
export async function getGallery(id: string): Promise<GalleryResult> {
  try {
    const client = await getClient();
    const res = await client.post(`${NS}.animal_gallery`, { animal: id });
    const m = res.data?.message;
    if (!m || m.error) throw new OpsError(m?.error || "Could not load her photos.", m?.code);
    await storage.setItem(cacheKey(id), JSON.stringify(m.photos));
    return { photos: m.photos as AnimalPhoto[], cached: false };
  } catch (e) {
    const raw = await storage.getItem(cacheKey(id));
    if (raw) {
      try {
        return { photos: JSON.parse(raw) as AnimalPhoto[], cached: true };
      } catch {
        // Unreadable copy: report the real failure.
      }
    }
    throw e;
  }
}

/** Upload a picked photo and attach it to her for `context`. */
export async function addAnimalPhoto(input: {
  animal: string;
  asset: FileAsset;
  context: PhotoContext;
  ref?: string;
  caption?: string;
}): Promise<{ url: string }> {
  const fileUrl = await uploadFile(input.asset, false);
  const client = await getClient();
  const res = await client.post(`${NS}.add_animal_photo`, {
    animal: input.animal,
    file_url: fileUrl,
    context: input.context,
    ref: input.ref || undefined,
    caption: input.caption || undefined,
  });
  const m = res.data?.message;
  if (!m || m.error) throw new OpsError(m?.error || "The photo was not added.", m?.code);
  return { url: m.url as string };
}

/** Camera first, gallery as the fallback; the asset is named for the portfolio. */
export async function pickAnimalPhoto(source: "camera" | "gallery" = "camera"): Promise<PickOutcome> {
  const r = await pickCalfPhoto(source);
  if (r.status === "picked") {
    r.asset = { ...r.asset, name: r.asset.name.replace(/^calf-/, "photo-") };
  }
  return r;
}

/** Absolute URL for a server-relative file path. */
export const fileUri = (path: string, base: string) =>
  path.startsWith("/") ? `${base.replace(/\/+$/, "")}${path}` : path;
