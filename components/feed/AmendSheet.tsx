import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Field";
import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { changedKg, fmtKg, parseKg } from "@/src/feed/daySheet";
import type { HerdDay } from "@/src/frappe/feedActuals";
import { useColors } from "@/src/hooks/useColors";

/**
 * Change the kg of any component actually fed to a herd on one day. The
 * recipe itself is never touched; only that day's actuals move. Needs the
 * server (stock is booked from these figures), so the save is off while the
 * phone is offline.
 */
export function AmendSheet({
  day,
  offline,
  saving,
  error,
  onSave,
  onReset,
  resetting,
  onClose,
}: {
  day: HerdDay;
  offline: boolean;
  saving: boolean;
  error: string | null;
  onSave: (changes: Record<string, number>, remarks: string) => void;
  /** Put the day back at the recipe. */
  onReset: () => void;
  resetting: boolean;
  onClose: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState(day.remarks);
  // Items taken out for the day: shown struck through, sent as 0, with an undo.
  const [removed, setRemoved] = useState<Set<string>>(() => new Set(day.components.filter((x) => x.removed).map((x) => x.itemCode)));
  const remove = (code: string) => {
    setRemoved((p) => new Set(p).add(code));
    setTyped((p) => ({ ...p, [code]: "0" }));
  };
  const undo = (comp: HerdDay["components"][number]) => {
    setRemoved((p) => {
      const x = new Set(p);
      x.delete(comp.itemCode);
      return x;
    });
    setTyped((p) => ({ ...p, [comp.itemCode]: String(comp.plannedKg) }));
  };
  const { changes, invalid } = changedKg(day.components, typed);
  const changed = Object.keys(changes).length > 0;
  const total = day.components.reduce((sum, comp) => {
    const raw = typed[comp.itemCode];
    const v = raw === undefined ? null : parseKg(raw);
    return sum + (v ?? comp.actualKg);
  }, 0);

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={s.scrim} onPress={onClose} />
        <View style={s.sheet}>
          <Text style={s.title}>Amend {day.herdName}</Text>
          <Text style={s.sub}>
            Kg actually fed on {day.date}. The recipe stays as it is; only this day and this herd change. Tap X on a feed that was not used at all.
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
            <View style={s.head}>
              <Text style={[s.th, { flex: 1 }]}>Component</Text>
              <Text style={[s.th, s.num]}>Plan</Text>
              <Text style={[s.th, s.box]}>Fed (kg)</Text>
              <View style={s.x} />
            </View>
            {day.components.map((comp) => {
              const raw = typed[comp.itemCode];
              const gone = removed.has(comp.itemCode);
              const bad = raw !== undefined && invalid.includes(comp.itemName);
              return (
                <View key={comp.itemCode} style={s.line}>
                  <Text style={[s.name, { flex: 1 }, gone && s.struck]} numberOfLines={2}>{comp.itemName}</Text>
                  <Text style={[s.cell, s.num, gone && s.struck]}>{fmtKg(comp.plannedKg)}</Text>
                  <View style={s.box}>
                    <Input
                      keyboardType="decimal-pad"
                      value={raw ?? String(comp.actualKg)}
                      onChangeText={(t) => setTyped((p) => ({ ...p, [comp.itemCode]: t }))}
                      selectTextOnFocus
                      editable={!gone}
                      style={[s.input, bad && { borderColor: c.danger }, gone && s.struck]}
                    />
                  </View>
                  {gone ? (
                    <Pressable style={s.x} onPress={() => undo(comp)} hitSlop={6} accessibilityLabel={`Undo removing ${comp.itemName}`}>
                      <Text style={s.undo}>Undo</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={s.x} onPress={() => remove(comp.itemCode)} hitSlop={6} accessibilityLabel={`Remove ${comp.itemName}`}>
                      <MaterialCommunityIcons name="close" size={18} color={c.textMuted} />
                    </Pressable>
                  )}
                </View>
              );
            })}
            <Text style={s.total}>Total fed {fmtKg(total)} against plan {fmtKg(day.plannedKg)}</Text>
            <Textarea placeholder="Why (optional)" value={remarks} onChangeText={setRemarks} />
          </ScrollView>
          {invalid.length > 0 ? <Banner tone="danger">Enter a number of kg (0 or more) for {invalid.join(", ")}.</Banner> : null}
          {offline ? <Banner tone="warning" icon="wifi-off">Amending needs a connection. Nothing is queued.</Banner> : null}
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {day.amended ? (
            <Button label="Reset to recipe" variant="link" loading={resetting} disabled={offline || saving || resetting} onPress={onReset} />
          ) : null}
          <View style={s.actions}>
            <View style={{ flex: 1 }}><Button label="Cancel" variant="outline" onPress={onClose} /></View>
            <View style={{ flex: 1 }}>
              <Button
                label="Save amount"
                loading={saving}
                disabled={offline || saving || invalid.length > 0 || (!changed && remarks === day.remarks)}
                onPress={() => onSave(changes, remarks)}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: RADIUS.lg ?? 16,
      borderTopRightRadius: RADIUS.lg ?? 16,
      padding: 16,
      gap: 10,
      maxHeight: "88%",
    },
    title: { fontSize: 17, color: c.text, fontFamily: FONT_FAMILY.semibold },
    sub: { fontSize: 12, color: c.textMuted },
    head: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    th: { fontSize: 11, color: c.textMuted, textTransform: "uppercase", fontFamily: FONT_FAMILY.semibold },
    line: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle },
    name: { fontSize: 13, color: c.text },
    cell: { fontSize: 12, color: c.textMuted },
    num: { width: 72, textAlign: "right" },
    box: { width: 92 },
    input: { textAlign: "right", paddingVertical: 8 },
    x: { width: 40, alignItems: "center", justifyContent: "center" },
    undo: { fontSize: 12, color: c.text, fontFamily: FONT_FAMILY.semibold },
    struck: { textDecorationLine: "line-through", opacity: 0.55 },
    total: { fontSize: 12, color: c.textMuted, marginVertical: 8 },
    actions: { flexDirection: "row", gap: 10 },
  });
