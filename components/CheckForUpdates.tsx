import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ConfirmModal } from "@/components/ConfirmModal";
import { useColors } from "@/src/hooks/useColors";
import { appAlert } from "@/src/ui/appAlert";

const DEV_MESSAGE = __DEV__
  ? "Over-the-air updates don't run in development. Install a preview or production build to receive them."
  : "Over-the-air updates are not enabled in this build.";

// Profile row that checks for an EAS Update, shows a dot when one is available,
// and downloads + restarts on confirm. Themed with the app dialog + alerts.
export function CheckForUpdates() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const check = useCallback(async (silent: boolean) => {
    if (!Updates.isEnabled) {
      if (!silent) appAlert("Updates unavailable", DEV_MESSAGE);
      return;
    }
    try {
      setBusy(true);
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        setAvailable(true);
        if (!silent) setConfirm(true);
      } else {
        setAvailable(false);
        if (!silent) appAlert("Up to date", "You're on the latest version.");
      }
    } catch (e: any) {
      if (!silent) appAlert("Couldn't check for updates", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  // Quiet check on mount so the dot appears if an update is waiting.
  useEffect(() => {
    check(true);
  }, [check]);

  const applyUpdate = async () => {
    setConfirm(false);
    try {
      setBusy(true);
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e: any) {
      setBusy(false);
      appAlert("Update failed", e?.message ?? String(e));
    }
  };

  const onPress = () => {
    if (busy) return;
    if (available) setConfirm(true);
    else check(false);
  };

  return (
    <>
      <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: c.bgMuted }]}>
        <MaterialCommunityIcons name="cloud-download-outline" size={22} color={c.text} />
        <Text style={s.label} numberOfLines={1}>Check for updates</Text>
        {busy ? (
          <ActivityIndicator size="small" color={c.text} />
        ) : available ? (
          <View style={s.dot} />
        ) : null}
      </Pressable>

      <ConfirmModal
        visible={confirm}
        title="Update available"
        message="Download the latest version and restart the app now?"
        confirmLabel="Update"
        cancelLabel="Later"
        onConfirm={applyUpdate}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
    },
    label: { flex: 1, fontSize: 16, color: c.text },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#2ECC71" },
  });
