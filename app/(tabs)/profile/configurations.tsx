import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { COLORS } from "@/constants/theme";
import { drawerStruct } from "@/data/mock";

export default function Configurations() {
  return (
    <Screen title="Configurations" subtitle="Reports, inventory & settings" back>
      {drawerStruct.map((g) => (
        <View key={g.grp}>
          <Text style={s.grp}>{g.grp}</Text>
          {g.its.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => router.push(it.href as any)}
              style={({ pressed }) => [s.it, pressed && { backgroundColor: COLORS.bgMuted }]}
            >
              <MaterialCommunityIcons name={it.ic as any} size={18} color={COLORS.textMuted} />
              <Text style={s.label}>{it.l}</Text>
              {it.b ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{it.b}</Text>
                </View>
              ) : null}
              <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.textSubtle} />
            </Pressable>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  grp: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingTop: 14,
    paddingBottom: 4,
    paddingHorizontal: 4,
  },
  it: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
  },
  label: { flex: 1, fontSize: 13, color: COLORS.text },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.danger,
  },
  badgeText: { fontSize: 10, fontWeight: "600", color: COLORS.danger },
});
