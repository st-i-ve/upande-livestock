import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, type TextInputInstance, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { BackdateBanner } from "@/components/BackdateBanner";
import { BackdateButton } from "@/components/BackdateButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DateField, fromISODate } from "@/components/DateTimeField";
import { Field, FieldRow, Input } from "@/components/Field";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { SuccessTick } from "@/components/SuccessTick";
import { RADIUS, font } from "@/constants/theme";
import { markWeighed } from "@/src/db/animals";
import { syncAnimals } from "@/src/db/sync";
import {
  getWeightSettings,
  recordWeights,
  type WeighingMode,
  type WeightOutcome,
} from "@/src/frappe/weights";
import { useBackdate } from "@/src/hooks/useBackdate";
import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";
import { useColors } from "@/src/hooks/useColors";
import { useOperator } from "@/src/hooks/useOperator";
import { titleFor, useFinishRecording, useLockedAnimalId, usePresetAnimal, useSeedAnimal } from "@/src/hooks/useRecordContext";
import { useRecordDraft } from "@/src/hooks/useRecordDraft";
import { extractFrappeError } from "@/src/services/api";
import { findRecent, recentMessage, type RecentWeighing } from "@/src/weights/recent";
import { EMPTY_ENTRY as EMPTY, type Entry, allSaved, formAfterSave, kg, num, savedMessage, savedWeights } from "@/src/weights/session";
import type { Animal } from "@/types";

// The same three ways the web Weights page offers. The last two are estimates
// and the server files them as such (remarks, Visual Estimate).
const MODES: { mode: WeighingMode; title: string; blurb: string }[] = [
  { mode: "each", title: "One at a time", blurb: "A number against each animal." },
  { mode: "platform", title: "A pen on the platform", blurb: "One total for the group, divided by head." },
  { mode: "alike", title: "One weight for animals of a size", blurb: "One figure stands for them all." },
];

