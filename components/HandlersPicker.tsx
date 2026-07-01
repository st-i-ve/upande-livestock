// components/HandlersPicker.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useEmployee } from "@/src/hooks/useEmployees";

import { EmployeePickerButton } from "./EmployeePickerButton";

/**
 * Multi-select picker built on top of EmployeePickerButton. Picks one
 * employee at a time and accumulates them as removable chips. Used by
 * Dehorning's "Handlers" field.
 */
export function HandlersPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  // Use a key to reset the inner picker between additions so each pick
  // starts from a blank slate.
  const [pickerKey, setPickerKey] = useState(0);

  const add = (id: string) => {
    if (!id || value.includes(id)) {
      setPickerKey((k) => k + 1);
      return;
    }
    onChange([...value, id]);
    setPickerKey((k) => k + 1);
  };

  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  return (
    <View>
      <EmployeePickerButton
        key={pickerKey}
        value={null}
        onChange={add}
        placeholder={value.length ? "Add another handler…" : "Pick handler…"}
      />
      {value.length > 0 ? (
        <View style={s.chips}>
          {value.map((id) => (
            <HandlerChip key={id} id={id} onRemove={() => remove(id)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function HandlerChip({ id, onRemove }: { id: string; onRemove: () => void }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { data } = useEmployee(id);
  return (
    <Pressable onPress={onRemove} style={s.chip}>
      <Text style={s.chipText} numberOfLines={1}>
        {data?.employeeName || id}
      </Text>
      <MaterialCommunityIcons name="close" size={13} color={c.textMuted} />
    </Pressable>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 8,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 6,
      backgroundColor: c.bgMuted,
      borderRadius: RADIUS.md,
    },
    chipText: {
      fontSize: 12,
      color: c.text,
      fontFamily: FONT_FAMILY.medium,
      maxWidth: 160,
    },
  });
