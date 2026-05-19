import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { APP, COLORS, RADIUS } from "@/constants/theme";
import { herds } from "@/data/mock";
import type { Animal } from "@/types";

const REASONS = ["Routine age-out", "Repro status", "Other"] as const;

export default function Movement() {
  const [toHerd, setToHerd] = useState(herds[0].n);
  const [reason, setReason] = useState<typeof REASONS[number]>("Routine age-out");
  const [otherReason, setOtherReason] = useState("");
  const [selected, setSelected] = useState<Animal[]>([]);

  // Source herd is auto-derived. Show "Mixed" only when the picked animals
  // straddle multiple herds.
  const fromHerd = selected.length === 0
    ? "—"
    : Array.from(new Set(selected.map((a) => a.herd))).length === 1
      ? selected[0].herd
      : "Mixed (per animal)";

  const removeOne = (id: string) => setSelected((prev) => prev.filter((a) => a.id !== id));

  return (
    <Screen title="Movement" subtitle="Move animals between herds" back>
      <Field label="Animals to move" help="Search by tag, or open the By herd tab to grab a whole herd.">
        <AnimalPickerButton
          mode="multi"
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Select one or many..."}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>

      {/* Selected list — operator double-checks before submitting. */}
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
          <Picker value={toHerd} onChange={setToHerd} options={herds.map((h) => h.n)} />
        </Field>
      </FieldRow>
      <Field label="Date"><Input value={APP.today} /></Field>

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

      <Button
        label="Submit move"
        disabled={selected.length === 0}
        onPress={() => router.replace("/event-success?name=Movement")}
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
