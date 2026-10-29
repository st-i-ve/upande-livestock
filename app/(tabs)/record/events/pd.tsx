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
import { SireChooser } from "@/components/SireChooser";
import { VetPicker } from "@/components/VetPicker";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { mergeWarnings } from "@/src/beef/kinship";
import { useHerdFacts } from "@/src/hooks/useHerds";
import { useSireChoice } from "@/src/hooks/useSireChoice";
import { useBackdate } from "@/src/hooks/useBackdate";
import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";
import { useEligibility } from "@/src/hooks/useEligibility";
import { useOperator } from "@/src/hooks/useOperator";
import { useVetChoice } from "@/src/hooks/useVets";
import { extractFrappeError } from "@/src/services/api";
import type { Animal } from "@/types";
import { titleFor, useFinishRecording, usePresetAnimal, useSeedAnimal } from "@/src/hooks/useRecordContext";
import { usePullToRefresh, useRefreshOnFocus } from "@/src/hooks/useServerLists";

type Result = "Confirmed" | "Not Pregnant" | "Aborted";

export default function PD() {

  const { operator, missingMessage } = useOperator();
  const { isBackdating, eventDate: backdateDate, setEventDate: setBackdateDate } = useBackdate();
  const { today: serverToday } = useBackdatingWindow();
  const offline = useOffline();
  const { refreshing, onRefresh } = usePullToRefresh();
  useRefreshOnFocus();
  const [selected, setSelected] = useState<Animal[]>([]);
  const preset = usePresetAnimal();
  useSeedAnimal(preset, selected, (a) => setSelected([a]));
  const finish = useFinishRecording();
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

  // Natural mating leaves no service on file. A cow with no open service can still
  // be diagnosed: the vet's perceived conception date (or foetal age) makes the
  // Natural Service, and the sire is the bull who was in her herd then.
  const noService = selected.filter((a) => !diagnosable.has(a.id));
  const needsConception = result === "Confirmed" && noService.length > 0;
  const [conception, setConception] = useState("");
  const [weeks, setWeeks] = useState("");
  const single = needsConception && selected.length === 1 ? selected[0] : null;
  const sire = useSireChoice(single, conception, !!single && !!conception);
  const facts = useHerdFacts();
  const breedingKey = facts.breeding.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const breedingHerds = useMemo(() => new Set(facts.breeding), [breedingKey]);

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError(missingMessage);
    if (selected.length === 0) return setError("Pick at least one cow.");
    if (needsConception && !conception && !(Number(weeks) > 0)) {
      return setError("These cows have no service on file: give the perceived conception date, or the foetal age in weeks.");
    }
    if (single && sire.needsChoice) {
      return setError("More than one bull was with her then: pick the sire, or choose Unknown.");
    }

    let succeeded = 0;
    const replies: any[] = [];
    for (const a of selected) {
      try {
        const noSvc = !diagnosable.has(a.id) && result === "Confirmed";
        const rep = await mutation.mutateAsync({
          eventType: "Pregnancy Diagnosis",
          animal: a.id,
          currentHerd: a.herd,
          operator,
          vet: vet || undefined,
          eventDate: isBackdating ? backdateDate : serverToday,
          diagnosisResult: result,
          conceptionDate: noSvc && conception ? conception : undefined,
          foetalAgeWeeks: noSvc && !conception && Number(weeks) > 0 ? Number(weeks) : undefined,
          sireAnimal: noSvc && single && sire.sireAnimal ? sire.sireAnimal : undefined,
          sireUnknown: noSvc && single && sire.sireUnknown ? true : undefined,
          remarks: remarks || undefined,
        });
        replies.push(rep);
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
    const made = replies.filter((x) => x?.service_created).length;
    const sireLines = replies
      .map((x, i) => (x?.service_created && x?.sire_animal ? `${selected[i]?.name}: sire ${x.sire_animal}${x.sire_inferred ? " (inferred)" : ""}` : ""))
      .filter(Boolean);
    const warned = mergeWarnings(...replies.map((x) => (Array.isArray(x?.warnings) ? x.warnings : [])));
    Alert.alert(
      "PD recorded",
      [
        `${parts.join(" · ")}${result === "Confirmed" && succeeded > 0 ? "\nExpected calving in 280 days per cow." : ""}`,
        made ? `${made} natural service${made === 1 ? "" : "s"} recorded at the conception date.` : "",
        ...sireLines,
        ...warned,
      ].filter(Boolean).join("\n\n"),
    );
    finish("Pregnancy diagnosis");
  };

  return (
    <Screen
      title={titleFor("Pregnancy diagnosis", preset)}
      subtitle="Confirm or rule out"
      back
      onRefresh={onRefresh}
      refreshing={refreshing}
      headerRight={isBackdating ? undefined : <BackdateButton type="pd" />}
    >
      {isBackdating ? <BackdateBanner /> : null}
      <Field
        label="Cow(s)"
        help={
          filterLoading
            ? "Loading served animals…"
            : "Served cows, or any cow bred naturally: with no service on file, give the conception date below."
        }
      >
        <AnimalPickerButton
          mode="multi"
          title="Select cows"
          preferHerds={breedingHerds}
          placeholder={
            filterLoading
              ? "Loading cows awaiting a check…"
              : selected.length
                ? `${selected.length} selected — tap to change`
                : "Search cow or heifer..."
          }
          include={(a) => a.sex === "F" && a.repro !== "Calf"}
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
      {needsConception ? (
        <>
          <Banner tone="info">
            {noService.length === 1 ? `${noService[0].name} has` : `${noService.length} cows have`} no service on
            file. The perceived conception date makes the natural service.
          </Banner>
          <Field label="Perceived conception date" help="From the vet or the herdsman. Or give the foetal age instead.">
            <DateField value={conception} onChange={setConception} maximumDate={fromISODate(serverToday)} placeholder="Pick the conception date" />
          </Field>
          {!conception ? (
            <Field label="Foetal age (weeks)" help="Used only when there is no conception date.">
              <Input value={weeks} onChangeText={setWeeks} keyboardType="numeric" placeholder="e.g. 12" />
            </Field>
          ) : null}
          {single && conception ? <SireChooser choice={sire} /> : null}
        </>
      ) : null}
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
