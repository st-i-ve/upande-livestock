// components/AttachmentPicker.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS, FONT_FAMILY, RADIUS } from "@/constants/theme";
import type { FileAsset } from "@/src/frappe/files";

/**
 * Multi-file picker for post-mortem attachments. Returns assets the
 * caller can pass to attachFile() after the parent doc is created.
 *
 * Hard cap of 10 MB per file (Frappe's default Site config).
 */
export function AttachmentPicker({
  value,
  onChange,
  label = "Attachments",
  helpText = "Tap to pick PDF or image. Max 10 MB.",
}: {
  value: FileAsset[];
  onChange: (assets: FileAsset[]) => void;
  label?: string;
  helpText?: string;
}) {
  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const next: FileAsset[] = [...value];
    for (const a of result.assets) {
      if (a.size && a.size > 10 * 1024 * 1024) {
        // Silently skip oversize. The component renders a hint below.
        continue;
      }
      next.push({
        uri: a.uri,
        name: a.name,
        mimeType: a.mimeType || "application/octet-stream",
      });
    }
    onChange(next);
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <View style={s.box}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.help}>{helpText}</Text>
      {value.map((a, i) => (
        <View key={`${a.uri}-${i}`} style={s.row}>
          <MaterialCommunityIcons name="paperclip" size={14} color={COLORS.textMuted} />
          <Text style={s.fileName} numberOfLines={1}>{a.name}</Text>
          <Pressable onPress={() => remove(i)} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={14} color={COLORS.textMuted} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={pick} style={s.btn}>
        <MaterialCommunityIcons name="plus" size={14} color={COLORS.text} />
        <Text style={s.btnText}>Add file</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 10,
    gap: 6,
  },
  label: { fontSize: 12, color: COLORS.textMuted, fontFamily: FONT_FAMILY.medium },
  help: { fontSize: 11, color: COLORS.textSubtle },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  fileName: { flex: 1, fontSize: 12, color: COLORS.text },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.md,
  },
  btnText: { fontSize: 12, color: COLORS.text, fontFamily: FONT_FAMILY.medium },
});
