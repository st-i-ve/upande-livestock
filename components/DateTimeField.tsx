import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
// The app's own themed calendar, with the native picker's API (src/ui/datetimepicker.tsx).
import DateTimePicker from "@/src/ui/datetimepicker";

/** ISO `YYYY-MM-DD` in the device's own timezone. `toISOString()` is UTC and
 *  rolls backwards east of Greenwich: Kenya is UTC+3, so anything recorded
 *  before 03:00 local would file itself under yesterday. An early-morning weighing
 *  is the one that starts early. */
export const toISODate = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const fromISODate = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function DateField({
  value,
  onChange,
  maximumDate,
  minimumDate,
  placeholder,
}: {
  /** ISO `YYYY-MM-DD`; "" for none (an optional date). */
  value: string;
  onChange: (iso: string) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  /** Shown while `value` is "". */
  placeholder?: string;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  // Fixed while the sheet is open, so a re-render does not move it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const start = useMemo(() => (value ? fromISODate(value) : (minimumDate ?? new Date())), [value, open]);

  // OK hands back the day; Cancel, back or a tap outside calls onDismiss.
  const handle = (_event: unknown, picked: Date) => {
    setOpen(false);
    onChange(toISODate(picked));
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={value ? `Date, ${LABEL.format(fromISODate(value))}. Change` : (placeholder ?? "Pick a date")}
        style={({ pressed }) => [s.box, pressed && { backgroundColor: c.bgMuted }]}
      >
        <Text style={[s.value, !value && { color: c.textSubtle }]}>{value ? LABEL.format(fromISODate(value)) : (placeholder ?? "Pick a date")}</Text>
        <MaterialCommunityIcons name="calendar-blank-outline" size={18} color={c.textMuted} />
      </Pressable>
      {open ? (
        <DateTimePicker
          value={start}
          mode="date"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onValueChange={handle}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** `HH:mm` in the device's own timezone. */
export const toHHMM = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    box: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      backgroundColor: c.bg,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    value: { flex: 1, fontSize: 14, color: c.text },
  });
