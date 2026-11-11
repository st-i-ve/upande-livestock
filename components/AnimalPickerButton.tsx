import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RADIUS, font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useLocalAnimal } from "@/src/hooks/useLocalAnimal";
import { useLockedAnimalId } from "@/src/hooks/useRecordContext";
import type { Animal } from "@/types";

import { AnimalImage } from "./AnimalImage";
import { AnimalPickerSheet, type PickerMode } from "./AnimalPickerSheet";

/**
 * Every record screen picks its animals here. Opened from an animal's page
 * (see useLockedAnimalId) the screen records for her alone, so this is a fixed
 * card instead: no picker, nothing to add, change or remove.
 */
export function AnimalPickerButton(props: Parameters<typeof FreePicker>[0]) {
  const lockedId = useLockedAnimalId();
  if (lockedId) return <LockedAnimalCard id={lockedId} value={props.value} />;
  return <FreePicker {...props} />;
}

function LockedAnimalCard({ id, value }: { id: string; value?: Animal | Animal[] | null }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const held = (Array.isArray(value) ? value : value ? [value] : []).find((a) => a.id === id);
  const { data } = useLocalAnimal(held ? undefined : id);
  const a = held ?? (data as Animal | null | undefined) ?? null;
  return (
    <View style={[s.btn, s.btnChosen, s.card]} accessibilityLabel={`Recording for ${a?.name ?? id}`} testID="locked-animal">
      <AnimalImage image={a?.image} thumb={a?.thumb} animal={a ?? { id }} style={s.photo} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.name} numberOfLines={1}>{a?.name || id}</Text>
        <Text style={s.meta} numberOfLines={1}>
          {[id, a?.herd || (a ? "no herd" : "")].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <MaterialCommunityIcons name="lock-outline" size={16} color={c.selected} />
    </View>
  );
}

function FreePicker({
  placeholder = "Search animal...",
  mode = "single",
  title = "Select animal",
  include,
  preferHerds,
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
  /** Herds whose animals are listed first. */
  preferHerds?: Set<string>;
  emptyAction?: { label: string; onPress: () => void };
  onPickSingle?: (a: Animal) => void;
  onPickMulti?: (list: Animal[]) => void;
  value?: Animal | Animal[] | null;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  const [picked, setLabel] = useState<string | null>(() => deriveLabel(mode, value));
  // A screen that passes `value` owns the selection: when it clears or changes
  // it (after a save, or Skip on the recently-weighed warning) the label follows.
  const label = value !== undefined ? deriveLabel(mode, value) : picked;
  const chosen = !!label;

  const initialIds: string[] | undefined = Array.isArray(value)
    ? value.map((a) => a.id)
    : value
      ? [value.id]
      : undefined;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[s.btn, chosen && s.btnChosen]}>
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
        preferHerds={preferHerds}
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
    btnChosen: { borderWidth: 1.5, borderColor: c.selected, backgroundColor: c.selectedBg },
    text: { flex: 1, fontSize: 13, color: c.textMuted },
    card: { paddingVertical: 9 },
    photo: { width: 40, height: 40, borderRadius: 20 },
    name: { fontSize: 14, ...font("600"), color: c.text },
    meta: { fontSize: 12, color: c.textMuted, marginTop: 1 },
  });
