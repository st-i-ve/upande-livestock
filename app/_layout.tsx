import "@/src/ui/installAlert";
// First: configures @upande/mobile-kit before anything uses it.
import { applyKitTheme } from '../src/mobile-kit';
import { MobileKitProvider } from '@upande/mobile-kit';
import { BlurTargetRoot } from '@/components/BlurBackdrop';
import { StatusSheetHost } from '@/components/OnlineDot';
import { checkKitServer, loadKitServer, useKitServer } from '@/src/kit/kitServer';
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
import * as SystemUI from "expo-system-ui";
import React from "react";
import { ActivityIndicator, AppState, Appearance, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { AppAlertHost } from "@/components/AppAlertHost";
import { DatePickerHost } from "@/components/DatePickerHost";
import { getPaperTheme } from "@/constants/paperTheme";
import { DARK, LIGHT } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import { nutritionistOnly } from "@/src/auth/roles";
import { startAnimalSync } from "@/src/db/sync";
import { startRealtime } from "@/src/realtime/realtime";
import { queryClient } from "@/src/services/queryClient";
import { homeOf, isShoats, useAnimalType } from "@/src/shoats/animalType";
import { useLoginExit } from "@/src/logo/loginLogo";
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
  const animalType = useAnimalType((s) => s.type);
  const typeHydrated = useAnimalType((s) => s.hydrated);
  // A user whose only livestock role is Livestock Nutritionist would be refused
  // every screen here; they get one screen pointing at the web's Ration Editor.
  const nutritionist = useAuthStore((s) => nutritionistOnly(s.roles));
  // Just signed in: the login logo is playing back to the Upande mark; move on when it is done.
  const loginHeld = useLoginExit((s) => s.holding);

  React.useEffect(() => {
    if (isLoading || !typeHydrated) return;
    const top = segments[0] as string | undefined;
    const inAuthGroup = top === "(auth)";
    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup && loginHeld) {
      return;
    } else if (isAuthenticated && nutritionist) {
      if (top !== "nutritionist" && top !== "mobile-kit") router.replace("/nutritionist");
    } else if (isAuthenticated && top === "nutritionist") {
      router.replace(homeOf(animalType));
    } else if (isAuthenticated && inAuthGroup) {
      // After login: straight to the animal type the phone remembers, else ask.
      router.replace(homeOf(animalType));
    } else if (isAuthenticated && !animalType && top !== "choose") {
      router.replace("/choose");
    } else if (isAuthenticated && animalType) {
      // A switch of type leaves the other type's screens behind.
      if (top === "(tabs)" && isShoats(animalType)) router.replace(homeOf(animalType));
      else if (top === "(shoats)" && animalType === "cattle") router.replace(homeOf(animalType));
    }
  }, [isAuthenticated, isLoading, typeHydrated, animalType, segments, router, nutritionist, loginHeld]);

  return null;
}

const paperSettings = {
  icon: (props: any) => <MaterialCommunityIcons {...props} />,
};

export default function RootLayout() {
  const scheme = useScheme();
  // The kit (connection banner, its Settings) follows our theme, light or dark.
  applyKitTheme(scheme);
  // Upande Mobile: held off until the signed-in site has it (src/kit/kitServer.ts).
  // Subscribed so the kit's provider is drawn again when it switches on.
  useKitServer((k) => k.ready);
  const kitSignedIn = useAuthStore((st) => st.isAuthenticated);
  const site = useAuthStore((st) => st.instanceUrl);
  React.useEffect(() => {
    const url = site?.trim() || null;
    void loadKitServer(url).then(() => (kitSignedIn ? checkKitServer(url) : undefined));
  }, [kitSignedIn, site]);
  const dark = scheme === "dark";
  const palette = dark ? DARK : LIGHT;

  const hydrate = useThemeStore((s) => s.hydrate);
  const hydrateType = useAnimalType((s) => s.hydrate);
  const typeHydrated = useAnimalType((s) => s.hydrated);
  const hydrated = useThemeStore((s) => s.hydrated);
  const themeOverride = useThemeStore((s) => s.override);
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const authLoading = useAuthStore((s) => s.isLoading);
  const signedIn = useAuthStore((s) => s.isAuthenticated);

  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // The theme chosen in Profile > Accessibility reaches native UI too (date
  // pickers, alerts, the window behind a modal), not only our own palette.
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      Appearance.setColorScheme(themeOverride ?? "unspecified");
    } catch {
      // older native module: our own palette still follows the choice
    }
  }, [hydrated, themeOverride]);
  React.useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.bg).catch(() => {});
  }, [palette.bg]);

  React.useEffect(() => {
    hydrate();
    hydrateType();
    checkAuth();
  }, [hydrate, hydrateType, checkAuth]);

  // Keep the local animals current while signed in: a sync now (the full set
  // on a first run) and a delta each time the app returns to the foreground.
  // Not for a nutritionist-only user: the server lets that role read no animals.
  const nutritionist = useAuthStore((s) => nutritionistOnly(s.roles));
  React.useEffect(() => {
    if (!signedIn || nutritionist) return;
    return startAnimalSync();
  }, [signedIn, nutritionist]);

  // Live updates: a socket to the farm's server while signed in and in the
  // foreground, so what others record reaches this phone within seconds.
  React.useEffect(() => {
    if (!signedIn) return;
    return startRealtime();
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
  const ready = timedOut || ((fontsLoaded || !!fontError) && hydrated && typeHydrated && !authLoading);

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
    <MobileKitProvider>
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.bg }}>
        <SafeAreaProvider>
          <PaperProvider theme={getPaperTheme(scheme)} settings={paperSettings}>
            <ThemeProvider value={navTheme(dark)}>
              <AuthGate />
              {/* The app's content, which a sheet's backdrop blurs (components/BlurBackdrop). */}
              <BlurTargetRoot backgroundColor={palette.bg}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: palette.bg },
                  animation: "fade",
                }}
              >
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="choose" />
                <Stack.Screen name="nutritionist" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(shoats)" />
                <Stack.Screen name="accessibility" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              </Stack>
              </BlurTargetRoot>
              <StatusBar style={dark ? "light" : "dark"} />
              {/* Every Alert.alert, drawn over everything (src/ui/alert.ts). */}
              <AppAlertHost />
              {/* Every date/time picker, as the app's own sheet (src/ui/datetimepicker.tsx). */}
              <DatePickerHost />
              {/* The green dot's sheet, over everything, its backdrop blurring the page. */}
              <StatusSheetHost />
            </ThemeProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
    </MobileKitProvider>
  );
}
