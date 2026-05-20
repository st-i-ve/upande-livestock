import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { COLORS, FONT_FAMILY } from "@/constants/theme";
import { drawerStruct } from "@/data/mock";

export default function Configurations() {
  return (
    <Screen title="Configurations" subtitle="Reports, inventory & settings" back>
      {drawerStruct.map((g, gi) => (
        <View key={g.grp} style={[s.section, gi === 0 && { marginTop: 4 }]}>
          <Text style={s.grpLabel}>{g.grp}</Text>
          <View style={s.group}>
            {g.its.map((it, ii) => (
              <View key={it.id}>
                <Pressable
                  onPress={() => router.push(it.href as any)}
                  style={({ pressed }) => [s.item, pressed && { backgroundColor: COLORS.bgMuted }]}
                >
                  <MaterialCommunityIcons name={it.ic as any} size={20} color={COLORS.text} />
                  <Text style={s.label} numberOfLines={1}>{it.l}</Text>
                  {it.b ? (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{it.b}</Text>
                    </View>
                  ) : null}
                  <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.textSubtle} />
                </Pressable>
                {ii < g.its.length - 1 ? <View style={s.divider} /> : null}
              </View>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  section: {
    marginTop: 18,
  },
  grpLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.semibold,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  group: {},
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  label: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.regular,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.danger,
  },
  badgeText: {
    fontSize: 10,
    color: COLORS.danger,
    fontFamily: FONT_FAMILY.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginLeft: 20 + 14,
  },
});
