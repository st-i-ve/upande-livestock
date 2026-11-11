import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useSegments } from "expo-router";
import React, { useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { isTabRoot, useRecordDrafts } from "@/src/record/draft";

/**
 * "Continue recording: Weight" — floats above the tab bar on every tab's top
 * screen while a record form left by a tab switch still holds its input.
 * Tap: back to the form, filled in. The ×, or a long press: discard it.
 */
export function ContinueRecording({ bottom }: { bottom: number }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const draft = useRecordDrafts((st) => st.draft);
  const segments = useSegments() as string[];
  if (!draft?.pending || !isTabRoot(segments)) return null;
  // The Animals list has its own round back-to-top button in that corner: sit above it.
  const lift = segments.includes("animals") ? 58 : 0;

  const discard = () =>
    Alert.alert("Discard this record?", `What you entered for ${draft.title} will be lost.`, [
      { text: "Keep it", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => useRecordDrafts.getState().clear(draft.key) },
    ]);

  return (
    <View pointerEvents="box-none" style={[s.wrap, { bottom: bottom + lift }]}>
      <View style={s.pill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Continue recording: ${draft.title}`}
          onPress={() => router.push(draft.href as never)}
          onLongPress={discard}
          style={({ pressed }) => [s.main, pressed && { opacity: 0.7 }]}
          testID="continue-recording"
        >
          <MaterialCommunityIcons name="pencil-outline" size={17} color={c.bg} />
          <Text style={s.label} numberOfLines={1}>
            Continue recording: {draft.title}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard the unsaved record"
          onPress={discard}
          hitSlop={8}
          style={s.close}
        >
          <MaterialCommunityIcons name="close" size={15} color={c.bg} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    wrap: { position: "absolute", right: 16, left: 16, alignItems: "flex-end" },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      maxWidth: "100%",
      backgroundColor: c.selected,
      borderRadius: 999,
      paddingLeft: 14,
      paddingRight: 6,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 5,
    },
    main: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 11, flexShrink: 1 },
    label: { fontSize: 13.5, ...font("600"), color: c.bg, flexShrink: 1 },
    close: {
      marginLeft: 8,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.18)",
    },
  });
