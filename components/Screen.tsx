import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { APP, COLORS, FONT } from "@/constants/theme";

export function Screen({
  title,
  subtitle,
  back,
  scroll = true,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  scroll?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const canGoBack = nav.canGoBack();

  const onLeft = () => {
    if (back && canGoBack) router.back();
    else router.push("/(tabs)/more");
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.appbar}>
        <Pressable onPress={onLeft} hitSlop={10} style={s.iconBtn}>
          <MaterialCommunityIcons
            name={back && canGoBack ? "arrow-left" : "menu"}
            size={22}
            color={COLORS.text}
          />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <View style={s.me}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{APP.initials}</Text>
          </View>
        </View>
      </View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: 24 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[s.body, { flex: 1, paddingBottom: 24 + insets.bottom }]}>{children}</View>
      )}
      {footer ? <View style={[s.footer, { paddingBottom: 12 + insets.bottom }]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  appbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
    backgroundColor: COLORS.bg,
  },
  iconBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { fontSize: FONT.page.size, fontWeight: FONT.page.weight, color: COLORS.text },
  subtitle: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  me: { flexDirection: "row", alignItems: "center", gap: 6 },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.text,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: COLORS.bg, fontSize: 11, fontWeight: "600" },
  body: { padding: 14 },
  footer: {
    padding: 14, backgroundColor: COLORS.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderSubtle,
  },
});
