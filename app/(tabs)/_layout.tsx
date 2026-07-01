import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/src/hooks/useColors";

const ICON_SIZE = 31;
const BAR_CONTENT_HEIGHT = 58;
const CIRCLE_DIAMETER = 50;
const CIRCLE_LIFT = 10;

function RecordTabButton(props: BottomTabBarButtonProps) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
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
        <MaterialCommunityIcons name="plus" size={26} color={c.bg} />
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "shift",
        sceneStyle: { backgroundColor: c.bg },
        tabBarShowLabel: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.borderSubtle,
          backgroundColor: c.bg,
          height: BAR_CONTENT_HEIGHT + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
          overflow: "visible",
          elevation: 0,
        },
        tabBarItemStyle: { paddingTop: 0, paddingBottom: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? "home" : "home-outline"} size={ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="animals"
        options={{
          title: "Animals",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? "paw" : "paw-outline"} size={ICON_SIZE} color={color} />
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
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? "bell" : "bell-outline"} size={ICON_SIZE} color={color} />
          ),
          tabBarBadge: 5,
          tabBarBadgeStyle: {
            backgroundColor: c.danger,
            color: "#fff",
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
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? "account" : "account-outline"} size={ICON_SIZE} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    recordCell: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    recordCircle: {
      position: "absolute",
      top: -CIRCLE_LIFT,
      width: CIRCLE_DIAMETER,
      height: CIRCLE_DIAMETER,
      borderRadius: CIRCLE_DIAMETER / 2,
      backgroundColor: c.text,
      alignItems: "center",
      justifyContent: "center",
    },
    recordCircleSelected: {},
  });