export default function WeightSession() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const offline = useOffline();
  const qc = useQueryClient();
  const { operator, missingMessage } = useOperator();
  const settings = useQuery({ queryKey: ["weight-settings"], queryFn: getWeightSettings, staleTime: 30_000 });

  const [selected, setSelected] = useState<Animal[]>([]);
  const preset = usePresetAnimal();
  const finish = useFinishRecording();
  const { isBackdating, eventDate: backdateDate, setEventDate: setBackdateDate } = useBackdate();
  const { today: serverToday } = useBackdatingWindow();
  useSeedAnimal(preset, selected, (a) => pick([a]));

  const [mode, setMode] = useState<WeighingMode>("each");
  const [methodPick, setMethodPick] = useState("");
  const [withExtras, setWithExtras] = useState(false);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [groupFigure, setGroupFigure] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<WeightOutcome | null>(null);
  // Recently weighed: animals the operator chose to weigh again (asked no more),
  // the warning shown on a pick, and the one shown at save time.
  const [again, setAgain] = useState<Set<string>>(new Set());
  const [pickWarn, setPickWarn] = useState<RecentWeighing[]>([]);
  const [saveWarn, setSaveWarn] = useState<RecentWeighing[]>([]);
  const [tick, setTick] = useState<string | null>(null);
  const inputs = useRef<Record<string, TextInputInstance | null>>({});
  // Opened from her page: she is the only animal here, and cannot be taken off.
  const locked = !!useLockedAnimalId();

  // Left by a tab switch with input in it: kept for "Continue recording".
  useRecordDraft({
    title: "Weight",
    preset: preset?.id,
    state: { selected, entries, groupFigure, mode, methodPick, withExtras, again },
    filled:
      selected.some((a) => a.id !== preset?.id) ||
      Object.values(entries).some((e) => !!(e.weight || e.girth || e.bcs).trim()) ||
      !!groupFigure.trim(),
    restore: (d) => {
      setSelected(d.selected);
      setEntries(d.entries);
      setGroupFigure(d.groupFigure);
      setMode(d.mode);
      setMethodPick(d.methodPick);
      setWithExtras(d.withExtras);
      setAgain(d.again);
    },
  });

  const methods = settings.data?.methods ?? [];
  // Settings supply the default once; after that the operator's choice stands,
  // unless the farm has since stopped offering it.
  const method = methods.includes(methodPick) ? methodPick : settings.data?.defaultMethod ?? "";

  // The day being recorded: the backdated one, or the server's today.
  const onDay = isBackdating ? backdateDate : serverToday;
  const unasked = (list: Animal[]) => findRecent(list, onDay).filter((r) => !again.has(r.id));

  // Every change of selection goes through here, so a recently weighed animal is
  // flagged as soon as she is picked, before anyone types her weight.
  function pick(list: Animal[]) {
    setSelected(list);
    setPickWarn(unasked(list));
  }
  const skipRecent = (ids: string[]) => {
    const drop = new Set(ids);
    setSelected((p) => p.filter((a) => !drop.has(a.id)));
    setEntries((p) => Object.fromEntries(Object.entries(p).filter(([id]) => !drop.has(id))));
  };
  const weighAgain = (ids: string[]) => setAgain((p) => new Set([...p, ...ids]));

  const nameOf = useMemo(() => new Map(selected.map((a) => [a.id, a])), [selected]);
  const set = (id: string, field: keyof Entry, v: string) =>
    setEntries((p) => ({ ...p, [id]: { ...(p[id] ?? EMPTY), [field]: v } }));
  const removeOne = (id: string) => skipRecent([id]);

  const written = selected.filter((a) => num((entries[a.id] ?? EMPTY).weight) > 0);
  const figure = num(groupFigure);
  const ready =
    !!method &&
    !!operator &&
    (mode === "each" ? written.length > 0 : selected.length > 0 && figure > 0);

  // After the tick: an empty form, ready for the next animal.
  const clearForm = () => {
    setTick(null);
    setSelected([]);
    setEntries({});
    setGroupFigure("");
    setAgain(new Set());
    setOutcome(null);
    if (preset) finish("Weight recording");
  };

  const submit = async () => {
    setError(null);
    if (!operator) return setError(missingMessage);
    if (!ready) return;
    // Asked again at save time, for a recent animal the pick warning was waved away on.
    const recent = unasked(mode === "each" ? written : selected);
    if (recent.length) return setSaveWarn(recent);
    await save();
  };

  const save = async () => {
    setBusy(true);
    try {
      const o = await recordWeights({
        method,
        operator,
        ...(isBackdating ? { eventDate: backdateDate } : {}),
        mode,
        rows: written.map((a) => {
          const e = entries[a.id] ?? EMPTY;
          return {
            animal: a.id,
            weight_kg: num(e.weight),
            ...(num(e.girth) > 0 ? { heart_girth_cm: num(e.girth) } : {}),
            ...(num(e.bcs) > 0 ? { bcs: num(e.bcs) } : {}),
          };
        }),
        group: {
          animals: selected.map((a) => a.id),
          ...(mode === "platform" ? { total_weight_kg: figure } : { weight_kg: figure }),
        },
      });
      const form = { selected, entries, groupFigure };
      const saved = savedWeights(mode, form, o);
      // The local rows learn the new weight and its day now, so picking the same
      // animal again warns before the next sync brings it from the server.
      await markWeighed(saved, onDay).catch(() => {});
      void syncAnimals();
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["animal"] });
      if (allSaved(o)) {
        // The tick, then clearForm (and, opened for one animal, back to her page).
        setOutcome(null);
        setTick(savedMessage(saved, selected));
      } else {
        // Only the refused animals stay, with their figures, to correct and resend.
        setOutcome(o);
        const next = formAfterSave(form, o);
        setSelected(next.selected);
        setEntries(next.entries);
        setGroupFigure(next.groupFigure);
      }
    } catch (e) {
      setError(extractFrappeError(e));
    } finally {
      setBusy(false);
    }
  };

  const focusNext = (i: number) => {
    const next = selected[i + 1];
    if (next) inputs.current[`${next.id}:weight`]?.focus();
    else inputs.current[`${selected[i].id}:weight`]?.blur();
  };

  const nameFor = (id: string) => {
    const a = nameOf.get(id);
    return a ? `${a.name} · ${a.id}` : id;
  };

  return (
    <Screen
      title={titleFor("Weight recording", preset)}
      subtitle="Weigh one animal, several, or a herd"
      back
      headerRight={isBackdating ? undefined : <BackdateButton type="weight" />}
    >
      {isBackdating ? <BackdateBanner /> : null}
      {settings.isError ? (
        <Banner tone="danger">Could not read the weighing settings. Pull to retry or check your connection.</Banner>
      ) : null}

      <Field label="Animals" help="Search by tag, or open the By herd tab to take a whole herd.">
        <AnimalPickerButton
          mode="multi"
          title="Who went through"
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Select one or many..."}
          value={selected}
          onPickMulti={pick}
        />
      </Field>

      {isBackdating ? (
        <Field label="Date it happened">
          <DateField value={backdateDate} onChange={setBackdateDate} maximumDate={fromISODate(serverToday)} />
        </Field>
      ) : null}

      <Field label="Method" help={settings.data?.weighbridgeAvailable ? undefined : "No weighbridge on this farm."}>
        <Picker value={method} onChange={setMethodPick} options={methods} placeholder="Method" />
      </Field>

      <Field label="How they were weighed">
        <Chips>
          {MODES.map((m) => (
            <Chip key={m.mode} label={m.title} active={mode === m.mode} onPress={() => { setMode(m.mode); setGroupFigure(""); }} />
          ))}
        </Chips>
        <Text style={s.hint}>{MODES.find((m) => m.mode === mode)?.blurb}</Text>
      </Field>

      {mode !== "each" && selected.length > 0 ? (
        <Field
          label={mode === "platform" ? "Total on the platform (kg)" : "Weight each (kg)"}
          help={
            figure > 0
              ? mode === "platform"
                ? `${kg(figure)} kg over ${selected.length} head — ${kg(figure / selected.length)} kg each. Recorded as an apportioned figure.`
                : `${kg(figure)} kg recorded against all ${selected.length}, as an estimate.`
              : undefined
          }
        >
          <Input value={groupFigure} onChangeText={setGroupFigure} keyboardType="decimal-pad" placeholder="0" />
        </Field>
      ) : null}

      {mode === "each" && selected.length > 0 ? (
        <>
          <View style={s.headRow}>
            <SectionTitle>Weights ({written.length} of {selected.length})</SectionTitle>
            <Pressable onPress={() => setWithExtras((v) => !v)} hitSlop={8}>
              <Text style={s.link}>{withExtras ? "Hide girth / condition" : "Add girth / condition"}</Text>
            </Pressable>
          </View>
          <View style={s.box}>
            {selected.map((a, i) => {
              const e = entries[a.id] ?? EMPTY;
              const w = num(e.weight);
              const delta = w > 0 && a.lastWt > 0 ? w - a.lastWt : null;
              return (
                <View key={a.id} style={s.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.name} numberOfLines={1}>
                      {a.name} <Text style={s.id}>{a.id}</Text>
                    </Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {a.herd} · {a.lastWt > 0 ? `last ${kg(a.lastWt)} kg` : "no weight yet"}
                      {delta !== null ? ` · ${delta >= 0 ? "+" : ""}${kg(delta)} kg` : ""}
                    </Text>
                  </View>
                  <TextInput
                    ref={(r) => { inputs.current[`${a.id}:weight`] = r; }}
                    value={e.weight}
                    onChangeText={(v) => set(a.id, "weight", v)}
                    keyboardType="decimal-pad"
                    returnKeyType={i < selected.length - 1 ? "next" : "done"}
                    onSubmitEditing={() => (withExtras ? inputs.current[`${a.id}:girth`]?.focus() : focusNext(i))}
                    blurOnSubmit={false}
                    placeholder="kg"
                    placeholderTextColor={c.textSubtle}
                    style={[s.cell, { width: 76 }]}
                    selectTextOnFocus
                  />
                  {withExtras ? (
                    <>
                      <TextInput
                        ref={(r) => { inputs.current[`${a.id}:girth`] = r; }}
                        value={e.girth}
                        onChangeText={(v) => set(a.id, "girth", v)}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                        onSubmitEditing={() => inputs.current[`${a.id}:bcs`]?.focus()}
                        blurOnSubmit={false}
                        placeholder="cm"
                        placeholderTextColor={c.textSubtle}
                        style={[s.cell, { width: 58 }]}
                      />
                      <TextInput
                        ref={(r) => { inputs.current[`${a.id}:bcs`] = r; }}
                        value={e.bcs}
                        onChangeText={(v) => set(a.id, "bcs", v)}
                        keyboardType="decimal-pad"
                        returnKeyType={i < selected.length - 1 ? "next" : "done"}
                        onSubmitEditing={() => focusNext(i)}
                        blurOnSubmit={false}
                        placeholder="BCS"
                        placeholderTextColor={c.textSubtle}
                        style={[s.cell, { width: 52 }]}
                      />
                    </>
                  ) : null}
                  {locked ? null : (
                    <Pressable onPress={() => removeOne(a.id)} hitSlop={10} style={s.remove}>
                      <MaterialCommunityIcons name="close" size={16} color={c.textMuted} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
          {written.length < selected.length ? (
            <Text style={s.hint}>{selected.length - written.length} left blank will be skipped, not refused.</Text>
          ) : null}
        </>
      ) : null}

      {mode !== "each" && selected.length > 0 ? (
        <View style={s.box}>
          {selected.map((a) => (
            <View key={a.id} style={s.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name} numberOfLines={1}>{a.name} <Text style={s.id}>{a.id}</Text></Text>
                <Text style={s.meta} numberOfLines={1}>
                  {a.herd} · {a.lastWt > 0 ? `last ${kg(a.lastWt)} kg` : "no weight yet"}
                </Text>
              </View>
              {locked ? null : (
                <Pressable onPress={() => removeOne(a.id)} hitSlop={10} style={s.remove}>
                  <MaterialCommunityIcons name="close" size={16} color={c.textMuted} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ) : null}

      {outcome ? (
        <>
          <SectionTitle>Result</SectionTitle>
          <Banner tone={outcome.failed.length ? "warning" : "success"}>
            {`${outcome.count} saved` +
              (outcome.skipped.length ? `, ${outcome.skipped.length} left blank` : "") +
              (outcome.failed.length ? `, ${outcome.failed.length} refused` : "") +
              "."}
          </Banner>
          <View style={s.box}>
            {outcome.recorded.map((r) => (
              <View key={r.animal} style={s.resRow}>
                <MaterialCommunityIcons name="check-circle-outline" size={16} color={c.text} />
                <Text style={s.resText} numberOfLines={2}>{nameFor(r.animal)} saved</Text>
              </View>
            ))}
            {outcome.skipped.map((r) => (
              <View key={r.animal} style={s.resRow}>
                <MaterialCommunityIcons name="minus-circle-outline" size={16} color={c.textMuted} />
                <Text style={s.resText} numberOfLines={2}>{nameFor(r.animal)} skipped — {r.why}</Text>
              </View>
            ))}
            {outcome.failed.map((r) => (
              <View key={r.animal} style={s.resRow}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={c.danger} />
                <Text style={[s.resText, { color: c.danger }]} numberOfLines={4}>
                  {nameFor(r.animal)} refused — {r.why.replace(/<[^>]+>/g, " ").trim()}
                </Text>
              </View>
            ))}
          </View>
          {outcome.failed.length ? (
            <Text style={s.hint}>The refused animals are still on the list above. Correct them and record again.</Text>
          ) : null}
        </>
      ) : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}
      <OnlineOnlyNotice />
      <FieldRow>
        <Button
          label={
            busy
              ? "Recording…"
              : `Record ${mode === "each" ? written.length || "…" : selected.length || "…"} weight${
                  (mode === "each" ? written.length : selected.length) === 1 ? "" : "s"
                }`
          }
          disabled={offline || busy || !ready}
          loading={busy}
          onPress={submit}
        />
      </FieldRow>

      <ConfirmModal
        visible={pickWarn.length > 0}
        title="Weighed recently"
        message={recentMessage(pickWarn)}
        cancelLabel={locked ? "Not now" : "Skip"}
        confirmLabel="Weigh again"
        // Locked to her: skipping her would leave nothing to weigh, so "Not now" goes back.
        onCancel={() => {
          setPickWarn([]);
          if (locked) router.back();
          else skipRecent(pickWarn.map((r) => r.id));
        }}
        onConfirm={() => { weighAgain(pickWarn.map((r) => r.id)); setPickWarn([]); }}
        onDismiss={() => setPickWarn([])}
      />
      <ConfirmModal
        visible={saveWarn.length > 0}
        title="Save anyway?"
        message={recentMessage(saveWarn).replace(/You can skip[^\n]*$/, "Save this weighing as well?")}
        cancelLabel="Not now"
        confirmLabel="Save"
        onCancel={() => setSaveWarn([])}
        onConfirm={() => {
          weighAgain(saveWarn.map((r) => r.id));
          setSaveWarn([]);
          void save();
        }}
      />
      <SuccessTick visible={tick !== null} message={tick ?? ""} onDone={clearForm} />
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    hint: { marginTop: 6, marginBottom: 8, fontSize: 12, color: c.textMuted },
    headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    link: { fontSize: 12, color: c.text, textDecorationLine: "underline" },
    box: { backgroundColor: c.bgMuted, borderRadius: RADIUS.md, padding: 4, marginBottom: 12 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    name: { fontSize: 13, ...font("600"), color: c.text },
    id: { fontSize: 11, ...font("400"), color: c.textSubtle },
    meta: { fontSize: 11, color: c.textMuted, marginTop: 1 },
    cell: {
      // A floor, not a fixed height: at the larger text sizes the figure must not clip.
      minHeight: 40,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      backgroundColor: c.bg,
      color: c.text,
      paddingHorizontal: 8,
      textAlign: "right",
      fontSize: 15,
    },
    remove: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
    resRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
    resText: { flex: 1, fontSize: 12.5, color: c.text },
  });
