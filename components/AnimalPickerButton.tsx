import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import type { Animal } from "@/types";

import { AnimalPickerSheet, type PickerMode } from "./AnimalPickerSheet";

export function AnimalPickerButton({
  placeholder = "Search animal...",
  mode = "single",
  title = "Select animal",
  include,
  emptyAction,
  onPickSingle,
  onPickMulti,
  /** Current selection so reopening the picker keeps prior choices. */
  value,
}: {
  placeholder?: string;
  mode?: PickerMode;
  title?: string;
  include?: (a: Animal) => boolean;
  emptyAction?: { label: string; onPress: () => void };
  onPickSingle?: (a: Animal) => void;
  onPickMulti?: (list: Animal[]) => void;
  value?: Animal | Animal[] | null;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState<string | null>(() => deriveLabel(mode, value));

  const initialIds: string[] | undefined = Array.isArray(value)
    ? value.map((a) => a.id)
    : value
      ? [value.id]
      : undefined;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={s.btn}>
        <MaterialCommunityIcons name="magnify" size={16} color={c.textMuted} />
        <Text style={[s.text, label ? { color: c.text } : null]} numberOfLines={1}>
          {label || placeholder}
        </Text>
      </Pressable>
      <AnimalPickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        mode={mode}
        title={title}
        include={include}
        emptyAction={emptyAction}
        initialSelectedIds={initialIds}
        onPickSingle={(a) => {
          setLabel(`${a.name} · ${a.id}`);
          onPickSingle?.(a);
        }}
        onPickMulti={(l) => {
          setLabel(l.length ? `${l.length} selected — tap to change` : null);
          onPickMulti?.(l);
        }}
      />
    </>
  );
}

function deriveLabel(mode: PickerMode, value: Animal | Animal[] | null | undefined): string | null {
  if (!value) return null;
  if (mode === "single" && !Array.isArray(value)) return `${value.name} · ${value.id}`;
  if (mode === "multi" && Array.isArray(value) && value.length > 0)
    return `${value.length} selected — tap to change`;
  return null;
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    btn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 11,
      paddingVertical: 11,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      backgroundColor: c.bg,
    },
    text: { flex: 1, fontSize: 13, color: c.textMuted },
  });
