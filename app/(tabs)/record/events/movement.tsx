import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { COLORS, RADIUS } from "@/constants/theme";
import type { Animal } from "@/types";
import { useAuthStore } from "@/src/auth/authStore";
import { useHerds } from "@/src/hooks/useHerds";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { extractFrappeError, todayISO } from "@/src/services/api";

const REASONS = ["Routine age-out", "Repro status", "Other"] as const;

export default function Movement() {
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);
  const { data: herds = [] } = useHerds();

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [toHerd, setToHerd] = useState<string>("");
  const [reason, setReason] = useState<typeof REASONS[number]>("Routine age-out");
  const [otherReason, setOtherReason] = useState("");
  const [selected, setSelected] = useState<Animal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fromHerd = selected.length === 0
    ? "—"
    : Array.from(new Set(selected.map((a) => a.herd))).length === 1
      ? selected[0].herd
      : "Mixed (per animal)";

  // Default the destination herd once the herd list arrives.
  React.useEffect(() => {
    if (!toHerd && herds.length) setToHerd(herds[0].n);
  }, [herds, toHerd]);

  const mutation = useCreateAnimalEvent();
  const removeOne = (id: string) => setSelected((prev) => prev.filter((a) => a.id !== id));

  const handleSubmit = async () => {
    setError(null);
    if (!operator) {
      setError("Pick the operator (your Employee record) before submitting.");
      return;
    }
    if (selected.length === 0) {
      setError("Pick at least one animal.");
      return;
    }
    if (!toHerd) {
      setError("Pick a destination herd.");
      return;
    }
    // Persist operator override so the next form pre-fills it.
    if (operator !== defaultOperator) await setStoredOperator(operator);

    const remarks = reason === "Other" ? otherReason : reason;
    // One Animal Event per moved animal — server script updates per-animal
    // current_herd. We sequence rather than parallelize so a partial failure
    // gives the user a clear "X of Y moved" message.
    let succeeded = 0;
    let queued = 0;
    for (const a of selected) {
      try {
        const r = await mutation.mutateAsync({
          eventType: "Movement",
          animal: a.id,
          currentHerd: a.herd,
          toHerd,
          operator,
          eventDate: todayISO(),
          remarks,
        });
        if (r.queued) queued += 1;
        else succeeded += 1;
      } catch (err) {
        setError(
          `${succeeded} of ${selected.length} moved. Stopped at ${a.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }
    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} moved to ${toHerd}`);
    if (queued) parts.push(`${queued} queued (offline)`);
    Alert.alert("Movement recorded", parts.join(" · "));
    router.replace(`/(tabs)/record/success?name=Movement`);
  };

  return (
    <Screen title="Movement" subtitle="Move animals between herds" back>
      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>

      <Field label="Animals to move" help="Search by tag, or open the By herd tab to grab a whole herd.">
        <AnimalPickerButton
          mode="multi"
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Select one or many..."}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>

      {selected.length > 0 ? (
        <>
          <SectionTitle>Selected ({selected.length})</SectionTitle>
          <View style={s.box}>
            {selected.map((a) => (
              <View key={a.id} style={s.selRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.selName} numberOfLines={1}>{a.name} <Text style={s.selId}>{a.id}</Text></Text>
                  <Text style={s.selMeta} numberOfLines={1}>{a.herd}</Text>
                </View>
                <Pressable onPress={() => removeOne(a.id)} hitSlop={10} style={s.remove}>
                  <MaterialCommunityIcons name="close" size={16} color={COLORS.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <FieldRow>
        <Field label="From herd (auto)" style={{ flex: 1 }}>
          <Input value={fromHerd} editable={false} />
        </Field>
        <Field label="To herd" style={{ flex: 1 }}>
          <Picker value={toHerd || (herds[0]?.n ?? "")} onChange={setToHerd} options={herds.map((h) => h.n)} />
        </Field>
      </FieldRow>
      <Field label="Date"><Input value={todayISO()} editable={false} /></Field>

      <Field label="Reason">
        <Chips>
          {REASONS.map((r) => (
            <Chip key={r} label={r} active={reason === r} onPress={() => setReason(r)} />
          ))}
        </Chips>
      </Field>
      {reason === "Other" ? (
        <Field label="Reason details" help="Tell the next operator why you moved these animals.">
          <Textarea value={otherReason} onChangeText={setOtherReason} placeholder="e.g. Quarantine due to ringworm outbreak" />
        </Field>
      ) : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit move"}
        disabled={mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  box: {
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: 12,
  },
  selRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
  },
  selName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  selId: { fontFamily: "monospace", fontSize: 11, fontWeight: "400", color: COLORS.textSubtle },
  selMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  remove: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
});
