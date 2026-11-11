import { router } from "expo-router";
import React, { useMemo } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { LivestockLogo } from "@/components/LivestockLogo";
import { Screen } from "@/components/Screen";
import { font } from "@/constants/theme";
import { rationEditorUrl } from "@/src/auth/roles";
import { useAuthStore } from "@/src/auth/authStore";
import { useColors } from "@/src/hooks/useColors";

/**
 * Where a user whose only livestock role is Livestock Nutritionist lands. The
 * server lets that role read no animals and move no stock, so every screen of
 * this app would be refused; their work (rations, the feed library) is in the
 * web app's Ration Editor.
 */
export default function Nutritionist() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const instanceUrl = useAuthStore((st) => st.instanceUrl);
  const fullname = useAuthStore((st) => st.fullname);
  const logout = useAuthStore((st) => st.logout);

  return (
    <Screen title="Upande Livestock" subtitle={fullname || undefined}>
      <View style={s.center}>
        <LivestockLogo size={140} />
        <Text style={s.title}>Your work is in the web app</Text>
        <Text style={s.body}>
          You are signed in as a Livestock Nutritionist. Rations are balanced in the Ration Editor and
          the feed library is kept there too, on the web. This app is for recording animals and
          feeding herds, which your role does not do.
        </Text>
        <Text style={s.body}>
          If you should also record on the farm, ask a Livestock Manager to give you a farm role.
        </Text>
      </View>
      <Button label="Open the Ration Editor" onPress={() => Linking.openURL(rationEditorUrl(instanceUrl))} />
      <View style={{ height: 10 }} />
      <Button label="Settings" variant="outline" onPress={() => router.push("/mobile-kit/settings")} />
      <View style={{ height: 10 }} />
      <Button label="Log out" variant="link" onPress={() => logout()} />
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    center: { alignItems: "center", paddingVertical: 24, gap: 12 },
    title: { fontSize: 18, color: c.text, ...font("600"), textAlign: "center" },
    body: { fontSize: 14, lineHeight: 21, color: c.textMuted, textAlign: "center", ...font("400") },
  });
