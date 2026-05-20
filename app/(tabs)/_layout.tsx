import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "@/constants/theme";

const ICON_SIZE = 28;
const BAR_CONTENT_HEIGHT = 64;
const CIRCLE_DIAMETER = 46;
const CIRCLE_LIFT = 14;

const labelStyle = {
  fontSize: 10,
  fontWeight: "500" as const,
  letterSpacing: 0.4,
  marginTop: 2,
};

function RecordTabButton(props: BottomTabBarButtonProps) {
  const selected = props.accessibilityState?.selected;
  return (
    <Pressable
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      accessibilityRole="button"
      accessibilityLabel="Record"
      accessibilityState={{ selected }}
      android_ripple={null}
      style={s.recordCell}
    >
      <View style={[s.recordCircle, selected && s.recordCircleSelected]}>
        <MaterialCommunityIcons name="plus" size={22} color={COLORS.bg} />
      </View>
      <Text style={[s.recordLabel, selected && s.recordLabelSelected]}>Record</Text>
    </Pressable>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "shift",
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: COLORS.borderSubtle,
          backgroundColor: COLORS.bg,
          height: BAR_CONTENT_HEIGHT + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
          overflow: "visible",
          elevation: 0,
        },
        tabBarItemStyle: {
          paddingTop: 0,
          paddingBottom: 0,
        },
        tabBarLabelStyle: labelStyle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="home" size={ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="animals"
        options={{
          title: "Animals",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="cow" size={ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          tabBarLabel: () => null,
          tabBarButton: (props) => <RecordTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="bell" size={ICON_SIZE} color={color} />
          ),
          tabBarBadge: 5,
          tabBarBadgeStyle: {
            backgroundColor: COLORS.danger,
            color: COLORS.bg,
            fontSize: 10,
            fontWeight: "600",
            minWidth: 16,
            height: 16,
            lineHeight: 16,
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account" size={ICON_SIZE} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  recordCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 4,
  },
  recordCircle: {
    position: "absolute",
    top: -CIRCLE_LIFT,
    width: CIRCLE_DIAMETER,
    height: CIRCLE_DIAMETER,
    borderRadius: CIRCLE_DIAMETER / 2,
    backgroundColor: COLORS.text,
    alignItems: "center",
    justifyContent: "center",
  },
  recordCircleSelected: {},
  recordLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.4,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  recordLabelSelected: {
    color: COLORS.text,
  },
});
