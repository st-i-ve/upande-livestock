import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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
import { COLORS, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import { extractFrappeError } from "@/src/services/api";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [obscure, setObscure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);

  const instanceUrl = useAuthStore((s) => s.instanceUrl);
  const storedEmail = useAuthStore((s) => s.email);
  const setInstanceUrl = useAuthStore((s) => s.setInstanceUrl);
  const login = useAuthStore((s) => s.login);

  const [urlDraft, setUrlDraft] = useState(instanceUrl);

  useEffect(() => {
    if (storedEmail && !email) setEmail(storedEmail);
  }, [storedEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setUrlDraft(instanceUrl);
  }, [instanceUrl]);

  const handleLogin = async () => {
    if (loading) return;
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password, instanceUrl);
      // _layout AuthGate routes to /(tabs) when isAuthenticated flips.
    } catch (err) {
      setError(extractFrappeError(err));
    } finally {
      setLoading(false);
    }
  };

  const saveDevUrl = async () => {
    await setInstanceUrl(urlDraft);
    setDevOpen(false);
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
                  <Pressable onLongPress={() => setDevOpen(true)} delayLongPress={1200}>
                    <Image
                      source={require("../../assets/images/upande_logo_no_bg.png")}
                      style={s.logo}
                      resizeMode="contain"
                    />
                  </Pressable>
                  <Text style={s.title}>Upande Livestock</Text>
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

      <Modal
        visible={devOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDevOpen(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setDevOpen(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Frappe instance URL</Text>
            <Text style={s.modalSub}>
              The Frappe site this app talks to. Defaults to the Westwood
              Dairies production site.
            </Text>
            <TextInput
              value={urlDraft}
              onChangeText={setUrlDraft}
              placeholder="https://upande-kaitet2.c.frappe.cloud"
              placeholderTextColor={COLORS.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              style={s.modalInput}
            />
            <View style={s.modalActions}>
              <Pressable onPress={() => setDevOpen(false)} style={s.modalBtn}>
                <Text style={s.modalBtnLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveDevUrl}
                style={[s.modalBtn, s.modalBtnPrimary]}
              >
                <Text style={[s.modalBtnLabel, { color: COLORS.bg }]}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  background: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingTop: 40 },
  content: { width: "100%", maxWidth: 400, alignSelf: "center" },
  header: { alignItems: "center", marginBottom: 40 },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    padding: 20,
    gap: 8,
  },
  modalTitle: {
    fontSize: 14,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.semibold,
  },
  modalSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 15,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.text,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  modalBtnPrimary: { backgroundColor: COLORS.text },
  modalBtnLabel: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.medium,
  },
});
