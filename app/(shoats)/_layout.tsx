import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SilhouetteArt } from "@/components/AnimalSilhouette";
import { RecordTabButton } from "@/components/RecordTabButton";
import { TabSwipe } from "@/components/TabSwipe";
import { ContinueRecording } from "@/components/ContinueRecording";
import { FloatingOnlineDot } from "@/components/OnlineDot";
import { MorphIn } from "@/components/MorphIn";
import { useRecordDrafts } from "@/src/record/draft";
import { useCanRecord } from "@/src/hooks/useCanRecord";
import { useColors } from "@/src/hooks/useColors";
import { silhouetteOf, useAnimalType } from "@/src/shoats/animalType";

const ICON_SIZE = 31;
const BAR_CONTENT_HEIGHT = 58;

/** The Shoats app: Herds, the Record menu and Profile, in the cattle app's tab bar. */
export default function ShoatsTabLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { canRecord } = useCanRecord();
  const reduceMotion = useReducedMotion();
  const type = useAnimalType((s) => s.type);
  // Swiping skips the Record tab when the user has no Employee and it is hidden.
  const hidden = canRecord ? [] : ["record"];

  return (
    <MorphIn>
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
          // The navigator draws each icon in a small fixed box; a drawing at the
          // bar's size was clipped by it. Room for the sheep or the goat.
          tabBarIconStyle: { width: ICON_SIZE + 9, height: ICON_SIZE + 5 },
        }}
      >
        <Tabs.Screen
          name="herds"
          options={{
            title: "Herds",
            // The traced sheep or goat, whichever animals the phone is working with.
            tabBarIcon: ({ color }) => (
              <SilhouetteArt pose={silhouetteOf(type)} color={color} width={ICON_SIZE + 7} height={ICON_SIZE + 1} />
            ),
          }}
        />
        <Tabs.Screen
          name="record"
          listeners={{
            tabPress: () => {
              try {
                router.dismissTo("/(shoats)/record");
              } catch {
                // not mounted yet: the tab opens on its menu anyway
              }
            },
          }}
          options={
            // `href: null` and a custom `tabBarButton` must never be set together:
            // expo-router throws on it while laying out the tabs (see (tabs)/_layout).
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
      <ContinueRecording bottom={BAR_CONTENT_HEIGHT + insets.bottom + 12} />
    </FloatingOnlineDot>
    </MorphIn>
  );
}
