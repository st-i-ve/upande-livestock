import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { COLORS, FONT_FAMILY } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import { extractFrappeError } from "@/src/services/api";
import { INSTANCE_URL_PLACEHOLDER } from "@/src/services/storage";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [obscure, setObscure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const instanceUrl = useAuthStore((s) => s.instanceUrl);
  const storedEmail = useAuthStore((s) => s.email);
  const login = useAuthStore((s) => s.login);

  // Editable mirror of the stored URL. Persists via the login flow.
  const [url, setUrl] = useState(instanceUrl);

  useEffect(() => {
    if (storedEmail && !email) setEmail(storedEmail);
  }, [storedEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Pick up any value loaded from storage after first paint.
    if (instanceUrl && !url) setUrl(instanceUrl);
  }, [instanceUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async () => {
    if (loading) return;
    setError(null);
    if (!url.trim()) {
      setError("Enter the Frappe instance URL.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Enter email and password.");
      return;
    }
    setLoading(true);
    try {
      // login() persists the URL to storage as a side-effect of api.login(),
      // and also writes it through the auth store. So once a session is
      // started, the URL is remembered until the user changes it here again.
      await login(email.trim(), password, url.trim());
    } catch (err) {
      setError(extractFrappeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("../../assets/images/home_bg.png")}
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
                  <Image
                    source={require("../../assets/images/upande_logo_no_bg.png")}
                    style={s.logo}
                    resizeMode="contain"
                  />
                  <Text style={s.title}>Upande Livestock</Text>
                </View>

                <View style={s.field}>
                  <TextInput
                    value={url}
                    onChangeText={setUrl}
                    placeholder={INSTANCE_URL_PLACEHOLDER}
                    placeholderTextColor={COLORS.textSubtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="next"
                    style={s.input}
                  />
                  <Text style={s.fieldHint}>
                    Frappe site URL. Saved on sign-in; change here any time.
                  </Text>
                </View>

                <View style={s.field}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter email"
                    placeholderTextColor={COLORS.textSubtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                    style={s.input}
                  />
                </View>

                <View style={s.field}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter password"
                    placeholderTextColor={COLORS.textSubtle}
                    secureTextEntry={obscure}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    style={[s.input, { paddingRight: 44 }]}
                  />
                  <Pressable onPress={() => setObscure((v) => !v)} hitSlop={10} style={s.eye}>
                    <MaterialCommunityIcons
                      name={obscure ? "eye" : "eye-off"}
                      size={20}
                      color={COLORS.textMuted}
                    />
                  </Pressable>
                </View>

                {error ? <Text style={s.error}>{error}</Text> : null}

                <Button label="Login" onPress={handleLogin} loading={loading} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  background: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingTop: 40 },
  content: { width: "100%", maxWidth: 400, alignSelf: "center" },
  header: { alignItems: "center", marginBottom: 32 },
  logo: { width: 180, height: 180 },
  title: {
    color: COLORS.text,
    letterSpacing: 1,
    fontFamily: FONT_FAMILY.regular,
    fontSize: 36,
    lineHeight: 44,
    marginTop: 6,
  },
  field: { marginBottom: 14, position: "relative" },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 14,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.regular,
  },
  fieldHint: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.regular,
    marginTop: 6,
    paddingHorizontal: 18,
  },
  eye: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  error: {
    color: COLORS.danger,
    fontSize: 12,
    marginBottom: 8,
    textAlign: "center",
  },
});
