import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { getPaperTheme } from "@/constants/paperTheme";
import { DARK, FONT_FAMILY, LIGHT } from "@/constants/theme";
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

type FlatTextStyle = { fontFamily?: string; fontWeight?: string | number; fontSize?: number };

function resolvePoppinsFamily(flat: FlatTextStyle | undefined): string {
  if (flat?.fontFamily) return flat.fontFamily;
  const w = flat?.fontWeight;
  if (w !== undefined && w !== null) return POPPINS_BY_WEIGHT[String(w)] ?? FONT_FAMILY.regular;
  return FONT_FAMILY.regular;
}

// Uniform type scale — every explicit font size across the app snaps to one of
// these five tiers so all screens share a single type rhythm. Sizes >= 30 pass
// through unchanged (intentional display text like the login title); Text with
// no explicit size is left alone so nested-Text inheritance still works.
//   caption 13 · body 15 · heading 17 · title 20 · display 28
function snapFontSize(size: number | undefined): number | undefined {
  if (typeof size !== "number") return undefined;
  if (size >= 30) return size;
  if (size <= 12) return 13;
  if (size <= 14) return 15;
  if (size <= 17) return 17;
  if (size <= 20) return 20;
  return 28;
}

// Wrap Text.render so every <Text> picks the correct Poppins face from its
// fontWeight and snaps to the uniform size scale. Callers can still override
// fontFamily; sizes are normalised regardless to keep the app consistent.
const OriginalRender = (Text as any).render;
if (OriginalRender && !(Text as any).__poppinsPatched) {
  (Text as any).render = function patchedRender(this: any, ...args: any[]) {
    const element = OriginalRender.apply(this, args);
    if (!element) return element;
    const flat = StyleSheet.flatten(element.props?.style) as FlatTextStyle | undefined;
    const family = resolvePoppinsFamily(flat);
    const size = snapFontSize(flat?.fontSize);
    return React.cloneElement(element, {
      style: [{ fontFamily: family }, element.props?.style, size != null ? { fontSize: size } : null],
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

// Render Paper's icons with @expo/vector-icons (which bundles the
// MaterialCommunityIcons glyphs the app already uses), so Paper doesn't require
// react-native-vector-icons font linking.
const paperSettings = {
  icon: (props: any) => <MaterialCommunityIcons {...props} />,
};

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? DARK : LIGHT;
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.bg }}>
        <ActivityIndicator size="large" color={palette.text} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider theme={getPaperTheme(scheme)} settings={paperSettings}>
            <AuthGate />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: palette.bg },
                animation: "slide_from_right",
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
            <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
