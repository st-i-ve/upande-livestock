import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { Field, FieldRow, Input } from "@/components/Field";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { ClassCounts } from "@/components/shoats/ClassCounts";
import { useDayField } from "@/components/shoats/DayField";
import { DestinationHerdField, useHerdField } from "@/components/shoats/HerdField";
import { SaveBanners } from "@/components/shoats/SaveBanners";
import { useOperator } from "@/src/hooks/useOperator";
import { useColors } from "@/src/hooks/useColors";
import { recordCountEvent, type CountEventType } from "@/src/shoats/api";
import { useShoatOptions } from "@/src/shoats/hooks";
import { allCounts, cleanCounts, countVariance, overdrawn, prefillFromLedger, totalOf, varianceText } from "@/src/shoats/logic";
import { useSubmit } from "@/src/shoats/useSubmit";

type Kind = "Head Count" | "Death" | "Purchase" | "Sale" | "Slaughter" | "Transfer Out";
const KINDS: { id: Kind; label: string }[] = [
  { id: "Head Count", label: "Head count" },
  { id: "Death", label: "Death" },
  { id: "Purchase", label: "Purchase" },
  { id: "Sale", label: "Sale" },
  { id: "Slaughter", label: "Slaughter" },
  { id: "Transfer Out", label: "Transfer" },
];
const REMOVES: Kind[] = ["Death", "Sale", "Slaughter", "Transfer Out"];

/**
 * Head count and movements, all by number per herd: a count against the ledger
 * (the variance shows and the count becomes the new head), deaths with cause,
 * purchases, sales and slaughter, and transfers to another herd or a paddock
 * (the server books both sides).
 */
export default function CountAndMovements() {
  const c = useColors();
  const offline = useOffline();
  const { operator, missingMessage } = useOperator();
  const options = useShoatOptions().data;
  const { herd, field } = useHerdField();
  const day = useDayField();
  const sub = useSubmit();

  const [kind, setKind] = useState<Kind>("Head Count");
  const [entered, setEntered] = useState<{ key: string; values: Record<string, string> } | null>(null);
  const [cause, setCause] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [toHerd, setToHerd] = useState("");
  const [toPaddock, setToPaddock] = useState("");

  // A head count starts from the books; every other entry starts blank. Figures
  // typed belong to one herd and one kind, so changing either starts afresh.
  const scopeKey = `${herd?.name ?? ""}|${kind}`;
  const typed = entered?.key === scopeKey ? entered.values : herd && kind === "Head Count" ? prefillFromLedger(herd.classes) : {};
  const setTyped = (values: Record<string, string>) => setEntered({ key: scopeKey, values });

  const classes = herd?.classes ?? [];
  const counts = kind === "Head Count" ? allCounts(typed, classes) : cleanCounts(typed);
  const total = totalOf(counts);
  const variance = herd && kind === "Head Count" ? countVariance(total, herd.head) : null;
  const short = REMOVES.includes(kind) ? overdrawn(counts, classes) : [];
  const needsDest = kind === "Transfer Out";
  const destOk = !needsDest || !!toHerd;
  const needsCause = kind === "Death";
  const valid = !!herd && (kind === "Head Count" || total > 0) && short.length === 0 && destOk && (!needsCause || !!cause);

  const save = async () => {
    if (!herd || !valid) return;
    if (!operator) return sub.setError(missingMessage);
    await sub.run(
      () =>
        recordCountEvent({
          herd: herd.name,
          eventType: kind as CountEventType,
          eventDate: day.eventDate,
          counts,
          cause: needsCause ? cause : undefined,
          otherHerd: needsDest ? toHerd : undefined,
          paddock: needsDest ? toPaddock : undefined,
          reason,
          amount: Number(amount.replace(",", ".")) || undefined,
          operator,
        }),
      (r) =>
        kind === "Head Count"
          ? `Count saved: ${total} head${r.variance != null ? ` (${varianceText(r.variance)})` : ""}.`
          : `${kind === "Transfer Out" ? "Transfer" : kind} saved: ${total} head.`,
    );
  };

  return (
    <Screen title="Count & movements" subtitle="Head by number, never per animal" back>
      {field}
      {day.field}
      <Field label="What happened">
        <Chips>
          {KINDS.map((k) => (
            <Chip key={k.id} label={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />
          ))}
          <Chip label="Birth" onPress={() => router.replace(`/(shoats)/record/breeding?mode=Birth${herd ? `&herd=${encodeURIComponent(herd.name)}` : ""}` as any)} />
        </Chips>
      </Field>

      {herd ? (
        <Field
          label={kind === "Head Count" ? "Head counted" : REMOVES.includes(kind) ? "Head leaving" : "Head arriving"}
          help={kind === "Head Count" ? "Starts from the books. Change what you actually counted." : undefined}
        >
          <ClassCounts classes={classes} value={typed} onChange={setTyped} />
        </Field>
      ) : null}

      {herd && kind === "Head Count" && variance !== null ? (
        <Banner tone={variance === 0 ? "success" : "warning"}>
          {`Counted ${total} against ${herd.head} on the books: ${varianceText(variance)}.${variance !== 0 ? " Saving makes the count the new head." : ""}`}
        </Banner>
      ) : null}
      {short.length ? (
        <Text style={[styles.err, { color: c.danger }]}>
          {short.map((k) => `Only ${k.head} ${k.label.toLowerCase()} in this herd.`).join(" ")}
        </Text>
      ) : null}

      {needsCause ? (
        <Field label="Cause of death">
          <Picker value={cause} onChange={setCause} options={options?.causes ?? []} placeholder="Pick a cause" />
        </Field>
      ) : null}

      {needsDest ? (
        <>
          <DestinationHerdField value={toHerd} onChange={setToHerd} exclude={herd?.name} label="Transfer to herd" />
          <Field label="Paddock they go to" help="Optional, kept as a note on the transfer.">
            <FrappeSearchPicker doctype="Warehouse" value={toPaddock || null} onChange={(n) => setToPaddock(n)} placeholder="Pick a paddock or pen" />
          </Field>
        </>
      ) : null}

      {kind === "Purchase" || kind === "Sale" || kind === "Slaughter" ? (
        <Field label={kind === "Purchase" ? "Total cost" : "Total received"} help="Optional.">
          <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
        </Field>
      ) : null}

      <Field label={kind === "Purchase" ? "Supplier" : kind === "Sale" ? "Buyer" : "Note"} help="Optional.">
        <Input value={reason} onChangeText={setReason} placeholder="" />
      </Field>

      <SaveBanners error={sub.error} note={sub.note} result={sub.result} />
      <OnlineOnlyNotice />
      <FieldRow>
        <Button label={sub.busy ? "Recording…" : "Record"} disabled={offline || sub.busy || !valid} loading={sub.busy} onPress={save} />
      </FieldRow>
    </Screen>
  );
}

const styles = StyleSheet.create({ err: { fontSize: 12, marginBottom: 10 } });
