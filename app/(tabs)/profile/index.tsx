import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { APP, COLORS, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";
import { usePendingCount } from "@/src/hooks/useQueueStatus";

type RowProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress?: () => void;
  destructive?: boolean;
  right?: React.ReactNode;
};

function Row({ icon, label, onPress, destructive, right }: RowProps) {
  const color = destructive ? COLORS.danger : COLORS.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: COLORS.bgMuted }]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={color} />
      <Text style={[s.rowLabel, { color }]} numberOfLines={1}>{label}</Text>
      {right ?? <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.textSubtle} />}
    </Pressable>
  );
}

function Subheader({ children }: { children: React.ReactNode }) {
  return <Text style={s.subheader}>{children}</Text>;
}

export default function Profile() {
  const fullname = useAuthStore((s) => s.fullname);
  const email = useAuthStore((s) => s.email);
  const employeeName = useAuthStore((s) => s.employeeName);
  const setEmployeeName = useAuthStore((s) => s.setEmployeeName);
  const logout = useAuthStore((s) => s.logout);
  const pending = usePendingCount();
  const online = useNetworkStatus();

  const displayName = fullname || APP.user;
  const subtitle = email || APP.farm;

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.appbar}>
        <Text style={s.appbarTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.userSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ marginLeft: 20, flex: 1, justifyContent: "center" }}>
            <Text style={s.name} numberOfLines={1}>{displayName}</Text>
            <Text style={s.caption} numberOfLines={1}>{subtitle}</Text>
            <Text style={s.caption} numberOfLines={1}>{APP.farm}</Text>
          </View>
        </View>

        <View style={s.empWrapper}>
          <Subheader>My employee</Subheader>
          <View style={s.empBody}>
            <EmployeePickerButton
              value={employeeName}
              onChange={(name) => setEmployeeName(name)}
              placeholder="Tap to pick your Employee"
            />
            <Text style={s.empHint}>
              Used as the default operator on every record you submit. Pick once; we remember it.
            </Text>
          </View>
        </View>

        <View style={s.menuWrapper}>
          <Subheader>Settings</Subheader>
          <Row
            icon="tune-variant"
            label="Configurations"
            onPress={() => router.push("/(tabs)/profile/configurations")}
          />
          <Row
            icon="cog"
            label="Livestock settings"
            onPress={() => router.push("/(tabs)/profile/settings")}
          />
          <Row
            icon="cloud-upload-outline"
            label={online === false ? "Offline · pending submissions" : "Pending submissions"}
            onPress={() => router.push("/(tabs)/profile/pending" as any)}
            right={
              pending > 0 ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{pending}</Text>
                </View>
              ) : undefined
            }
          />

          <View style={s.divider} />

          <Row icon="logout" label="Logout" onPress={handleLogout} destructive />
        </View>

        <Pressable style={s.versionContainer}>
          <Text style={s.versionText}>Version {APP.version}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  appbar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
  },
  appbarTitle: {
    fontSize: 20,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.semibold,
  },
  scroll: { paddingBottom: 24 },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.text,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: COLORS.bg,
    fontSize: 32,
    fontFamily: FONT_FAMILY.bold,
  },
  name: {
    fontSize: 22,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.bold,
  },
  caption: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.medium,
    marginTop: 2,
  },
  menuWrapper: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    overflow: "hidden",
    paddingVertical: 6,
  },
  subheader: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.medium,
    letterSpacing: 0.4,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONT_FAMILY.regular,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.borderSubtle,
    marginVertical: 4,
    marginHorizontal: 12,
  },
  versionContainer: {
    padding: 20,
    alignItems: "center",
    marginTop: 12,
  },
  versionText: {
    color: COLORS.textSubtle,
    fontSize: 12,
    fontFamily: FONT_FAMILY.regular,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  badgeText: {
    color: COLORS.bg,
    fontSize: 11,
    fontFamily: FONT_FAMILY.semibold,
  },
  empWrapper: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    overflow: "hidden",
    paddingBottom: 12,
  },
  empBody: {
    paddingHorizontal: 16,
    gap: 8,
  },
  empHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.regular,
    lineHeight: 15,
  },
});
