import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Text } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { DateField, fromISODate } from "@/components/DateTimeField";
import { Field, FieldRow, Input } from "@/components/Field";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Screen } from "@/components/Screen";
import { ClassCounts } from "@/components/shoats/ClassCounts";
import { useDayField } from "@/components/shoats/DayField";
import { DestinationHerdField, useHerdField } from "@/components/shoats/HerdField";
import { SaveBanners } from "@/components/shoats/SaveBanners";
import { useColors } from "@/src/hooks/useColors";
import { useOperator } from "@/src/hooks/useOperator";
import { todayISO } from "@/src/services/api";
import { recordCountEvent } from "@/src/shoats/api";
import { LABEL, useAnimalType } from "@/src/shoats/animalType";
import { useShoatOptions } from "@/src/shoats/hooks";
import { cleanCounts, expectedBirthFrom, totalOf } from "@/src/shoats/logic";
import { useSubmit } from "@/src/shoats/useSubmit";

type Mode = "Mating" | "Birth" | "Weaning";

const int = (v: string) => Math.max(0, Math.floor(Number(v)) || 0);
const digits = (v: string) => v.replace(/[^0-9]/g, "");

/**
 * Breeding by numbers: a mating (females put to the males, males in, from when to
 * when, and the birth date that follows), lambing or kidding (born alive, born
 * dead) and weaning (how many young become females, males or others, or go to
 * another herd). Everything is a number for the herd, never an animal.
 */
