import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ContinueRecording } from "@/components/ContinueRecording";
import { CowIcon } from "@/components/CowIcon";
import { FloatingOnlineDot } from "@/components/OnlineDot";
import { RecordTabButton } from "@/components/RecordTabButton";
import { TabSwipe } from "@/components/TabSwipe";
import { isQualityOnly } from "@/src/auth/roles";
import { useAuthStore } from "@/src/auth/authStore";
import { useCanRecord } from "@/src/hooks/useCanRecord";
import { useColors } from "@/src/hooks/useColors";
import { useRecordDrafts } from "@/src/record/draft";

const ICON_SIZE = 31;
const BAR_CONTENT_HEIGHT = 58;

export default function TabLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { canRecord } = useCanRecord();
  const reduceMotion = useReducedMotion();
  // Lab role: the Quality view and Profile only. The other tabs are hidden (and
  // their routes gated, so a deep link meets a polite message, not a form).
  const qualityOnly = isQualityOnly(useAuthStore((s) => s.roles));
  // Swiping skips tabs that are hidden (no Employee: no Record; lab role: only Quality and Profile).
  const hidden = qualityOnly ? ["animals", "record"] : canRecord ? ["quality"] : ["record", "quality"];

  return (
    <>
    {/* The connection dot, drawn once over the pages in one fixed place. */}
    <FloatingOnlineDot>
    <Tabs
      // A sideways swipe on a tab's root screen moves to the next visible tab.
      screenLayout={({ route, navigation, children }) => (
        <TabSwipe route={route} navigation={navigation as never} hidden={hidden}>
          {children}
        </TabSwipe>
      )}
      // A record form left with input in it is kept for "Continue recording".
      screenListeners={({ route }) => ({ blur: () => useRecordDrafts.getState().markPending(route.name) })}
      screenOptions={{
        headerShown: false,
        // Coming back to a tab shows its top screen, not the one left deep in its stack.
        popToTopOnBlur: true,
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
          href: qualityOnly ? null : undefined,
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
          // and a custom `tabBarButton` must never be set together (expo-router
          // throws while laying out the tabs), so the hidden tab carries `href` alone.
          canRecord && !qualityOnly
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
        name="quality"
        options={{
          // A tab only for the lab role. Everyone else with access reaches it
          // from the Record menu (the route stays, the button does not).
          href: qualityOnly ? undefined : null,
          title: "Quality",
          tabBarIcon: ({ color }) => (
            // Solid like the other tabs' icons, at the same 28 as Profile.
            <MaterialCommunityIcons name="flask" size={28} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            // As on Mutara's bar: the solid account icon at 28, selected or not.
            <MaterialCommunityIcons name="account" size={28} color={color as string} />
          ),
        }}
      />
    </Tabs>
    <ContinueRecording bottom={BAR_CONTENT_HEIGHT + insets.bottom + 12} />
    </FloatingOnlineDot>
    </>
  );
}
