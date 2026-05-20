import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { APP, COLORS, RADIUS } from "@/constants/theme";
import { drawerStruct } from "@/data/mock";

export default function More() {
  return (
    <Screen title="Menu" subtitle={APP.farm}>
      <View style={s.brand}>
        <View style={s.logo}>
          <Text style={s.logoText}>K</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.farm}>{APP.farm}</Text>
          <Text style={s.who}>Logged in: {APP.user}</Text>
        </View>
      </View>

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
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.md,
    marginBottom: 12,
  },
  logo: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: COLORS.text,
    alignItems: "center", justifyContent: "center",
  },
  logoText: { color: COLORS.bg, fontWeight: "700" },
  farm: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  who: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
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
    paddingVertical: 10,
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
