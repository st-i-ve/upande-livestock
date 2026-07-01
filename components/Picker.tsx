import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";

export function Picker<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: T[];
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={s.box}>
        <Text style={s.value} numberOfLines={1}>{value}</Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={c.textMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            {options.map((o) => (
              <Pressable
                key={o}
                onPress={() => { onChange(o); setOpen(false); }}
                style={({ pressed }) => [s.option, pressed && { backgroundColor: c.bgMuted }]}
              >
                <Text style={[s.optText, o === value && { fontWeight: "700", color: c.text }]}>{o}</Text>
                {o === value ? <MaterialCommunityIcons name="check" size={18} color={c.text} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    box: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      backgroundColor: c.bg,
      gap: 8,
    },
    value: { flex: 1, fontSize: 13, color: c.text },
    backdrop: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: c.bg,
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
    optText: { flex: 1, fontSize: 14, color: c.text },
  });