export default function Breeding() {
  const c = useColors();
  const offline = useOffline();
  const { operator, missingMessage } = useOperator();
  const type = useAnimalType((s) => s.type);
  const options = useShoatOptions().data;
  const { mode: preset } = useLocalSearchParams<{ mode?: string }>();
  const { herd, field } = useHerdField();
  const day = useDayField();
  const sub = useSubmit();
  const today = todayISO();

  const [mode, setMode] = useState<Mode>(preset === "Birth" || preset === "Weaning" ? preset : "Mating");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");
  const [served, setServed] = useState("");
  const [males, setMales] = useState("");
  const [alive, setAlive] = useState("");
  const [dead, setDead] = useState("");
  const [weaned, setWeaned] = useState<Record<string, string>>({});
  const [away, setAway] = useState(false);
  const [toHerd, setToHerd] = useState("");

  const labels = herd?.labels ?? { females: "Ewes", males: "Rams", young: "Lambs", others: "Others" };
  const youngWord = labels.young.toLowerCase();
  const birthWord = type === "goats" ? "Kidding" : "Lambing";
  const classes = herd?.classes ?? [];
  const youngHead = classes.find((k) => k.key === "young")?.head ?? 0;
  const gestation = options?.gestationDays ?? 150;
  const expected = expectedBirthFrom(end || start, gestation);
  const weanedCounts = cleanCounts(weaned);
  const weanedTotal = totalOf(weanedCounts);

  const valid =
    !!herd &&
    (mode === "Mating"
      ? int(served) > 0 && int(males) > 0 && (!end || end >= start)
      : mode === "Birth"
        ? int(alive) + int(dead) > 0
        : weanedTotal > 0 && weanedTotal <= youngHead && (!away || !!toHerd));

  const save = async () => {
    if (!herd || !valid) return;
    if (!operator) return sub.setError(missingMessage);
    await sub.run(
      () =>
        recordCountEvent({
          herd: herd.name,
          eventType: mode,
          eventDate: day.eventDate,
          counts:
            mode === "Mating" ? { females: int(served), males: int(males) } : mode === "Birth" ? { young: int(alive) } : weanedCounts,
          bornDead: mode === "Birth" ? int(dead) : undefined,
          matingStart: mode === "Mating" ? start : undefined,
          matingEnd: mode === "Mating" ? end || start : undefined,
          otherHerd: mode === "Weaning" && away ? toHerd : undefined,
          operator,
        }),
      (r) =>
        mode === "Mating"
          ? `Mating saved: ${int(served)} ${labels.females.toLowerCase()} put to ${int(males)} ${labels.males.toLowerCase()}. ${birthWord} expected around ${r.raw?.expected_birth_date ?? expected}.`
          : mode === "Birth"
            ? `${birthWord} saved: ${int(alive)} born alive, ${int(dead)} born dead${r.raw?.mating_linked ? " (linked to its mating)" : ""}.`
            : `Weaning saved: ${weanedTotal} ${youngWord} weaned.`,
    );
  };

  return (
    <Screen title="Breeding" subtitle={`${type ? LABEL[type] : "Shoats"} · mating, ${birthWord.toLowerCase()}, weaning`} back>
      {field}
      <Field label="What happened">
        <Chips>
          <Chip label="Mating" active={mode === "Mating"} onPress={() => setMode("Mating")} />
          <Chip label={birthWord} active={mode === "Birth"} onPress={() => setMode("Birth")} />
          <Chip label="Weaning" active={mode === "Weaning"} onPress={() => setMode("Weaning")} />
        </Chips>
      </Field>

      {mode === "Mating" ? (
        <>
          <Field label="Mating started">
            <DateField value={start} onChange={(d) => { setStart(d); if (end && end < d) setEnd(""); }} maximumDate={fromISODate(today)} />
          </Field>
          <Field label={`${labels.males} out on`} help="Optional: leave empty if the mating ended the same day.">
            <DateField value={end} onChange={setEnd} minimumDate={fromISODate(start)} maximumDate={fromISODate(today)} placeholder="Same day" />
          </Field>
          <Field label={`${labels.females} put to the ${labels.males.toLowerCase()}`} help={herd ? `${classes.find((k) => k.key === "females")?.head ?? 0} on the books.` : undefined}>
            <Input testID="served" value={served} onChangeText={(v) => setServed(digits(v))} keyboardType="number-pad" placeholder="0" />
          </Field>
          <Field label={`${labels.males} in`} help={herd ? `${classes.find((k) => k.key === "males")?.head ?? 0} on the books.` : undefined}>
            <Input testID="males-in" value={males} onChangeText={(v) => setMales(digits(v))} keyboardType="number-pad" placeholder="0" />
          </Field>
          <Text style={{ color: c.textMuted, fontSize: 12, marginBottom: 10 }}>
            {`${birthWord} expected around ${expected} (${gestation} days after the mating ends).`}
          </Text>
        </>
      ) : null}

      {mode === "Birth" ? (
        <>
          {day.field}
          <Field label={`${labels.young} born alive`}>
            <Input testID="born-alive" value={alive} onChangeText={(v) => setAlive(digits(v))} keyboardType="number-pad" placeholder="0" />
          </Field>
          <Field label="Born dead">
            <Input testID="born-dead" value={dead} onChangeText={(v) => setDead(digits(v))} keyboardType="number-pad" placeholder="0" />
          </Field>
          <Banner tone="info">Those born alive join the herd as {youngWord}; those born dead stay on the ledger but not in the head. The server links this to the mating it comes from.</Banner>
        </>
      ) : null}

      {mode === "Weaning" ? (
        <>
          {day.field}
          <Field label={`${labels.young} weaned into`} help={`${youngHead} ${youngWord} on the books. Enter how many become each.`}>
            <ClassCounts classes={classes.filter((k) => k.key !== "young")} value={weaned} onChange={setWeaned} showLedger={false} />
          </Field>
          <Field label="Where they go">
            <Chips>
              <Chip label="Stay in this herd" active={!away} onPress={() => setAway(false)} />
              <Chip label="Another herd" active={away} onPress={() => setAway(true)} />
            </Chips>
          </Field>
          {away ? <DestinationHerdField value={toHerd} onChange={setToHerd} exclude={herd?.name} /> : null}
          {weanedTotal > youngHead ? <Text style={{ color: c.danger, fontSize: 12, marginBottom: 10 }}>Only {youngHead} {youngWord} in this herd.</Text> : null}
        </>
      ) : null}

      <SaveBanners error={sub.error} note={sub.note} result={sub.result} />
      <OnlineOnlyNotice />
      <FieldRow>
        <Button label={sub.busy ? "Recording…" : "Record"} disabled={offline || sub.busy || !valid} loading={sub.busy} onPress={save} />
      </FieldRow>
    </Screen>
  );
}
