import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { EventIcon } from "@/components/EventIcon";
import { Pill } from "@/components/Pill";
import { font } from "@/constants/theme";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { useAuthStore } from "@/src/auth/authStore";
import { sectionsFor } from "@/src/auth/can";
import { canSeeQuality } from "@/src/auth/roles";
import { visibleSections } from "@/src/events/disabled";
import { useDisabledEvents } from "@/src/hooks/useDisabledEvents";
import { visibleFeedSections } from "@/src/feed/feedTypes";
import { useColors } from "@/src/hooks/useColors";
import { useFeedTypes } from "@/src/hooks/useFeedTypes";
import { RECORD_SECTIONS } from "@/src/recordSections";
import { useOffline } from "@/components/OnlineOnlyNotice";

const MILKING = "/(tabs)/record/events/milk";

const QUALITY = "/lab";
const MILK_QUALITY = "/lab/record";

export default function Record() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const offline = useOffline();
  // Managers, and anyone who also holds the lab role, may open the Quality view.
  const quality = canSeeQuality(useAuthStore((st) => st.roles));
  // Feeding modes switched off (Livestock Settings, Feed types) are not offered.
  const feedTypes = useFeedTypes();
  // Events the farm switched off (Settings -> Events) are not offered either.
  const disabled = useDisabledEvents();
  // What the user's rights do not cover (Milker: no Treatment; Attendant: no Milk recording) is left out.
  const can = useAuthStore((st) => st.can);
  const base = useMemo(
    () => visibleFeedSections(visibleSections(sectionsFor(RECORD_SECTIONS, can), disabled), feedTypes),
    [can, disabled, feedTypes],
  );
  // Quality recording sits right after Servicing and Health, before the rest.
  const afterHealth = base.findIndex((sec) => sec.title === "Health") + 1;
  const sections: typeof base = quality
    ? [
        ...base.slice(0, afterHealth),
        { title: "Quality", items: [
          { event: "Milk Quality", label: "Quality recording", href: MILK_QUALITY },
          { icon: "history" as const, label: "Quality history", href: QUALITY },
        ] },
        ...base.slice(afterHealth),
      ]
    : base;
  return (
    <Screen title="Livestock events" subtitle="Pick what you observed or did">
      {offline ? (
        <Banner tone="warning" icon="wifi-off">
          You are offline. Only milking can be recorded without a connection; everything else
          needs one because it moves stock or is checked by the server live.
        </Banner>
      ) : null}
      {sections.map((sec) => (
        <View key={sec.title}>
          <SectionTitle style={s.section}>{sec.title}</SectionTitle>
          {sec.items.map((it) => {
            const onlineOnly = offline && it.href !== MILKING && it.href !== MILK_QUALITY;
            return (
            <Pressable
              key={it.href + it.label}
              onPress={() => router.push(it.href as any)}
              style={({ pressed }) => [
                s.item,
                onlineOnly && { opacity: 0.55 },
                pressed && { backgroundColor: c.bgMuted },
              ]}
            >
              {it.event ? (
                <EventIcon event={it.event} size={20} color={c.textMuted} />
              ) : (
                <MaterialCommunityIcons name={it.icon ?? "circle-outline"} size={20} color={c.textMuted} />
              )}
              <Text style={s.text}>{it.label}</Text>
              {offline ? (
                <Pill label={onlineOnly ? "online only" : "works offline"} tone={onlineOnly ? "default" : "success"} />
              ) : null}
              <MaterialCommunityIcons name="chevron-right" size={20} color={c.textSubtle} />
            </Pressable>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      minHeight: 48,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    section: { fontSize: 12, marginTop: 18, marginBottom: 4 },
    text: { flex: 1, fontSize: 16, ...font("600"), color: c.text },
  });
