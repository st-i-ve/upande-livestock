import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import React from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, FONT } from "@/constants/theme";

export function Screen({
  title,
  subtitle,
  back,
  scroll = true,
  children,
  footer,
  onRefresh,
  refreshing = false,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  scroll?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const canGoBack = nav.canGoBack();
  const showBack = !!back && canGoBack;

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.appbar}>
        {showBack ? (
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.iconBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: 24 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.text} />
            ) : undefined
          }
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
  body: { padding: 14 },
  footer: {
    padding: 14, backgroundColor: COLORS.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderSubtle,
  },
});
