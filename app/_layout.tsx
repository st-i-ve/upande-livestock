import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { COLORS, FONT_FAMILY } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import { startAutoDrain } from "@/src/offline/autoDrain";
import { queryClient } from "@/src/services/queryClient";

// Map fontWeight values to the loaded Poppins faces. React Native does NOT
// synthesise bold from a regular file, so a Text style with weight 600 must
// explicitly set fontFamily to Poppins_600SemiBold or the renderer falls
// back to the system font.
const POPPINS_BY_WEIGHT: Record<string, string> = {
  "100": FONT_FAMILY.regular,
  "200": FONT_FAMILY.regular,
  "300": FONT_FAMILY.regular,
  "400": FONT_FAMILY.regular,
  "500": FONT_FAMILY.medium,
  "600": FONT_FAMILY.semibold,
  "700": FONT_FAMILY.bold,
  "800": FONT_FAMILY.bold,
  "900": FONT_FAMILY.bold,
  normal: FONT_FAMILY.regular,
  bold: FONT_FAMILY.bold,
};

function resolvePoppinsFamily(style: any): string {
  const flat = StyleSheet.flatten(style) as { fontFamily?: string; fontWeight?: string | number } | undefined;
  if (flat?.fontFamily) return flat.fontFamily;
  const w = flat?.fontWeight;
  if (w !== undefined && w !== null) return POPPINS_BY_WEIGHT[String(w)] ?? FONT_FAMILY.regular;
  return FONT_FAMILY.regular;
}

// Wrap Text.render so every <Text> picks the correct Poppins face from its
// fontWeight automatically. Callers can still override by passing fontFamily.
const OriginalRender = (Text as any).render;
if (OriginalRender && !(Text as any).__poppinsPatched) {
  (Text as any).render = function patchedRender(this: any, ...args: any[]) {
    const element = OriginalRender.apply(this, args);
    if (!element) return element;
    const family = resolvePoppinsFamily(element.props?.style);
    return React.cloneElement(element, {
      style: [{ fontFamily: family }, element.props?.style],
    });
  };
  (Text as any).__poppinsPatched = true;
}

// Always start in the (auth) group so we never flash protected content
// before checkAuth resolves. The AuthGate redirects to (tabs) if a session
// already exists.
export const unstable_settings = { anchor: "(auth)" };

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  React.useEffect(() => {
    checkAuth();
    // Start the offline-queue drainer once, at app startup.
    const stop = startAutoDrain();
    return stop;
  }, [checkAuth]);

  React.useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.text} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthGate />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.bg },
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
          <StatusBar style="dark" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
