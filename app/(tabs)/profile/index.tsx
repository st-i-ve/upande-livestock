import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { APP, COLORS, RADIUS } from "@/constants/theme";

export default function Profile() {
  const handleLogout = () => {
    Alert.alert("Log out", "Sign out of this device?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => router.replace("/(auth)/login") },
    ]);
  };

  return (
    <Screen title="Profile">
      <View style={s.card}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{APP.initials}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name} numberOfLines={1}>{APP.user}</Text>
          <Text style={s.meta} numberOfLines={1}>Employee · {APP.emp}</Text>
          <Text style={s.meta} numberOfLines={1}>{APP.farm}</Text>
        </View>
      </View>

      <Pressable
        onPress={() => router.push("/(tabs)/profile/configurations")}
        style={({ pressed }) => [s.row, pressed && { backgroundColor: COLORS.bgMuted }]}
      >
        <MaterialCommunityIcons name="tune-variant" size={18} color={COLORS.textMuted} />
        <Text style={s.rowLabel}>Configurations</Text>
        <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.textSubtle} />
      </Pressable>

      <View style={{ marginTop: 24 }}>
        <Button label="Log out" variant="outline" icon="logout" onPress={handleLogout} />
      </View>

      <Text style={s.version}>Version {APP.version}</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.md,
    marginBottom: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.text,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: COLORS.bg,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  meta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
  },
  rowLabel: { flex: 1, fontSize: 13, color: COLORS.text },
  version: {
    fontSize: 10,
    color: COLORS.textSubtle,
    textAlign: "center",
    marginTop: 24,
    letterSpacing: 0.4,
  },
});
