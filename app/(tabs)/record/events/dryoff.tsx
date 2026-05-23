import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, Input } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { useAuthStore } from "@/src/auth/authStore";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useHerds } from "@/src/hooks/useHerds";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

export default function Dryoff() {
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);
  const { data: herds = [] } = useHerds();

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [selected, setSelected] = useState<Animal[]>([]);
  const [toHerd, setToHerd] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Default destination: a dry-flagged herd if one exists (per Livestock Settings).
  useEffect(() => {
    if (!toHerd && herds.length) {
      const dry = herds.find((h) => h.isDry);
      setToHerd(dry?.n ?? herds.find((h) => /steamer|dry/i.test(h.n))?.n ?? herds[0].n);
    }
  }, [herds, toHerd]);

  const mutation = useCreateAnimalEvent();

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (selected.length === 0) return setError("Pick at least one cow to dry off.");
    if (!toHerd) return setError("Pick a destination herd.");
    if (operator !== defaultOperator) await setStoredOperator(operator);

    let succeeded = 0;
    let queued = 0;
    for (const a of selected) {
      try {
        const r = await mutation.mutateAsync({
          eventType: "Drying Off",
          animal: a.id,
          currentHerd: a.herd,
          operator,
          eventDate: todayISO(),
          toHerd,
        });
        if (r.queued) queued += 1;
        else succeeded += 1;
      } catch (err) {
        setError(
          `${succeeded} of ${selected.length} dried off. Stopped at ${a.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }
    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} moved to ${toHerd}`);
    if (queued) parts.push(`${queued} queued (offline)`);
    Alert.alert("Drying off recorded", parts.join(" · "));
    router.replace("/(tabs)/record/success?name=Drying off");
  };

  return (
    <Screen title="Drying off" subtitle="From a milking herd" back>
      <Banner tone="info">The destination herd defaults to the dry / steamers herd; you can override below.</Banner>

      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>

      <Field label="Cow(s) to dry off">
        <AnimalPickerButton
          mode="multi"
          title="Select cows (lactating only)"
          placeholder="Search lactating cows..."
          include={(a) => /lactating|fresh/i.test(a.repro)}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>
      <Field label="To herd">
        <Picker value={toHerd} onChange={setToHerd} options={herds.map((h) => h.n)} />
      </Field>
      <Field label="Date"><Input value={todayISO()} editable={false} /></Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit dry-off"}
        disabled={mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}
