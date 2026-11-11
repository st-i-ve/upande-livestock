import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RADIUS, font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { TEXT_STEPS, TOTAL_SCALE_CAP, effectiveScale, textStepOf, type ThemePref } from "@/src/theme/textScale";
import { useTextScale, useThemePref, useThemeStore } from "@/src/theme/themeStore";

const THEMES: { id: ThemePref; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { id: "system", label: "System", icon: "cellphone" },
  { id: "light", label: "Light", icon: "white-balance-sunny" },
  { id: "dark", label: "Dark", icon: "moon-waning-crescent" },
];

/** The "A" on each size step, drawn at a fixed size so the control never grows. */
const STEP_GLYPH = [14, 16, 20, 26];

/**
 * Profile > Accessibility > Text size & theme. A modal over the profile: the
 * theme (System, Light, Dark) and the text size step, both applied the moment
 * they are tapped — the whole app behind, and the preview here, change at once —
 * and both remembered on the phone.
 */
export default function Accessibility() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const pref = useThemePref();
  const scale = useTextScale();
  const setThemePref = useThemeStore((st) => st.setThemePref);
  const setTextScale = useThemeStore((st) => st.setTextScale);
  const osScale = useWindowDimensions().fontScale;
  const step = textStepOf(scale);
  const total = effectiveScale(scale, osScale);

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={s.header}>
        <Text style={s.title} numberOfLines={1}>Text size & theme</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={s.close}
        >
          <MaterialCommunityIcons name="close" size={22} color={c.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.section}>Theme</Text>
        <View style={s.segment} accessibilityRole="radiogroup">
          {THEMES.map((t) => {
            const on = pref === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setThemePref(t.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${t.label} theme`}
                style={[s.seg, on && s.segOn]}
              >
                <MaterialCommunityIcons name={t.icon} size={18} color={on ? c.bg : c.text} />
                <Text style={[s.segLabel, on && s.segLabelOn]} numberOfLines={1}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.hint}>
          {pref === "system" ? "Follows the phone's light or dark setting." : `Always ${pref}, whatever the phone is set to.`}
        </Text>

        <Text style={[s.section, { marginTop: 28 }]}>Text size · {step.label}</Text>
        <View style={s.segment} accessibilityRole="radiogroup">
          {TEXT_STEPS.map((t, i) => {
            const on = t.id === step.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTextScale(t.scale)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${t.label} text`}
                style={[s.seg, s.sizeSeg, on && s.segOn]}
              >
                <Text allowFontScaling={false} style={[s.glyph, { fontSize: STEP_GLYPH[i], lineHeight: STEP_GLYPH[i] + 8 }, on && s.segLabelOn]}>
                  A
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[s.section, { marginTop: 28 }]}>Preview</Text>
        <View style={s.preview}>
          <View style={s.previewTick}>
            <MaterialCommunityIcons name="check" size={18} color={c.bg} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.previewMain}>Weight saved — 312 kg for LE151</Text>
            <Text style={s.previewMeta}>Today 09:14 · up 18 kg in 30 days</Text>
          </View>
        </View>

        <Text style={s.hint}>
          {osScale > 1.01
            ? `Your phone's own text size (×${osScale.toFixed(2)}) is added on top, up to ×${TOTAL_SCALE_CAP} in all — now ×${total.toFixed(2)}.`
            : `The phone's own text size setting is added on top, up to ×${TOTAL_SCALE_CAP} in all.`}
        </Text>
      </ScrollView>

      <View style={s.footer}>
        <Pressable onPress={() => router.back()} style={s.done} accessibilityRole="button">
          <Text style={s.doneText}>Done</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 12,
    },
    title: { flex: 1, fontSize: 20, ...font("600"), color: c.text },
    close: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
    section: { fontSize: 13, ...font("600"), color: c.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 },
    segment: {
      flexDirection: "row",
      backgroundColor: c.bgMuted,
      borderRadius: RADIUS.lg,
      padding: 4,
      gap: 4,
    },
    seg: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: RADIUS.md,
      minWidth: 0,
    },
    sizeSeg: { minHeight: 48, paddingVertical: 6 },
    segOn: { backgroundColor: c.text },
    segLabel: { fontSize: 14, ...font("500"), color: c.text, flexShrink: 1 },
    segLabelOn: { color: c.bg, ...font("600") },
    glyph: { ...font("600"), color: c.text },
    hint: { fontSize: 13, color: c.textMuted, marginTop: 10 },
    preview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.bgSubtle,
    },
    previewTick: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.text,
      alignItems: "center",
      justifyContent: "center",
    },
    previewMain: { fontSize: 16, ...font("600"), color: c.text },
    previewMeta: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
    done: {
      backgroundColor: c.text,
      borderRadius: RADIUS.lg,
      paddingVertical: 14,
      alignItems: "center",
    },
    doneText: { fontSize: 16, ...font("600"), color: c.bg },
  });
