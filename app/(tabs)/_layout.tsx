import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CowIcon } from "@/components/CowIcon";
import { RecordTabButton } from "@/components/RecordTabButton";
import { TabSwipe } from "@/components/TabSwipe";
import { LiveToast } from "@/components/LiveToast";
import { useCanRecord } from "@/src/hooks/useCanRecord";
import { useColors } from "@/src/hooks/useColors";

const ICON_SIZE = 31;
const BAR_CONTENT_HEIGHT = 58;

export default function TabLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { canRecord } = useCanRecord();
  const reduceMotion = useReducedMotion();
  // Swiping skips the Record tab when the user has no Employee and it is hidden.
  const hidden = canRecord ? [] : ["record"];

  return (
    <>
    <Tabs
      // A sideways swipe on a tab's root screen moves to the next visible tab.
      screenLayout={({ route, navigation, children }) => (
        <TabSwipe route={route} navigation={navigation as never} hidden={hidden}>
          {children}
        </TabSwipe>
      )}
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? "none" : "shift",
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
        name="animals"
        options={{
          title: "Animals",
          tabBarIcon: ({ color }) => (
            <CowIcon size={ICON_SIZE + 3} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        listeners={{
          // Tapping Record always lands on the menu, never on whichever record
          // screen was left open in its stack.
          tabPress: () => {
            try {
              router.dismissTo("/(tabs)/record");
            } catch {
              // not mounted yet: the tab opens on its menu anyway
            }
          },
        }}
        options={
          // No Employee, no recording: the tab is not there at all. `href: null`
          // and a custom `tabBarButton` must never be set together — expo-router
          // throws "Cannot use `href` and `tabBarButton` together" while laying
          // out the tabs, which closes a release build on launch for every user
          // without an Employee. So the hidden tab carries `href` alone.
          canRecord
            ? {
                tabBarLabel: () => null,
                tabBarButton: (props) => (
                  <RecordTabButton
                    onPress={props.onPress}
                    onLongPress={props.onLongPress}
                    accessibilityState={props.accessibilityState}
                  />
                ),
              }
            : { href: null }
        }
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account" size={28} color={color as string} />
          ),
        }}
      />
    </Tabs>
    <LiveToast />
    </>
  );
}
