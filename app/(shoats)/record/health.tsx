import React, { useState } from "react";
import { Text } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { Field, FieldRow, Input } from "@/components/Field";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Screen } from "@/components/Screen";
import { useDayField } from "@/components/shoats/DayField";
import { useHerdField } from "@/components/shoats/HerdField";
import { SaveBanners } from "@/components/shoats/SaveBanners";
import { StockItemFields, type StockPick } from "@/components/StockItemFields";
import { findShortage } from "@/src/frappe/eventItems";
import { useColors } from "@/src/hooks/useColors";
import { useOperator } from "@/src/hooks/useOperator";
import { recordTreatment } from "@/src/shoats/api";
import { useShoatOptions } from "@/src/shoats/hooks";
import { withdrawalEnd } from "@/src/shoats/logic";
import { useSubmit } from "@/src/shoats/useSubmit";

const DEFAULT_TYPES = ["Treatment", "Dipping", "Deworming", "Vaccination"];

/**
 * Health by number: a treatment, dipping, deworming or vaccination for the herd,
 * with the product from the Drug Store, the dose per head, how many were treated
 * and the withdrawal. The store issue (dose x number treated) and its cost are the
 * server's.
 */
export default function ShoatHealth() {
  const c = useColors();
  const offline = useOffline();
  const { operator, missingMessage } = useOperator();
  const options = useShoatOptions().data;
  const { herd, field } = useHerdField();
  const day = useDayField();
  const sub = useSubmit();
  const types = options?.treatmentTypes?.length ? options.treatmentTypes : DEFAULT_TYPES;

  const [type, setType] = useState("Treatment");
  const [pick, setPick] = useState<StockPick>({ itemCode: "", uom: "", warehouse: "", batch: "" });
  const [dose, setDose] = useState("");
  const [treated, setTreated] = useState("");
  const [withdrawal, setWithdrawal] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  const dosePerHead = Number(dose.replace(",", "."));
  const n = Math.floor(Number(treated));
  const days = Math.floor(Number(withdrawal)) || 0;
  const tooMany = !!herd && n > herd.head;
  const valid = !!herd && !!pick.itemCode && dosePerHead > 0 && n > 0 && !tooMany;
  const qty = dosePerHead > 0 && n > 0 ? Math.round(dosePerHead * n * 1000) / 1000 : 0;

  const save = async () => {
    if (!herd || !valid) return;
    if (!operator) return sub.setError(missingMessage);
    setWarning(await findShortage(options?.drugs, [{ itemCode: pick.itemCode, warehouse: pick.warehouse, qtyNeeded: qty }]));
    const ok = await sub.run(
      () =>
        recordTreatment({
          herd: herd.name,
          treatmentType: type,
          itemCode: pick.itemCode,
          warehouse: pick.warehouse,
          dosePerHead,
          numberTreated: n,
          withdrawalDays: days || undefined,
          eventDate: day.eventDate,
          operator,
        }),
      () => `${type} saved: ${n} head, ${qty} ${pick.uom} issued${days ? `; withdrawal to ${withdrawalEnd(day.eventDate ?? day.today, days)}` : ""}.`,
    );
    if (ok) {
      setTreated("");
    }
  };

  return (
    <Screen title="Health" subtitle="Treatments by number treated" back>
      {field}
      {day.field}
      <Field label="Type">
        <Chips>
          {types.map((t) => (
            <Chip key={t} label={t} active={type === t} onPress={() => setType(t)} />
          ))}
        </Chips>
      </Field>

      <StockItemFields choices={options?.drugs} value={pick} onChange={setPick} qtyNeeded={qty || undefined} itemLabel="Product (Drug Store)" />

      <Field label={`Dose per head${pick.uom ? ` (${pick.uom})` : ""}`}>
        <Input testID="dose" value={dose} onChangeText={setDose} keyboardType="decimal-pad" placeholder="0" />
      </Field>
      <Field label="Number treated" help={herd ? `${herd.head} head in the herd.` : undefined}>
        <Input testID="treated" value={treated} onChangeText={(v) => setTreated(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" />
      </Field>
      <Field label="Withdrawal (days)" help="Optional: days before slaughter or sale.">
        <Input testID="withdrawal" value={withdrawal} onChangeText={(v) => setWithdrawal(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" />
      </Field>
      {tooMany ? <Text style={{ color: c.danger, fontSize: 12, marginBottom: 10 }}>The herd has {herd?.head} head; you cannot treat {n}.</Text> : null}
      {qty > 0 ? <Text style={{ color: c.textMuted, fontSize: 12, marginBottom: 10 }}>{`${qty} ${pick.uom} will be issued from the store.`}</Text> : null}
      {warning ? <Banner tone="warning">{warning}</Banner> : null}

      <SaveBanners error={sub.error} note={sub.note} result={sub.result} />
      <OnlineOnlyNotice />
      <FieldRow>
        <Button label={sub.busy ? "Recording…" : `Record ${type.toLowerCase()}`} disabled={offline || sub.busy || !valid} loading={sub.busy} onPress={save} />
      </FieldRow>
    </Screen>
  );
}
