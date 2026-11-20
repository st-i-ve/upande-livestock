
import React, { useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { BackdateBanner } from "@/components/BackdateBanner";
import { BackdateButton } from "@/components/BackdateButton";
import { Banner } from "@/components/Banner";
import { OfflineNotice } from "@/components/OnlineOnlyNotice";
import { Button } from "@/components/Button";
import { DateField, fromISODate } from "@/components/DateTimeField";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { AvailableStockButton } from "@/components/AvailableStockButton";
import { StockItemFields } from "@/components/StockItemFields";
import { SirePickerButton } from "@/components/SirePickerButton";
import { VetPicker } from "@/components/VetPicker";
import { outOfStock, savedTitle, stockOutcomeText } from "@/src/frappe/eventItems";
import { useEventItems } from "@/src/hooks/useEventItems";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useBackdate } from "@/src/hooks/useBackdate";
import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";
import { useOperator } from "@/src/hooks/useOperator";
import { usePullToRefresh, useRefreshOnFocus } from "@/src/hooks/useServerLists";
import { sireFields } from "@/src/frappe/sireList";
import { useVetChoice } from "@/src/hooks/useVets";
import { titleFor, useFinishRecording, usePresetAnimal, useSeedAnimal } from "@/src/hooks/useRecordContext";
import { extractFrappeError } from "@/src/services/api";
import type { Animal } from "@/types";
import { useRecordDraft } from "@/src/hooks/useRecordDraft";

export default function Service() {

  const { operator, missingMessage } = useOperator();
  const { isBackdating, eventDate: backdateDate, setEventDate: setBackdateDate } = useBackdate();
  const { today: serverToday } = useBackdatingWindow();
  const [selected, setSelected] = useState<Animal[]>([]);
  const preset = usePresetAnimal();
  useSeedAnimal(preset, selected, (a) => setSelected([a]));
  const finish = useFinishRecording();
  const [type, setType] = useState<"A.I." | "Natural">("A.I.");
  const [straw, setStraw] = useState<string>("");
  const [strawUom, setStrawUom] = useState<string>("");
  const [semenWarehouse, setSemenWarehouse] = useState<string>("");
  // The picked Livestock Sire, and the typed fallback for "Sire not listed".
  const [sireLink, setSireLink] = useState("");
  const [sire, setSire] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalEvent();
  // Whether a service issues a straw is the Service event type's own rule
  // (Settings > Stock), read from the server: no rule, no stock section.
  const { choices: semenChoices, consumes } = useEventItems("Service");
  const { vets, vet, setVet } = useVetChoice();
  const { refreshing, onRefresh } = usePullToRefresh();
  useRefreshOnFocus();

  // Left by a tab switch with input in it: kept for "Continue recording".
  useRecordDraft({
    title: "Service",
    state: { selected, type, straw, strawUom, semenWarehouse, sireLink, sire, remarks, vet, day: isBackdating ? backdateDate : "" },
    filled:
      selected.some((a) => a.id !== preset?.id) ||
      type !== "A.I." ||
      !!(straw || sireLink || sire.trim() || remarks.trim()),
    restore: (d) => {
      setSelected(d.selected);
      setType(d.type);
      setStraw(d.straw);
      setStrawUom(d.strawUom);
      setSemenWarehouse(d.semenWarehouse);
      setSireLink(d.sireLink ?? "");
      setSire(d.sire ?? "");
      setRemarks(d.remarks);
      setVet(d.vet);
      if (isBackdating && d.day) setBackdateDate(d.day);
    },
  });

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError(missingMessage);
    if (selected.length === 0) return setError("Pick at least one cow to service.");
    // For A.I. with a semen straw, we issue it from a store — need the source.
    const willIssueSemen = consumes && type === "A.I." && !!straw;
    // A straw the stores hold none of has no store to name: the server saves
    // the service and leaves the issue as a draft.
    const strawChoice = semenChoices?.find((x) => x.value === straw);
    if (willIssueSemen && !semenWarehouse && !outOfStock(strawChoice)) {
      return setError("Pick the store the semen straws come from.");
    }
    // The "store can't cover it" notice sits under the picker, before saving.

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
          ...sireFields(sireLink, sire),
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
      savedTitle("Service", replies),
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
      <Field label="Bull / sire" help={type === "A.I." && consumes ? "Optional. A semen sire fills his straw; with a straw picked, the server takes the sire from the straw." : "Optional."}>
        <SirePickerButton
          linked={sireLink}
          typed={sire}
          onType={setSire}
          onPick={(b) => {
            setSireLink(b?.name ?? "");
            // A semen sire brings his straw when the form has one to fill.
            const ch = b?.semenItem ? semenChoices?.find((x) => x.value === b.semenItem) : undefined;
            if (ch && consumes && type === "A.I.") {
              setStraw(ch.value);
              setStrawUom(ch.uom ?? "");
              setSemenWarehouse(ch.warehouse ?? "");
            }
          }}
        />
      </Field>
      <VetPicker vets={vets} value={vet} onChange={setVet} label="Vet / AI technician" />
      <Field label="Remarks">
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Heat signs, technician notes..." />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <OfflineNotice />
      <Button
        label={mutation.isPending ? "Submitting…" : "Submit service"}
        disabled={mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}
