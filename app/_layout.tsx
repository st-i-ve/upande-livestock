import "@/src/theme/patchText";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { getPaperTheme } from "@/constants/paperTheme";
import { DARK, LIGHT } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import { startAnimalSync } from "@/src/db/sync";
import { startAutoDrain } from "@/src/offline/autoDrain";
import { queryClient } from "@/src/services/queryClient";
import { useScheme, useThemeStore } from "@/src/theme/themeStore";

SplashScreen.preventAutoHideAsync().catch(() => {});

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
// checkAuth resolves. The AuthGate redirects to the Animals tab if a session
// exists — there is no tabs index route to land on.
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
      router.replace("/(tabs)/animals");
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
  const signedIn = useAuthStore((s) => s.isAuthenticated);

  const [fontsLoaded, fontError] = useFonts({
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

  // Keep the local animals current while signed in: a sync now (the full set
  // on a first run) and a delta each time the app returns to the foreground.
  React.useEffect(() => {
    if (!signedIn) return;
    return startAnimalSync();
  }, [signedIn]);

  // Who the user is on the farm's books (view-only without an Employee): asked
  // at sign-in, and again each time the app returns to the foreground so HR
  // linking an Employee, or unlinking one, reaches the phone without a re-login.
  // Offline, the last answer stands.
  const refreshEmployeeStatus = useAuthStore((s) => s.refreshEmployeeStatus);
  React.useEffect(() => {
    if (!signedIn) return;
    void refreshEmployeeStatus();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshEmployeeStatus();
    });
    return () => sub.remove();
  }, [signedIn, refreshEmployeeStatus]);

  // Hold on a themed splash until fonts, theme preference, and the auth check
  // are all resolved — so we never flash the login screen on resume/cold start.
  // A font that fails to load, or a step that never settles, must not hold the
  // app on the spinner: after a few seconds it opens anyway (system font).
  const [timedOut, setTimedOut] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, []);
  if (fontError) console.warn("[fonts] Poppins failed to load", fontError);
  const ready = timedOut || ((fontsLoaded || !!fontError) && hydrated && !authLoading);

  React.useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

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
              <StatusBar style={dark ? "light" : "dark"} />
            </ThemeProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
