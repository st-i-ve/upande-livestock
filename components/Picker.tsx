import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS } from "@/constants/theme";

export function Picker<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: T[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={s.box}>
        <Text style={s.value} numberOfLines={1}>{value}</Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={COLORS.textMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            {options.map((o) => (
              <Pressable
                key={o}
                onPress={() => { onChange(o); setOpen(false); }}
                style={({ pressed }) => [s.option, pressed && { backgroundColor: COLORS.bgMuted }]}
              >
                <Text style={[s.optText, o === value && { fontWeight: "700", color: COLORS.text }]}>{o}</Text>
                {o === value ? <MaterialCommunityIcons name="check" size={18} color={COLORS.text} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    gap: 8,
  },
  value: { flex: 1, fontSize: 13, color: COLORS.text },
  backdrop: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingVertical: 8,
    paddingBottom: 24,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optText: { flex: 1, fontSize: 14, color: COLORS.text },
});
