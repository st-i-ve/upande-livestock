
import React, { useMemo, useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { BackdateBanner } from "@/components/BackdateBanner";
import { BackdateButton } from "@/components/BackdateButton";
import { Banner } from "@/components/Banner";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Button } from "@/components/Button";
import { DateField, fromISODate } from "@/components/DateTimeField";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { SireChooser } from "@/components/SireChooser";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Screen } from "@/components/Screen";
import { AvailableStockButton } from "@/components/AvailableStockButton";
import { StockItemFields } from "@/components/StockItemFields";
import { VetPicker } from "@/components/VetPicker";
import { findShortage, stockOutcomeText } from "@/src/frappe/eventItems";
import { useEventItems } from "@/src/hooks/useEventItems";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { mergeWarnings } from "@/src/beef/kinship";
import { useBeefSettings, useHerdFacts } from "@/src/hooks/useHerds";
import { useSireChoice } from "@/src/hooks/useSireChoice";
import { useBackdate } from "@/src/hooks/useBackdate";
import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";
import { useOperator } from "@/src/hooks/useOperator";
import { usePullToRefresh, useRefreshOnFocus } from "@/src/hooks/useServerLists";
import { useVetChoice } from "@/src/hooks/useVets";
import { titleFor, useFinishRecording, usePresetAnimal, useSeedAnimal } from "@/src/hooks/useRecordContext";
import { extractFrappeError } from "@/src/services/api";
import type { Animal } from "@/types";

