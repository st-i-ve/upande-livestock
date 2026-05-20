import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { COLORS } from "@/constants/theme";

const ACTIVE_SIZE = 26;
const INACTIVE_SIZE = 22;

function RecordTabButton(props: BottomTabBarButtonProps) {
  return (
    <Pressable
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: props.accessibilityState?.selected }}
      style={s.recordWrap}
    >
      <View style={s.recordCircle}>
        <MaterialCommunityIcons name="plus" size={28} color={COLORS.bg} />
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          borderTopWidth: 0.5,
          borderTopColor: COLORS.borderSubtle,
          backgroundColor: COLORS.bg,
          height: 60,
          paddingTop: 6,
          overflow: "visible",
        },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name="home"
              size={focused ? ACTIVE_SIZE : INACTIVE_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="animals"
        options={{
          title: "Animals",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name="format-list-bulleted"
              size={focused ? ACTIVE_SIZE : INACTIVE_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: "",
          tabBarButton: (props) => <RecordTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name="bell"
              size={focused ? ACTIVE_SIZE : INACTIVE_SIZE}
              color={color}
            />
          ),
          tabBarBadge: 5,
          tabBarBadgeStyle: { backgroundColor: COLORS.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name="menu"
              size={focused ? ACTIVE_SIZE : INACTIVE_SIZE}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  recordWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  recordCircle: {
    position: "absolute",
    top: -20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.text,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
});
