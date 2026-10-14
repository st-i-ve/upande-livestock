import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { BackdateBanner } from "@/components/BackdateBanner";
import { BackdateButton } from "@/components/BackdateButton";
import { Banner } from "@/components/Banner";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { DateField, fromISODate } from "@/components/DateTimeField";
import { Field, Input, Textarea } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { VetPicker } from "@/components/VetPicker";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useBackdate } from "@/src/hooks/useBackdate";
import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";
import { useEligibility } from "@/src/hooks/useEligibility";
import { useOperator } from "@/src/hooks/useOperator";
import { useVetChoice } from "@/src/hooks/useVets";
import { extractFrappeError } from "@/src/services/api";
import type { Animal } from "@/types";

type Result = "Confirmed" | "Not Pregnant" | "Aborted";

export default function PD() {

  const { operator, missingMessage } = useOperator();
  const { isBackdating, eventDate: backdateDate, setEventDate: setBackdateDate } = useBackdate();
  const { today: serverToday } = useBackdatingWindow();
  const offline = useOffline();
  const [selected, setSelected] = useState<Animal[]>([]);
  const [result, setResult] = useState<Result>("Confirmed");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalEvent();
  const { vets, vet, setVet } = useVetChoice();
  // The server decides who has a service awaiting a check, using the same rule
  // create_pregnancy_diagnosis enforces on submit. Deriving a second list here
  // is how a picker ends up offering a cow the server then refuses.
  const { data: eligibility, isLoading: filterLoading } = useEligibility();
  const diagnosable = useMemo(
    () => new Set(eligibility?.diagnosable ?? []),
    [eligibility],
  );

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError(missingMessage);
    if (selected.length === 0) return setError("Pick at least one cow.");

    let succeeded = 0;
    for (const a of selected) {
      try {
        await mutation.mutateAsync({
          eventType: "Pregnancy Diagnosis",
          animal: a.id,
          currentHerd: a.herd,
          operator,
          vet: vet || undefined,
          eventDate: isBackdating ? backdateDate : serverToday,
          diagnosisResult: result,
          remarks: remarks || undefined,
        });
        succeeded += 1;
      } catch (err) {
        setError(
          `${succeeded} of ${selected.length} diagnosed. Stopped at ${a.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }
    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} marked ${result}`);
    Alert.alert(
      "PD recorded",
      `${parts.join(" · ")}${result === "Confirmed" && succeeded > 0 ? "\nExpected calving in 280 days per cow." : ""}`,
    );
    router.replace("/(tabs)/record/success?name=Pregnancy diagnosis");
  };

  return (
    <Screen
      title="Pregnancy diagnosis"
      subtitle="Confirm or rule out"
      back
      headerRight={isBackdating ? undefined : <BackdateButton type="pd" />}
    >
      {isBackdating ? <BackdateBanner /> : null}
      <Field
        label="Cow(s)"
        help={
          filterLoading
            ? "Loading served animals…"
            : "Only animals with an open service. Pick one or many — same result applied to each."
        }
      >
        <AnimalPickerButton
          mode="multi"
          title="Select served cows"
          placeholder={
            filterLoading
              ? "Loading cows awaiting a check…"
              : selected.length
                ? `${selected.length} selected — tap to change`
                : "Search cow awaiting a check..."
          }
          include={(a) => a.sex === "F" && diagnosable.has(a.id)}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>
      {isBackdating ? (
        <Field label="Date it happened">
          <DateField value={backdateDate} onChange={setBackdateDate} maximumDate={fromISODate(serverToday)} />
        </Field>
      ) : (
        <Field label="Diagnosis date"><Input value={serverToday} editable={false} /></Field>
      )}
      <Field label="Result">
        <Chips>
          {(["Confirmed", "Not Pregnant", "Aborted"] as const).map((r) => (
            <Chip key={r} label={r} active={result === r} onPress={() => setResult(r)} />
          ))}
        </Chips>
      </Field>
      <VetPicker vets={vets} value={vet} onChange={setVet} />
      <Field label="Remarks">
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Observations..." />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <OnlineOnlyNotice />
      <Button
        label={mutation.isPending ? "Submitting…" : "Submit PD"}
        disabled={offline || mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}
