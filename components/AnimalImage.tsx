import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";

import { useAuthStore } from "@/src/auth/authStore";
import { useColors } from "@/src/hooks/useColors";
import { AnimalSilhouette } from "./AnimalSilhouette";
import type { SilhouetteSubject } from "@/src/silhouettes";
import { STORAGE_KEYS, storage } from "@/src/services/storage";

/**
 * The animal's picture, or her traced silhouette (cow, heifer, bull, steer or
 * calf, posed by her number, as on the web app) when she has none. Loaded lazily by
 * the view that shows it (no bulk prefetch) and kept on disk by expo-image, so
 * a picture seen once is there offline. Private files need the session cookie.
 */
export function AnimalImage({
  image,
  thumb,
  full,
  style,
  animal,
}: {
  image?: string | null;
  /** The small version, for rows and pickers; the full `image` is used when absent or if it fails. */
  thumb?: string | null;
  /**
   * Show the full picture, with the thumbnail as the placeholder while it loads
   * (blurred thumb, then the sharp full one): for the portrait and the zoom views.
   */
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Her number, sex, age and stage, to pick the silhouette when she has no photo. */
  animal?: (Omit<SilhouetteSubject, "id"> & { id?: string | null }) | null;
  /** Kept for callers written before the silhouettes; unused. */
  iconSize?: number;
}) {
  const c = useColors();
  const base = useAuthStore((s) => s.instanceUrl);
  const [cookie, setCookie] = useState<string | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [fullFailed, setFullFailed] = useState(false);
  // A blank path (the farm removed her picture) is no picture: the silhouette shows.
  const imageUrl = image || null;
  const thumbUrl = thumb && !thumbFailed ? thumb : null;
  useEffect(() => {
    setThumbFailed(false);
    setFullFailed(false);
  }, [image, thumb]);
  // Rows ask for the thumbnail; the full picture only when asked for, or when there is no thumbnail.
  const shown = full ? (fullFailed ? thumbUrl : imageUrl) : (thumbUrl ?? imageUrl);
  const abs = (u: string) => (u.startsWith("/") ? `${base.replace(/\/+$/, "")}${u}` : u);
  const isPrivate = !!shown && shown.startsWith("/private/");
  const uri = shown ? abs(shown) : null;
  useEffect(() => {
    if (!isPrivate && !(thumbUrl ?? "").startsWith("/private/")) return;
    storage.getItem(STORAGE_KEYS.COOKIE).then(setCookie);
  }, [isPrivate, thumbUrl]);
  const ready = !!uri && (!isPrivate || cookie) && !(fullFailed && !full && !thumbUrl);
  const headersFor = (u: string) => (u.startsWith("/private/") && cookie ? { Cookie: cookie } : undefined);
  const placeholder =
    full && thumbUrl && thumbUrl !== shown && (!thumbUrl.startsWith("/private/") || cookie)
      ? { uri: abs(thumbUrl), headers: headersFor(thumbUrl) }
      : undefined;

  return (
    <View
      style={[
        { backgroundColor: c.bgMuted, alignItems: "center", justifyContent: "center", overflow: "hidden" },
        style,
      ]}
    >
      {ready ? (
        <Image
          source={{ uri: uri!, headers: isPrivate && cookie ? { Cookie: cookie } : undefined }}
          placeholder={placeholder}
          placeholderContentFit="cover"
          cachePolicy="memory-disk"
          priority={full ? "high" : "low"}
          recyclingKey={uri!}
          contentFit="cover"
          transition={full ? 250 : 120}
          onError={(e) => {
            console.warn("[img] failed", uri, e?.error);
            if (full) setFullFailed(true);
            else if (thumbUrl) setThumbFailed(true);
            else setFullFailed(true);
          }}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <AnimalSilhouette animal={{ ...(animal ?? {}), id: animal?.id ?? "" }} color={c.textSubtle} />
      )}
    </View>
  );
}
