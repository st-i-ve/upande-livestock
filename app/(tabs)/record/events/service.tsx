
import React, { useState } from "react";
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
import { Screen } from "@/components/Screen";
import { AvailableStockButton } from "@/components/AvailableStockButton";
import { StockItemFields } from "@/components/StockItemFields";
import { VetPicker } from "@/components/VetPicker";
import { findShortage, stockOutcomeText } from "@/src/frappe/eventItems";
import { useEventItems } from "@/src/hooks/useEventItems";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
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
  const [type, setType] = useState<"A.I." | "Natural">("A.I.");
  const [straw, setStraw] = useState<string>("");
  const [strawUom, setStrawUom] = useState<string>("");
  const [semenWarehouse, setSemenWarehouse] = useState<string>("");
  const [sire, setSire] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const mutation = useCreateAnimalEvent();
  // Whether a service issues a straw is the Service event type's own rule
  // (Settings > Stock), read from the server: no rule, no stock section.
  const { choices: semenChoices, consumes } = useEventItems("Service");
  const { vets, vet, setVet } = useVetChoice();
  const { refreshing, onRefresh } = usePullToRefresh();
  useRefreshOnFocus();

  const handleSubmit = async () => {
    setError(null);
    setWarning(null);
    if (!operator) return setError(missingMessage);
    if (selected.length === 0) return setError("Pick at least one cow to service.");
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
    for (const a of selected) {
      try {
        const r = await mutation.mutateAsync({
          eventType: "Service",
          animal: a.id,
          currentHerd: a.herd,
          operator,
          eventDate: isBackdating ? backdateDate : serverToday,
          serviceType: type,
          vet: vet || undefined,
          sire: sire.trim() || undefined,
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
    if (willIssueSemen && !stockNote && succeeded) {
      parts.push(`${succeeded} straw(s) issued from ${semenWarehouse}`);
    }
    Alert.alert(
      stockNote ? "Service saved — stock issue pending" : "Service recorded",
      [parts.join(" · "), stockNote].filter(Boolean).join("\n\n"),
    );
    finish("Service");
  };

  return (
    <Screen
      title={titleFor("Service / AI", preset)}
      subtitle="Issue semen straw"
      back
      onRefresh={onRefresh}
      refreshing={refreshing}
      headerRight={isBackdating ? undefined : <BackdateButton type="service" />}
    >
      {isBackdating ? <BackdateBanner /> : null}
      <Field
        label="Cow(s)"
        help="Pick one or many. Same straw issued per cow; one Animal Event per cow on submit."
      >
        <AnimalPickerButton
          mode="multi"
          title="Select cows (eligible only)"
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Search cow on heat..."}
          include={(a) => a.sex === "F" && !a.pregnant && a.repro !== "Calf"}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>
      <FieldRow>
        <Field label="Service date" style={{ flex: 1 }}>
          {isBackdating ? (
            <DateField value={backdateDate} onChange={setBackdateDate} maximumDate={fromISODate(serverToday)} />
          ) : (
            <Input value={serverToday} editable={false} />
          )}
        </Field>
        <Field label="Type" style={{ flex: 1 }}>
          <Picker value={type} onChange={(v) => setType(v as "A.I." | "Natural")} options={["A.I.", "Natural"]} />
        </Field>
      </FieldRow>
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
      <Field label="Bull / sire" help={type === "A.I." && consumes ? "Optional. With a straw picked, the server takes the sire from the straw." : "Optional."}>
        <Input value={sire} onChangeText={setSire} placeholder="Bull name or number" />
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
        onPress={handleSubmit}
      />
    </Screen>
  );
}