export default function Service() {

  const { operator, missingMessage } = useOperator();
  const { isBackdating, eventDate: backdateDate, setEventDate: setBackdateDate } = useBackdate();
  const { today: serverToday } = useBackdatingWindow();
  const offline = useOffline();
  const [selected, setSelected] = useState<Animal[]>([]);
  const preset = usePresetAnimal();
  useSeedAnimal(preset, selected, (a) => setSelected([a]));
  const finish = useFinishRecording();
  const beef = useBeefSettings();
  const facts = useHerdFacts();
  const breedingKey = facts.breeding.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const breedingHerds = useMemo(() => new Set(facts.breeding), [breedingKey]);
  const [typePick, setType] = useState<"A.I." | "Natural" | null>(null);
  // Natural at Mutara (Settings default_service_type); A.I. stays one tap away.
  const type = typePick ?? beef.defaultServiceType;
  const [conceptionPick, setConception] = useState<string | null>(null);
  const [confirmWarn, setConfirmWarn] = useState(false);
  const [straw, setStraw] = useState<string>("");
  const [strawUom, setStrawUom] = useState<string>("");
  const [semenWarehouse, setSemenWarehouse] = useState<string>("");
  const [outsideSire, setSire] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const mutation = useCreateAnimalEvent();
  const eventDay = isBackdating ? backdateDate : serverToday;
  // Natural service is recorded when it is perceived: the date the bull was seen
  // serving, or the conception the vet or herdsman worked out. Never in the future.
  const conceptionDate = conceptionPick ?? eventDay;
  const single = selected.length === 1 ? selected[0] : null;
  const sire = useSireChoice(single, conceptionDate, type === "Natural");
  // Whether a service issues a straw is the Service event type's own rule
  // (Settings > Stock), read from the server: no rule, no stock section.
  const { choices: semenChoices, consumes } = useEventItems("Service");
  const { vets, vet, setVet } = useVetChoice();
  const { refreshing, onRefresh } = usePullToRefresh();
  useRefreshOnFocus();

  const handleSubmit = async (acknowledged = false) => {
    setError(null);
    setWarning(null);
    if (!operator) return setError(missingMessage);
    if (selected.length === 0) return setError("Pick at least one cow to service.");
    if (type === "Natural" && sire.needsChoice) {
      return setError("More than one bull was with her then: pick the sire, or choose Unknown.");
    }
    if (sire.warnings.length && !acknowledged) {
      setConfirmWarn(true);
      return;
    }
    // For A.I. with a semen straw, we issue it from a store — need the source.
    const willIssueSemen = consumes && type === "A.I." && !!straw;
    if (willIssueSemen && !semenWarehouse) {
      return setError("Pick the store the semen straws come from.");
    }
    // Heads-up only, never a block: the server saves a short issue as a draft.
    // One straw per cow is issued from the store.
    if (willIssueSemen) {
      const shortage = await findShortage(semenChoices, [
        { itemCode: straw, warehouse: semenWarehouse, qtyNeeded: selected.length },
      ]);
      if (shortage) setWarning(shortage);
    }

    let succeeded = 0;
    const replies: any[] = [];
    const natural = type === "Natural";
    for (const a of selected) {
      try {
        const r = await mutation.mutateAsync({
          eventType: "Service",
          animal: a.id,
          currentHerd: a.herd,
          operator,
          eventDate: eventDay,
          serviceType: type,
          vet: vet || undefined,
          sire: outsideSire.trim() || undefined,
          // One female: the herdsman's choice (or the bull we showed him) goes with
          // the request and wins over inference. Several: the server infers per cow.
          sireAnimal: natural && single && sire.sireAnimal ? sire.sireAnimal : undefined,
          sireUnknown: natural && single && sire.sireUnknown ? true : undefined,
          conceptionDate: natural ? conceptionDate : undefined,
          semenItem: willIssueSemen ? straw : undefined,
          semenWarehouse: willIssueSemen && semenWarehouse ? semenWarehouse : undefined,
          remarks: remarks || undefined,
        });
        succeeded += 1;
        replies.push(r);
      } catch (err) {
        setError(
          `${succeeded} of ${selected.length} served. Stopped at ${a.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }

    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} served`);
    // The server issues one straw per service in the same call; what it says
    // happened (posted, or a draft waiting for stock) is shown as-is.
    const stockNote = stockOutcomeText(replies);
    const sireLines = replies
      .map((rep, i) =>
        rep?.sire_label
          ? `${selected[i]?.name ?? "Cow"}: sire ${rep.sire_label}${rep.sire_inferred ? " (inferred)" : ""}`
          : rep?.candidates?.length > 1
            ? `${selected[i]?.name ?? "Cow"}: sire unknown (${rep.candidates.length} bulls were there)`
            : "",
      )
      .filter(Boolean);
    const warned = mergeWarnings(...replies.map((rep) => (Array.isArray(rep?.warnings) ? rep.warnings : [])));
    if (willIssueSemen && !stockNote && succeeded) {
      parts.push(`${succeeded} straw(s) issued from ${semenWarehouse}`);
    }
    Alert.alert(
      stockNote ? "Service saved — stock issue pending" : "Service recorded",
      [parts.join(" · "), ...sireLines, stockNote, ...warned].filter(Boolean).join("\n\n"),
    );
    finish("Service");
  };

  return (
    <Screen
      title={titleFor("Service", preset)}
      subtitle={type === "Natural" ? "Natural service, bull running with the herd" : "A.I. with a semen straw"}
      back
      onRefresh={onRefresh}
      refreshing={refreshing}
      headerRight={isBackdating ? undefined : <BackdateButton type="service" />}
    >
      {isBackdating ? <BackdateBanner /> : null}
      <Field
        label="Cow(s)"
        help="Pick one or many. Cows in breeding herds are listed first. One service per cow on submit."
      >
        <AnimalPickerButton
          mode="multi"
          title="Select cows (eligible only)"
          preferHerds={breedingHerds}
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Search cow or heifer..."}
          include={(a) => a.sex === "F" && !a.pregnant && a.repro !== "Calf"}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>
      <FieldRow>
        <Field label={type === "Natural" ? "Date recorded" : "Service date"} style={{ flex: 1 }}>
          {isBackdating ? (
            <DateField value={backdateDate} onChange={setBackdateDate} maximumDate={fromISODate(serverToday)} />
          ) : (
            <Input value={serverToday} editable={false} />
          )}
        </Field>
        <Field label="Type" style={{ flex: 1 }}>
          <Picker value={type} onChange={(v) => setType(v as "A.I." | "Natural")} options={["Natural", "A.I."]} />
        </Field>
      </FieldRow>
      {type === "Natural" ? (
        <>
          <Field
            label="Perceived conception date"
            help="The day the bull was seen serving, or the conception the vet or you worked out. The sire is the mature bull who was in her herd around then."
          >
            <DateField value={conceptionDate} onChange={setConception} maximumDate={fromISODate(serverToday)} />
          </Field>
          {single ? <SireChooser choice={sire} /> : selected.length > 1 ? (
            <Banner tone="info">The server finds each cow&apos;s sire from the bull in her herd at conception, and asks you where more than one was there.</Banner>
          ) : null}
        </>
      ) : null}
      {type === "A.I." && consumes ? (
        <>
          <AvailableStockButton eventType="Service" />
          <StockItemFields
            choices={semenChoices}
            itemLabel="Semen straw (Item)"
            icon="test-tube"
            value={{ itemCode: straw, uom: strawUom, warehouse: semenWarehouse }}
            onChange={(v) => {
              setStraw(v.itemCode);
              setStrawUom(v.uom);
              setSemenWarehouse(v.warehouse);
            }}
            qtyNeeded={selected.length}
          />
        </>
      ) : null}
      <Field label={type === "Natural" ? "Outside bull (not on the farm)" : "Bull / sire"} help={type === "A.I." && consumes ? "Optional. With a straw picked, the server takes the sire from the straw." : "Optional."}>
        <Input value={outsideSire} onChangeText={setSire} placeholder="Bull name or number" />
      </Field>
      <VetPicker vets={vets} value={vet} onChange={setVet} label="Vet / AI technician" />
      <Field label="Remarks">
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Heat signs, technician notes..." />
      </Field>

      {warning ? <Banner tone="warning">{warning} It will still be saved; the store issue waits as a draft.</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <OnlineOnlyNotice />
      <Button
        label={mutation.isPending ? "Submitting…" : "Submit service"}
        disabled={offline || mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        onPress={() => handleSubmit()}
      />
      <ConfirmModal
        visible={confirmWarn}
        title="Inbreeding warning"
        message={`${sire.warnings.join("\n")}\n\nSave the service anyway? The warning is kept on the record.`}
        confirmLabel="Save anyway"
        cancelLabel="Go back"
        onCancel={() => setConfirmWarn(false)}
        onConfirm={() => {
          setConfirmWarn(false);
          void handleSubmit(true);
        }}
      />
    </Screen>
  );
}
