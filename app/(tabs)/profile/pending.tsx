import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";
import { usePendingQueue } from "@/src/hooks/useQueueStatus";
import { drainNow } from "@/src/offline/autoDrain";
import { remove } from "@/src/offline/queue";

const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const TYPE_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  AnimalEvent: "calendar-clock",
  MilkRecording: "water",
  AnimalDisposal: "cash",
  Animal: "cow",
  CalfFeeding: "baby-bottle-outline",
  AnimalDiagnosis: "magnify",
  AnimalHealthCase: "stethoscope",
};

export default function Pending() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const queue = usePendingQueue();
  const online = useNetworkStatus();

  const handleDiscard = (id: string, label: string) => {
    Alert.alert(
      "Discard submission?",
      `Remove "${label}" from the queue without sending it to Frappe?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => remove(id),
        },
      ],
    );
  };

  return (
    <Screen title="Pending submissions" subtitle={`${queue.length} queued`} back>
      <Banner tone={online ? "info" : "warning"}>
        {online === null
          ? "Checking network…"
          : online
            ? "Online. The queue drains automatically when you connect or open the app."
            : "Offline. New submissions will be saved here until the device reconnects."}
      </Banner>

      <Button
        label="Retry now"
        icon="refresh"
        variant="outline"
        disabled={queue.length === 0}
        onPress={() => drainNow()}
      />

      {queue.length === 0 ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="check-all" size={40} color={c.textSubtle} />
          <Text style={s.emptyText}>Nothing pending. You're all caught up.</Text>
        </View>
      ) : (
        <>
          <SectionTitle>Queued</SectionTitle>
          {queue.map((m) => (
            <View key={m.id} style={s.row}>
              <Avatar icon={TYPE_ICONS[m.type] ?? "alert-decagram-outline"} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.title} numberOfLines={1}>{m.label}</Text>
                <Text style={s.meta} numberOfLines={2}>
                  {m.type} · queued {formatTime(m.createdAt)}
                  {m.attempts > 0 ? ` · ${m.attempts} attempt${m.attempts === 1 ? "" : "s"}` : ""}
                </Text>
                {m.lastError ? <Text style={s.error} numberOfLines={2}>{m.lastError}</Text> : null}
              </View>
              <Pressable
                onPress={() => handleDiscard(m.id, m.label)}
                hitSlop={8}
                style={s.discard}
              >
                <MaterialCommunityIcons name="close" size={16} color={c.textMuted} />
              </Pressable>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    title: {
      fontSize: 13,
      color: c.text,
      fontFamily: FONT_FAMILY.semibold,
    },
    meta: {
      fontSize: 11,
      color: c.textMuted,
      marginTop: 2,
    },
    error: {
      fontSize: 11,
      color: c.danger,
      marginTop: 4,
    },
    discard: {
      width: 28,
      height: 28,
      borderRadius: RADIUS.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.bgMuted,
      marginTop: 2,
    },
    empty: {
      alignItems: "center",
      paddingVertical: 40,
      gap: 8,
    },
    emptyText: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: "center",
    },
  });
