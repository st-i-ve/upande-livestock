import "@/src/theme/patchText";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { AppAlertHost } from "@/components/AppAlertHost";
import { getPaperTheme } from "@/constants/paperTheme";
import { DARK, LIGHT } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import { startAutoDrain } from "@/src/offline/autoDrain";
import { queryClient } from "@/src/services/queryClient";
import { useScheme, useThemeStore } from "@/src/theme/themeStore";

// React Navigation theme so the scene/card background matches the app theme —
// this is what removes the white flash during push/pop and tab switches.
function navTheme(dark: boolean) {
  const p = dark ? DARK : LIGHT;
  const base = dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: p.bg,
      card: p.bg,
      text: p.text,
      border: p.borderSubtle,
      primary: p.text,
    },
  };
}

// Always start in the (auth) group so we never flash protected content before
// checkAuth resolves. The AuthGate redirects to (tabs) if a session exists.
export const unstable_settings = { anchor: "(auth)" };

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

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

const paperSettings = {
  icon: (props: any) => <MaterialCommunityIcons {...props} />,
};

export default function RootLayout() {
  const scheme = useScheme();
  const dark = scheme === "dark";
  const palette = dark ? DARK : LIGHT;

  const hydrate = useThemeStore((s) => s.hydrate);
  const hydrated = useThemeStore((s) => s.hydrated);
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const authLoading = useAuthStore((s) => s.isLoading);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  React.useEffect(() => {
    hydrate();
    checkAuth();
    // Start the offline-queue drainer once, at app startup.
    const stop = startAutoDrain();
    return stop;
  }, [hydrate, checkAuth]);

  // Hold on a themed splash until fonts, theme preference, and the auth check
  // are all resolved — so we never flash the login screen on resume/cold start.
  const ready = fontsLoaded && hydrated && !authLoading;

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.bg }}>
        <ActivityIndicator size="large" color={palette.text} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.bg }}>
        <SafeAreaProvider>
          <PaperProvider theme={getPaperTheme(scheme)} settings={paperSettings}>
            <ThemeProvider value={navTheme(dark)}>
              <AuthGate />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: palette.bg },
                  animation: "fade",
                }}
              >
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
              </Stack>
              <AppAlertHost />
              <StatusBar style={dark ? "light" : "dark"} />
            </ThemeProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
