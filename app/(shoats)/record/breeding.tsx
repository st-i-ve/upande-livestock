import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Text } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { DateField, fromISODate } from "@/components/DateTimeField";
import { Field, FieldRow, Input } from "@/components/Field";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { useDayField } from "@/components/shoats/DayField";
import { DestinationHerdField, useHerdField } from "@/components/shoats/HerdField";
import { SaveBanners } from "@/components/shoats/SaveBanners";
import { useColors } from "@/src/hooks/useColors";
import { useOperator } from "@/src/hooks/useOperator";
import { todayISO } from "@/src/services/api";
import { recordCountEvent } from "@/src/shoats/api";
import { LABEL, useAnimalType } from "@/src/shoats/animalType";
import { useShoatOptions } from "@/src/shoats/hooks";
import { expectedBirthFrom } from "@/src/shoats/logic";
import { useSubmit } from "@/src/shoats/useSubmit";

type Mode = "Mating" | "Birth" | "Weaning";

const int = (v: string) => Math.max(0, Math.floor(Number(v)) || 0);

/**
 * Breeding by numbers: a mating (the rams or bucks put in, from when to when, the
 * birth date that follows), lambing or kidding (born alive, born dead) and weaning
 * (how many young move to another class or herd).
 */
export default function Breeding() {
  const c = useColors();
  const offline = useOffline();
  const { operator, missingMessage } = useOperator();
  const type = useAnimalType((s) => s.type);
  const young = type === "goats" ? "kids" : "lambs";
  const males = type === "goats" ? "bucks" : "rams";
  const options = useShoatOptions().data;
  const { mode: preset } = useLocalSearchParams<{ mode?: string }>();
  const { herd, field } = useHerdField();
  const day = useDayField();
  const sub = useSubmit();
  const today = todayISO();

  const [mode, setMode] = useState<Mode>(preset === "Birth" || preset === "Weaning" ? preset : "Mating");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");
  const [rams, setRams] = useState("");
  const [alive, setAlive] = useState("");
  const [dead, setDead] = useState("");
  const [fromClass, setFromClass] = useState("");
  const [weaned, setWeaned] = useState("");
  const [dest, setDest] = useState<"class" | "herd">("class");
  const [toClass, setToClass] = useState("");
  const [toHerd, setToHerd] = useState("");

  const classes = herd?.classes ?? [];
  const from = classes.find((k) => k.label === fromClass);
  const target = classes.find((k) => k.label === toClass);
  const gestation = options?.gestationDays ?? 150;
  const expected = mode === "Mating" ? expectedBirthFrom(start, gestation) : null;

  const valid =
    !!herd &&
    (mode === "Mating"
      ? int(rams) > 0 && (!end || end >= start)
      : mode === "Birth"
        ? int(alive) + int(dead) > 0
        : !!from && int(weaned) > 0 && int(weaned) <= from.head && (dest === "herd" ? !!toHerd : !!target && target.key !== from.key));

  const save = async () => {
    if (!herd || !valid) return;
    if (!operator) return sub_err(missingMessage);
    await sub.run(
      () =>
        recordCountEvent({
          herd: herd.name,
          eventType: mode,
          eventDate: mode === "Mating" ? (start !== today ? start : undefined) : day.eventDate,
          counts: mode === "Weaning" && from ? { [from.key]: int(weaned) } : {},
          ramsIn: mode === "Mating" ? int(rams) : undefined,
          endDate: mode === "Mating" ? end : undefined,
          bornAlive: mode === "Birth" ? int(alive) : undefined,
          bornDead: mode === "Birth" ? int(dead) : undefined,
          toHerd: mode === "Weaning" && dest === "herd" ? toHerd : undefined,
          toClass: mode === "Weaning" && dest === "class" ? target?.key : undefined,
          operator,
        }),
      () =>
        mode === "Mating"
          ? `Mating saved: ${int(rams)} ${males} in. ${young[0].toUpperCase()}${young.slice(1)} expected around ${expected}.`
          : mode === "Birth"
            ? `${type === "goats" ? "Kidding" : "Lambing"} saved: ${int(alive)} born alive, ${int(dead)} born dead.`
            : `Weaning saved: ${int(weaned)} ${young} weaned.`,
    );
  };
  const sub_err = (m: string) => sub.setError(m);

  return (
    <Screen title="Breeding" subtitle={`${type ? LABEL[type] : "Shoats"} · mating, ${type === "goats" ? "kidding" : "lambing"}, weaning`} back>
      {field}
      <Field label="What happened">
        <Chips>
          <Chip label="Mating" active={mode === "Mating"} onPress={() => setMode("Mating")} />
          <Chip label={type === "goats" ? "Kidding" : "Lambing"} active={mode === "Birth"} onPress={() => setMode("Birth")} />
          <Chip label="Weaning" active={mode === "Weaning"} onPress={() => setMode("Weaning")} />
        </Chips>
      </Field>

      {mode === "Mating" ? (
        <>
          <Field label="Mating started">
            <DateField value={start} onChange={setStart} maximumDate={fromISODate(today)} />
          </Field>
          <Field label="Rams out on" help="Optional: leave empty while they are still in.">
            <DateField value={end} onChange={setEnd} minimumDate={fromISODate(start)} placeholder="Still in" />
          </Field>
          <Field label={`${males[0].toUpperCase()}${males.slice(1)} in with the females`} help={herd ? `${classes.find((k) => /ram|buck/i.test(k.label))?.head ?? 0} ${males} on the books.` : undefined}>
            <Input testID="rams-in" value={rams} onChangeText={(v) => setRams(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" />
          </Field>
          <Text style={{ color: c.textMuted, fontSize: 12, marginBottom: 10 }}>
            {`${type === "goats" ? "Kidding" : "Lambing"} expected around ${expected} (${gestation} days).`}
          </Text>
        </>
      ) : null}

      {mode === "Birth" ? (
        <>
          {day.field}
          <Field label={`${young[0].toUpperCase()}${young.slice(1)} born alive`}>
            <Input testID="born-alive" value={alive} onChangeText={(v) => setAlive(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" />
          </Field>
          <Field label="Born dead">
            <Input testID="born-dead" value={dead} onChangeText={(v) => setDead(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" />
          </Field>
          <Banner tone="info">Those born alive join the herd as {young}; those born dead are on the ledger but not in the head.</Banner>
        </>
      ) : null}

      {mode === "Weaning" ? (
        <>
          {day.field}
          <Field label="Weaning from">
            <Picker value={fromClass} onChange={setFromClass} options={classes.map((k) => k.label)} placeholder={`Pick the class (${young})`} />
          </Field>
          <Field label="Number weaned" help={from ? `${from.head} ${from.label.toLowerCase()} on the books.` : undefined}>
            <Input testID="weaned" value={weaned} onChangeText={(v) => setWeaned(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" />
          </Field>
          <Field label="Move them to">
            <Chips>
              <Chip label="A class in this herd" active={dest === "class"} onPress={() => setDest("class")} />
              <Chip label="Another herd" active={dest === "herd"} onPress={() => setDest("herd")} />
            </Chips>
          </Field>
          {dest === "class" ? (
            <Picker value={toClass} onChange={setToClass} options={classes.filter((k) => k.label !== fromClass).map((k) => k.label)} placeholder="Pick the class" />
          ) : (
            <DestinationHerdField value={toHerd} onChange={setToHerd} exclude={herd?.name} />
          )}
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
