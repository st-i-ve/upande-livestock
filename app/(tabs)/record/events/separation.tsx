import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Field, Textarea } from "@/components/Field";
import { Loader } from "@/components/Loader";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { RADIUS, font } from "@/constants/theme";
import { NOTE_MIN_LENGTH, SELECTION_NOTE_PROMPT, selectionNoteError } from "@/src/beef/breeding";
import { mergeWarnings } from "@/src/beef/kinship";
import { dueLine, optionOf, separationRemarks } from "@/src/beef/separation";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useColors } from "@/src/hooks/useColors";
import { useEligibility, type SeparationDue } from "@/src/hooks/useEligibility";
import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";
import { useBeefSettings, useHerds } from "@/src/hooks/useHerds";
import { useKinshipPreview } from "@/src/hooks/useKinshipPreview";
import { useOperator } from "@/src/hooks/useOperator";
import { usePullToRefresh, useRefreshOnFocus } from "@/src/hooks/useServerLists";
import { extractFrappeError } from "@/src/services/api";
import type { Animal } from "@/types";

/**
 * Calves at or past the separation age, from the server's `separation_due`. A
 * heifer goes to the heifer herd; a bull calf to the feedlot (by weight) or to
 * breeding (with the herdsman's note). Nothing moves on its own.
 */
export default function Separation() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { data, isLoading, error, refetch } = useEligibility();
  const { refreshing, onRefresh } = usePullToRefresh();
  useRefreshOnFocus();
  const beef = useBeefSettings();
  const due = data?.separation_due ?? [];

  return (
    <Screen
      title="Calf separation"
      subtitle={`Calves at ${beef.calfSeparationAgeDays} days leave their mother`}
      back
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      {isLoading ? <Loader /> : null}
      {error ? <ErrorState text={extractFrappeError(error)} onRetry={() => refetch()} /> : null}
      {!isLoading && !error && due.length === 0 ? <Empty icon="check" text="No calf is due to leave its mother" /> : null}
      {due.map((d) => (
        <DueRow key={d.animal} d={d} />
      ))}
      <Text style={s.foot}>{due.length ? `${due.length} calf${due.length === 1 ? "" : "ves"} due` : ""}</Text>
    </Screen>
  );
}

function DueRow({ d }: { d: SeparationDue }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const offline = useOffline();
  const { operator, missingMessage } = useOperator();
  const { today } = useBackdatingWindow();
  const { data: herds = [] } = useHerds();
  const beef = useBeefSettings();
  const mutation = useCreateAnimalEvent();

  const feedlot = optionOf(d, "Feedlot");
  const breeding = optionOf(d, "Breeding");
  const heifer = optionOf(d, "Heifer");
  const [mode, setMode] = useState<"feedlot" | "breeding" | "heifer" | null>(null);
  const [herdPick, setHerdPick] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const breedingHerds = breeding?.herds?.length ? breeding.herds : herds.filter((h) => h.isBreeding).map((h) => h.n);
  const target =
    mode === "feedlot" ? feedlot?.herd ?? ""
    : mode === "heifer" ? herdPick || heifer?.herd || ""
    : mode === "breeding" ? herdPick || breedingHerds[0] || ""
    : "";

  const asAnimal = { id: d.animal, name: d.label, herd: d.herd, sex: d.sex === "Male" || d.sex === "M" ? "M" : "F" } as Animal;
  const kin = useKinshipPreview([asAnimal], target, mode === "breeding" && beef.kinshipCheck);

  const go = async () => {
    setError(null);
    if (!operator) return setError(missingMessage);
    if (!target) return setError("Pick a destination herd.");
    if (mode === "breeding") {
      const bad = selectionNoteError(note);
      if (bad) return setError(bad);
    }
    try {
      const reply = await mutation.mutateAsync({
        eventType: "Movement",
        animal: d.animal,
        currentHerd: d.herd,
        toHerd: target,
        operator,
        eventDate: today,
        remarks: mode === "breeding" ? note.trim() : separationRemarks(mode === "heifer" ? "Heifer" : "Feedlot", target),
      });
      const warned = mergeWarnings(Array.isArray(reply?.warnings) ? reply.warnings : []);
      setDone(`Moved to ${target}`);
      if (warned.length) Alert.alert("Moved — check this", warned.join("\n\n"));
    } catch (e) {
      setError(extractFrappeError(e));
    }
  };

  if (done) {
    return (
      <View style={s.card}>
        <Text style={s.name}>{d.label} <Text style={s.id}>{d.animal}</Text></Text>
        <Banner tone="success">{done}</Banner>
      </View>
    );
  }

  return (
    <View style={s.card} testID={`due-${d.animal}`}>
      <Text style={s.name}>{d.label} <Text style={s.id}>{d.animal}</Text></Text>
      <Text style={s.meta}>{dueLine(d)}</Text>
      <View style={s.actions}>
        {heifer ? (
          <Button label="To heifers" variant={mode === "heifer" ? "primary" : "outline"} onPress={() => setMode("heifer")} style={s.act} />
        ) : null}
        {feedlot ? (
          <Button label={feedlot.herd ? `Feedlot · ${feedlot.herd}` : "Feedlot"} variant={mode === "feedlot" ? "primary" : "outline"} onPress={() => setMode("feedlot")} style={s.act} />
        ) : null}
        {breeding ? (
          <Button label="Breeding" variant={mode === "breeding" ? "primary" : "outline"} onPress={() => setMode("breeding")} style={s.act} />
        ) : null}
      </View>

      {mode === "heifer" && !heifer?.herd ? (
        <Field label="Heifer herd">
          <Picker value={herdPick || (herds[0]?.n ?? "")} onChange={setHerdPick} options={herds.map((h) => h.n)} />
        </Field>
      ) : null}
      {mode === "breeding" ? (
        <>
          <Field label="Breeding herd">
            <Picker value={target} onChange={setHerdPick} options={breedingHerds} />
          </Field>
          <Field label="Breeding note" help={`${SELECTION_NOTE_PROMPT}. At least ${NOTE_MIN_LENGTH} characters.`}>
            <Textarea value={note} onChangeText={setNote} placeholder="e.g. Strong frame, good temperament" />
          </Field>
          {kin.warnings.length ? (
            <Banner tone="warning" icon="alert">{["Inbreeding warning — you can still move him:", ...kin.warnings].join("\n")}</Banner>
          ) : null}
        </>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {mode ? (
        <>
          <OnlineOnlyNotice />
          <Button
            label={mutation.isPending ? "Moving…" : `Move to ${target || "…"}`}
            disabled={offline || mutation.isPending || !target}
            loading={mutation.isPending}
            onPress={go}
          />
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: { padding: 12, marginBottom: 12, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, gap: 8 },
    name: { fontSize: 16, ...font("600"), color: c.text },
    id: { fontSize: 12, ...font("400"), color: c.textSubtle },
    meta: { fontSize: 12, color: c.textMuted },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    act: { flexGrow: 1 },
    foot: { fontSize: 12, color: c.textSubtle, textAlign: "center", marginTop: 4 },
  });
