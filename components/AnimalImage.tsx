import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";

import { useAuthStore } from "@/src/auth/authStore";
import { useColors } from "@/src/hooks/useColors";
import { STORAGE_KEYS, storage } from "@/src/services/storage";

/**
 * The animal's picture, or a silhouette when she has none. Loaded lazily by
 * the view that shows it (no bulk prefetch) and kept on disk by expo-image, so
 * a picture seen once is there offline. Private files need the session cookie.
 */
export function AnimalImage({
  image,
  style,
  iconSize = 18,
}: {
  image?: string | null;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
}) {
  const c = useColors();
  const base = useAuthStore((s) => s.instanceUrl);
  const [cookie, setCookie] = useState<string | null>(null);
  const isPrivate = !!image && image.startsWith("/private/");
  useEffect(() => {
    if (!isPrivate) return;
    storage.getItem(STORAGE_KEYS.COOKIE).then(setCookie);
  }, [isPrivate]);

  const uri = image ? (image.startsWith("/") ? `${base.replace(/\/+$/, "")}${image}` : image) : null;
  const ready = !!uri && (!isPrivate || cookie);

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
          cachePolicy="disk"
          recyclingKey={uri!}
          contentFit="cover"
          transition={120}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <MaterialCommunityIcons name="cow" size={iconSize} color={c.textSubtle} />
      )}
    </View>
  );
}
