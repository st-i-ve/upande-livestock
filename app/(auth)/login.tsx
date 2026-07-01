import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  const [showUrl, setShowUrl] = useState(false);

  const instanceUrl = useAuthStore((st) => st.instanceUrl);
  const storedEmail = useAuthStore((st) => st.email);
  const login = useAuthStore((st) => st.login);

  // Editable mirror of the stored URL. Persists via the login flow.
  const [url, setUrl] = useState(instanceUrl);

  useEffect(() => {
    if (storedEmail && !email) setEmail(storedEmail);
  }, [storedEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (instanceUrl && !url) setUrl(instanceUrl);
  }, [instanceUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async () => {
    if (loading) return;
    setError(null);
    if (!url.trim()) {
      // Surface the hidden field so the user can supply the missing URL.
      setShowUrl(true);
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

  const logoImage = (
    <Image
      source={require("../../assets/images/upande_logo_no_bg.png")}
      style={s.logo}
      resizeMode="contain"
    />
  );

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
                  <Pressable
                    delayLongPress={REVEAL_HOLD_MS}
                    onLongPress={() => setShowUrl(true)}
                  >
                    {dark ? <View style={s.logoCircle}>{logoImage}</View> : logoImage}
                  </Pressable>
                  <Text style={s.title}>Upande Livestock</Text>
                </View>

                {showUrl ? (
                  <TextInput
                    mode="outlined"
                    label="Frappe site URL"
                    value={url}
                    onChangeText={setUrl}
                    placeholder={INSTANCE_URL_PLACEHOLDER}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="next"
                    outlineStyle={s.outline}
                    textColor={c.text}
                    theme={inputTheme}
                    style={s.input}
                  />
                ) : null}

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

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    background: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingTop: 40 },
    content: { width: FIELD_WIDTH, alignSelf: "center" },
    header: { alignItems: "center", marginBottom: 40 },
    logo: { width: 200, height: 200 },
    logoCircle: {
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: "#ffffff",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 15,
    },
    title: {
      color: c.text,
      letterSpacing: 1,
      fontSize: 40,
      lineHeight: 48,
      marginTop: 6,
    },
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
