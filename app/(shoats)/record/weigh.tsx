import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { Button } from "@/components/Button";
import { Field, FieldRow, Input } from "@/components/Field";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { useDayField } from "@/components/shoats/DayField";
import { useHerdField } from "@/components/shoats/HerdField";
import { SaveBanners } from "@/components/shoats/SaveBanners";
import { useColors } from "@/src/hooks/useColors";
import { useOperator } from "@/src/hooks/useOperator";
import { recordWeightSample } from "@/src/shoats/api";
import { kg, liveWeight } from "@/src/shoats/logic";
import { useSubmit } from "@/src/shoats/useSubmit";

const WHOLE = "Whole herd";

/**
 * Weigh sample: N animals put on the scale, the average kg. The herd's live weight
 * is the latest average times its head, which also feeds the 4 % feed projection.
 */
export default function WeighSample() {
  const c = useColors();
  const offline = useOffline();
  const { herd, field } = useHerdField();
  const day = useDayField();
  const sub = useSubmit();
  const { operator, missingMessage } = useOperator();
  const [klass, setKlass] = useState(WHOLE);
  const [weighed, setWeighed] = useState("");
  const [average, setAverage] = useState("");

  const n = Math.floor(Number(weighed));
  const avg = Number(average.replace(",", "."));
  const classRow = herd?.classes.find((k) => k.label === klass);
  const scope = classRow ? classRow.head : herd?.head ?? 0;
  const valid = !!herd && n > 0 && avg > 0;
  const tooMany = !!herd && n > scope;

  const save = async () => {
    if (!herd || !valid) return;
    if (!operator) return sub.setError(missingMessage);
    const ok = await sub.run(
      () => recordWeightSample({ herd: herd.name, sampleClass: classRow?.key ?? "All", animalsWeighed: n, averageKg: avg, eventDate: day.eventDate, operator }),
      () => `Sample saved: ${n} weighed, average ${kg(avg)}.`,
    );
    if (ok) {
      setWeighed("");
      setAverage("");
    }
  };

  return (
    <Screen title="Weigh sample" subtitle="How many you weighed and their average" back>
      {field}
      {day.field}
      {herd?.classes.length ? (
        <Field label="Which animals">
          <Picker value={klass} onChange={setKlass} options={[WHOLE, ...herd.classes.map((k) => k.label)]} />
        </Field>
      ) : null}
      <Field label="Animals weighed" help={herd ? `${scope} head in ${classRow ? classRow.label.toLowerCase() : "the herd"}.` : undefined}>
        <Input testID="weighed" value={weighed} onChangeText={(v) => setWeighed(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" />
      </Field>
      <Field label="Average weight (kg)">
        <Input testID="average" value={average} onChangeText={setAverage} keyboardType="decimal-pad" placeholder="0" />
      </Field>
      {valid ? (
        <Text style={[styles.hint, { color: tooMany ? c.danger : c.textMuted }]}>
          {tooMany
            ? `You cannot weigh ${n} out of ${scope}.`
            : `${n} weighed, average ${kg(avg)}${!classRow && herd ? ` — live weight about ${kg(liveWeight(avg, herd.head))}` : ""}.`}
        </Text>
      ) : null}
      <SaveBanners error={sub.error} note={sub.note} result={sub.result} />
      <OnlineOnlyNotice />
      <FieldRow>
        <Button label={sub.busy ? "Recording…" : "Record sample"} disabled={offline || sub.busy || !valid || tooMany} loading={sub.busy} onPress={save} />
      </FieldRow>
    </Screen>
  );
}

const styles = StyleSheet.create({ hint: { fontSize: 12, marginBottom: 10 } });
