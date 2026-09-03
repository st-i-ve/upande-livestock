import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { TimeField, toHHMM, toISODate } from "@/components/DateTimeField";
import { Field, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { APP } from "@/constants/theme";
import type { MilkSession } from "@/src/frappe/milkRecording";
import { useColors } from "@/src/hooks/useColors";
import { useCreateMilkRecording } from "@/src/hooks/mutations";
import { useEligibility } from "@/src/hooks/useEligibility";
import { useHerds } from "@/src/hooks/useHerds";
import { extractFrappeError } from "@/src/services/api";

/**
 * `session` is `reqd: 1` on the Milk Recording DocType and the After Submit
 * script stamps it onto the generated Stock Entry, so it cannot be dropped
 * from the payload. Nobody at the parlour thinks in AM/PM though — they know
 * what time they milked. The time is what gets asked for; the session is read
 * off it.
 */
const sessionForTime = (hhmm: string): MilkSession => {
  const h = Number(hhmm.split(":")[0]) || 0;
  if (h < 12) return "AM — Morning";
  if (h < 17) return "PM — Afternoon";
  return "Evening";
};

export default function Milk() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const { data: herds = [] } = useHerds();
  const { data: eligibility } = useEligibility();
  const mutation = useCreateMilkRecording();

  // Only herds that actually produce milk. The backend derives this list from
  // Herd Movement settings; the `custom_is_milking` flag is the fallback until
  // it loads, so a slow response never offers a dry herd.
  const milkingHerds = useMemo(() => {
    const fromServer = eligibility?.milking_herds ?? [];
    const names = fromServer.length
      ? fromServer
      : herds.filter((h) => h.isMilking).map((h) => h.n);
    return names.slice().sort();
  }, [eligibility, herds]);

  const [herd, setHerd] = useState("");
  // The date is not asked for: milk is recorded at the parlour, for the
  // milking that just happened.
  const [date] = useState(() => toISODate(new Date()));
  const [time, setTime] = useState(() => toHHMM(new Date()));
  const [totalKg, setTotalKg] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const session = sessionForTime(time);
  const kg = Number(totalKg) || 0;
  const canSubmit = !!herd && kg > 0 && !mutation.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    // Submit the Herds doc's `herd_name` as the Link value — that is what the
    // field points at, even though this schema names the doc the same thing.
    const herdDoc = herds.find((h) => h.n === herd);
    try {
      await mutation.mutateAsync({
        herd: herdDoc?.herdName ?? herd,
        session,
        recordingDate: date,
        totalYieldKg: kg,
        cowsMilked: herdDoc?.cnt || undefined,
        pricePerKg: APP.milkPriceKES,
        remarks: remarks.trim() || undefined,
      });
      router.replace("/(tabs)/record/success?name=Milk recording");
    } catch (err) {
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen title="Milk recording" subtitle="Record a herd's yield" back>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Field label="Herd">
        {milkingHerds.length ? (
          <Picker
            value={herd || "Select a milking herd"}
            onChange={(next) => setHerd(next)}
            options={milkingHerds}
          />
        ) : (
          <Text style={s.empty}>No milking herds found.</Text>
        )}
      </Field>

      <Field label="Time of milking">
        <TimeField value={time} onChange={setTime} />
      </Field>

      <Field label="Total yield (kg)">
        <Input
          value={totalKg}
          onChangeText={setTotalKg}
          keyboardType="decimal-pad"
          placeholder="0"
          returnKeyType="done"
        />
      </Field>

      <Field label="Remarks" help="Optional.">
        <Textarea
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Anything worth noting about this milking"
        />
      </Field>

      <View style={s.sessionRow}>
        <Text style={s.sessionLabel}>Session</Text>
        <Text style={s.sessionValue}>{session}</Text>
      </View>

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit"}
        onPress={submit}
        disabled={!canSubmit}
        loading={mutation.isPending}
      />
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    empty: { fontSize: 13, color: c.textMuted, paddingVertical: 10 },
    sessionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      marginBottom: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderSubtle,
    },
    sessionLabel: { fontSize: 12, color: c.textMuted },
    sessionValue: { fontSize: 12, color: c.text },
  });
