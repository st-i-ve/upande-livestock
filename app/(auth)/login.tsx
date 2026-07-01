import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  useColorScheme,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { BANNER_COLORS } from "@/constants/paperTheme";
import { useColors } from "@/src/hooks/useColors";
import { useAuthStore } from "@/src/auth/authStore";
import { extractFrappeError } from "@/src/services/api";
import { INSTANCE_URL_PLACEHOLDER } from "@/src/services/storage";

// Login form fields never grow past 80% of the screen width so they stay
// comfortable to read on tablets and large phones.
const FIELD_WIDTH = Math.min(Math.round(Dimensions.get("window").width * 0.8), 400);
// How long the logo must be held to reveal the hidden instance-URL field.
const REVEAL_HOLD_MS = 3000;
// The URL field collapses back into the logo after this long with no activity.
const IDLE_HIDE_MS = 5000;
// Fully-expanded height of the URL field row (input + spacing below).
const URL_FIELD_HEIGHT = 72;

export default function LoginScreen() {
  const c = useColors();
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const s = useMemo(() => makeStyles(c), [c]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [obscure, setObscure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The instance URL is an advanced setting, hidden until the logo is held.
  const [urlRevealed, setUrlRevealed] = useState(false);

  const instanceUrl = useAuthStore((st) => st.instanceUrl);
  const storedEmail = useAuthStore((st) => st.email);
  const login = useAuthStore((st) => st.login);

  // Editable mirror of the stored URL. Persists via the login flow.
  const [url, setUrl] = useState(instanceUrl);
  const hasInstance = !!url.trim();

  // Reveal animation: 0 = URL hidden (ring shown), 1 = URL shown (ring gone).
  const reveal = useRef(new Animated.Value(0)).current;
  const urlInputRef = useRef<RNTextInput | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (storedEmail && !email) setEmail(storedEmail);
  }, [storedEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (instanceUrl && !url) setUrl(instanceUrl);
  }, [instanceUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const hideUrl = () => {
    clearHideTimer();
    urlInputRef.current?.blur();
    setUrlRevealed(false);
    Animated.timing(reveal, {
      toValue: 0,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  // Collapse after a period of inactivity, but only while the field is not
  // actively focused (a live cursor counts as activity).
  const armHideTimer = () => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      if (!focusedRef.current) hideUrl();
    }, IDLE_HIDE_MS);
  };

  const revealUrl = () => {
    if (urlRevealed) return;
    setUrlRevealed(true);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) urlInputRef.current?.focus();
    });
    // Fallback: if focus never lands, still collapse after the idle window.
    armHideTimer();
  };

  useEffect(() => clearHideTimer, []);

  const handleLogin = async () => {
    if (loading) return;
    setError(null);
    if (!url.trim()) {
      // Surface the hidden field so the user can supply the missing URL.
      revealUrl();
      setError("Enter the Frappe instance URL.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Enter email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password, url.trim());
    } catch (err) {
      setError(extractFrappeError(err));
    } finally {
      setLoading(false);
    }
  };

  // Paper TextInput theming for the outlined pill inputs.
  const inputTheme = {
    roundness: 50,
    colors: {
      background: c.bg,
      onSurfaceVariant: c.textMuted, // label / placeholder
      primary: c.text, // active outline + label
    },
  } as const;

  const banner = BANNER_COLORS[dark ? "dark" : "light"].error;

  // Ring shrinks into the logo and fades as the URL field rolls open.
  const ringScale = reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });
  const ringOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const urlHeight = reveal.interpolate({ inputRange: [0, 1], outputRange: [0, URL_FIELD_HEIGHT] });

  return (
    <ImageBackground
      source={
        dark
          ? require("../../assets/images/home_bg_d.png")
          : require("../../assets/images/home_bg.png")
      }
      style={s.background}
      resizeMode="cover"
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom", "left", "right"]}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={s.container}
            keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
          >
            <ScrollView
              contentContainerStyle={s.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.content}>
                <View style={s.header}>
                  <Pressable delayLongPress={REVEAL_HOLD_MS} onLongPress={revealUrl}>
                    <View style={s.logoBox}>
                      {dark ? <View style={s.disc} /> : null}
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          s.ring,
                          {
                            borderColor: c.text,
                            borderStyle: hasInstance ? "solid" : "dotted",
                            opacity: ringOpacity,
                            transform: [{ scale: ringScale }],
                          },
                        ]}
                      />
                      <Image
                        source={require("../../assets/images/upande_logo_no_bg.png")}
                        style={s.logo}
                        resizeMode="contain"
                      />
                    </View>
                  </Pressable>
                  <Text style={s.title}>Upande Livestock</Text>
                </View>

                <Animated.View
                  pointerEvents={urlRevealed ? "auto" : "none"}
                  style={{ height: urlHeight, opacity: reveal, overflow: "hidden" }}
                >
                  <TextInput
                    ref={urlInputRef as any}
                    mode="outlined"
                    label="Frappe site URL"
                    value={url}
                    onChangeText={setUrl}
                    placeholder={INSTANCE_URL_PLACEHOLDER}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="next"
                    onFocus={() => {
                      focusedRef.current = true;
                      clearHideTimer();
                    }}
                    onBlur={() => {
                      focusedRef.current = false;
                      armHideTimer();
                    }}
                    outlineStyle={s.outline}
                    textColor={c.text}
                    theme={inputTheme}
                    style={s.urlInput}
                  />
                </Animated.View>

                <TextInput
                  mode="outlined"
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  outlineStyle={s.outline}
                  textColor={c.text}
                  theme={inputTheme}
                  style={s.input}
                />

                <TextInput
                  mode="outlined"
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={obscure}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  outlineStyle={s.outline}
                  textColor={c.text}
                  theme={inputTheme}
                  style={s.input}
                  right={
                    <TextInput.Icon
                      icon={obscure ? "eye" : "eye-off"}
                      onPress={() => setObscure((v) => !v)}
                      color={c.textMuted}
                    />
                  }
                />

                {error ? (
                  <View style={[s.banner, { backgroundColor: banner.bg }]}>
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={22}
                      color={banner.fg}
                      style={{ marginTop: 1 }}
                    />
                    <Text style={[s.bannerText, { color: banner.fg }]}>{error}</Text>
                  </View>
                ) : null}

                <Button label="Login" onPress={handleLogin} loading={loading} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    </ImageBackground>
  );
}

const RING = 220;
const DISC = 190;
const LOGO = 168;

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    background: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingTop: 40 },
    content: { width: FIELD_WIDTH, alignSelf: "center" },
    header: { alignItems: "center", marginBottom: 40 },
    logoBox: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
    ring: {
      position: "absolute",
      width: RING,
      height: RING,
      borderRadius: RING / 2,
      borderWidth: 3,
    },
    disc: {
      position: "absolute",
      width: DISC,
      height: DISC,
      borderRadius: DISC / 2,
      backgroundColor: "#ffffff",
    },
    logo: { width: LOGO, height: LOGO },
    title: {
      color: c.text,
      letterSpacing: 1,
      fontSize: 40,
      lineHeight: 48,
      marginTop: 6,
    },
    urlInput: { marginBottom: 16, backgroundColor: c.bg },
    input: { marginBottom: 14, backgroundColor: c.bg },
    outline: { borderRadius: 50 },
    banner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 4,
      marginBottom: 8,
      padding: 14,
      borderRadius: 14,
    },
    bannerText: { flex: 1, fontSize: 14, lineHeight: 20 },
  });
