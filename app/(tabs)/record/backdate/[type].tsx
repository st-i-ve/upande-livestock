import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { DateField } from "@/components/DateTimeField";
import { Field, Textarea } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useScheme } from "@/src/theme/themeStore";
import { useOperator } from "@/src/hooks/useOperator";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";
import {
  BACKDATE_AMBER_DARK,
  BACKDATE_AMBER_LIGHT,
} from "@/components/BackdateButton";

// Verbatim per the spec — do not reword, including the em dash.
const WARNING =
  "This is a backdating page. You are not affecting stocks — apply wisely. " +
  "The system will run through afterwards.";

/**
 * One capture form for every event type: which animal, what date it actually
 * happened, and any remarks. It posts through the exact same
 * `record_animal_event` endpoint a live entry uses — `useCreateAnimalEvent` —
 * with a past `eventDate`. The server (not this page) decides what that means:
 * it stamps `custom_is_backdated`, skips the Stock Entry for every event type
 * but Feeding, and refuses the write outright if a manager has not opened the
 * backdating window on Livestock Settings. That refusal comes back as a plain
 * message via `extractFrappeError` and is shown as-is below — it is a manager
 * action, not a bug in this screen.
 *
 * Event types with their own required fields beyond animal/date/remarks (a
 * Movement's destination herd, a Calving's outcome, a Pregnancy Diagnosis's
 * result, and so on) are not collected on this generic page — submitting one
 * of those here surfaces whatever the server requires as a plain error.
 */
export default function Backdate() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const c = useColors();
  const amber = useScheme() === "dark" ? BACKDATE_AMBER_DARK : BACKDATE_AMBER_LIGHT;
  const s = useMemo(() => makeStyles(c, amber), [c, amber]);

  const { operator, missingMessage } = useOperator();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [eventDate, setEventDate] = useState<string>(todayISO());
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const record = useCreateAnimalEvent();

  const submit = async () => {
    setError(null);
    if (!animal) return setError("Choose an animal.");
    if (!operator) return setError(missingMessage);
    try {
      const r = await record.mutateAsync({
        eventType: type as any,
        animal: animal.id,
        currentHerd: animal.herd ?? "",
        operator,
        eventDate,
        remarks: remarks || undefined,
      } as any);
      Alert.alert(
        "Backdated record saved",
        r.queued ? "Queued — will sync once you're back online." : `Recorded for ${eventDate}.`,
      );
      router.replace(`/(tabs)/record/success?name=${encodeURIComponent(`Backdated ${type}`)}`);
    } catch (e) {
      setError(extractFrappeError(e));
    }
  };

  return (
    <Screen title={`Backdate · ${type}`} subtitle="Record it for the day it happened" back>
      <View style={s.warning}>
        <MaterialCommunityIcons name="alert-outline" size={16} color={amber} style={{ marginTop: 1 }} />
        <Text style={s.warningText}>{WARNING}</Text>
      </View>

      <Field label="Animal">
        <AnimalPickerButton value={animal} onPickSingle={setAnimal} />
      </Field>

      <Field label="Date it happened">
        <DateField value={eventDate} onChange={setEventDate} maximumDate={new Date()} />
      </Field>

      <Field label="Remarks">
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Optional" />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={record.isPending ? "Recording…" : "Record"}
        onPress={submit}
        disabled={record.isPending}
        loading={record.isPending}
      />
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>, amber: string) =>
  StyleSheet.create({
    warning: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      borderWidth: 1,
      borderColor: amber,
      backgroundColor: `${amber}14`,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 16,
    },
    warningText: { flex: 1, color: amber, fontSize: 13, lineHeight: 19 },
  });
