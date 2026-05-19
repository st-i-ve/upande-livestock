import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { COLORS } from "@/constants/theme";

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
        },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="animals"
        options={{
          title: "Animals",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="format-list-bulleted" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: "Record",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="plus-circle" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="bell" size={22} color={color} />,
          tabBarBadge: 5,
          tabBarBadgeStyle: { backgroundColor: COLORS.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="menu" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
