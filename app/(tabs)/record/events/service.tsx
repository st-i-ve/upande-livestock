import { router } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { BackdateBanner } from "@/components/BackdateBanner";
import { BackdateButton } from "@/components/BackdateButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { DateField } from "@/components/DateTimeField";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { StockItemFields } from "@/components/StockItemFields";
import { findShortage, stockOutcomeText } from "@/src/frappe/eventItems";
import { useEventItems } from "@/src/hooks/useEventItems";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useBackdate } from "@/src/hooks/useBackdate";
import { useOperator } from "@/src/hooks/useOperator";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

export default function Service() {

  const { operator, missingMessage } = useOperator();
  const { isBackdating, eventDate: backdateDate, setEventDate: setBackdateDate } = useBackdate();
  const [selected, setSelected] = useState<Animal[]>([]);
  const [type, setType] = useState<"A.I." | "Natural">("A.I.");
  const [straw, setStraw] = useState<string>("");
  const [strawUom, setStrawUom] = useState<string>("");
  const [semenWarehouse, setSemenWarehouse] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const mutation = useCreateAnimalEvent();
  const { choices: semenChoices } = useEventItems("Service");

  const handleSubmit = async () => {
    setError(null);
    setWarning(null);
    if (!operator) return setError(missingMessage);
    if (selected.length === 0) return setError("Pick at least one cow to service.");
    // For A.I. with a semen straw, we issue it from a store — need the source.
    const willIssueSemen = type === "A.I." && !!straw;
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
    let queued = 0;
    const replies: any[] = [];
    for (const a of selected) {
      try {
        const r = await mutation.mutateAsync({
          eventType: "Service",
          animal: a.id,
          currentHerd: a.herd,
          operator,
          eventDate: isBackdating ? backdateDate : todayISO(),
          serviceType: type,
          semenItem: type === "A.I." ? straw || undefined : undefined,
          semenWarehouse: type === "A.I." && semenWarehouse ? semenWarehouse : undefined,
          remarks: remarks || undefined,
        });
        if (r.queued) queued += 1;
        else {
          succeeded += 1;
          replies.push(r.data);
        }
      } catch (err) {
        setError(
          `${succeeded + queued} of ${selected.length} served. Stopped at ${a.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }

    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} served`);
    if (queued) parts.push(`${queued} queued (offline)`);
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
    router.replace("/(tabs)/record/success?name=Service");
  };

  return (
    <Screen
      title="Service / AI"
      subtitle="Issue semen straw"
      back
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
            <DateField value={backdateDate} onChange={setBackdateDate} maximumDate={new Date()} />
          ) : (
            <Input value={todayISO()} editable={false} />
          )}
        </Field>
        <Field label="Type" style={{ flex: 1 }}>
          <Picker value={type} onChange={(v) => setType(v as "A.I." | "Natural")} options={["A.I.", "Natural"]} />
        </Field>
      </FieldRow>
      {type === "A.I." ? (
        <>
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
      <Field label="Remarks">
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Heat signs, technician notes..." />
      </Field>

      {warning ? <Banner tone="warning">{warning} It will still be saved; the store issue waits as a draft.</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit service"}
        disabled={mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}
