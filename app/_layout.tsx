import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}>
          <Stack.Screen name="(tabs)" />
<Stack.Screen name="sales/index" />
          <Stack.Screen name="sales/new" />
          <Stack.Screen name="culls/index" />
          <Stack.Screen name="culls/new" />
          <Stack.Screen name="events/[type]" />
          <Stack.Screen name="reports/[type]" />
          <Stack.Screen name="inventory/[type]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="event-success" />
        </Stack>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
