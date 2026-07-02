import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { recordSuccess } from "@/src/ui/recordSuccess";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { AttachmentPicker } from "@/components/AttachmentPicker";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { KV } from "@/components/KV";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import type { DisposalType } from "@/src/frappe/animalDisposal";
import { attachFile, type FileAsset } from "@/src/frappe/files";
import { listDocuments } from "@/src/frappe/generic";
import { useCreateAnimalDisposal } from "@/src/hooks/mutations";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

const TYPES: DisposalType[] = [
  "Culled (Farm Use)",
  "Died — Natural Causes",
  "Died — Disease",
  "Died — Accident",
  "Condemned",
  "Slaughtered",
  "Gifted",
];

export default function CullNew() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const params = useLocalSearchParams<{ disposalType?: string; animalId?: string }>();
  const initialType =
    (params.disposalType && TYPES.includes(params.disposalType as DisposalType)
      ? (params.disposalType as DisposalType)
      : TYPES[0]);

  const [selected, setSelected] = useState<Animal[]>([]);
  const [type, setType] = useState<DisposalType>(initialType);
  const [salvage, setSalvage] = useState("");
  const [reason, setReason] = useState("");
  const [witness, setWitness] = useState("");
  const [insuranceClaim, setInsuranceClaim] = useState("");
  const [giftedTo, setGiftedTo] = useState("");
  const [giftDestination, setGiftDestination] = useState("");
  const [postMortemFiles, setPostMortemFiles] = useState<FileAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalDisposal();

  const resetForm = () => {
    setSelected([]);
    setType(TYPES[0]);
    setSalvage("");
    setReason("");
    setWitness("");
    setInsuranceClaim("");
    setGiftedTo("");
    setGiftDestination("");
    setPostMortemFiles([]);
    setError(null);
  };

  const sVal = Number(salvage) || 0;

  const isDeath = type.startsWith("Died");
  const isGift = type === "Gifted";

  const totalInsured = useMemo(
    () => selected.reduce((sum, a: any) => sum + Number(a?.insuredValue ?? a?.insured_value ?? 0), 0),
    [selected],
  );
  const insuredCount = useMemo(
    () => selected.filter((a: any) => Number(a?.insuredValue ?? a?.insured_value ?? 0) > 0).length,
    [selected],
  );
  const showInsurance = isDeath && totalInsured > 0;

  // Default the claim amount to the total insured when the section first becomes
  // relevant. Clear it when the user switches away from a death type.
  useEffect(() => {
    if (showInsurance && !insuranceClaim) setInsuranceClaim(String(totalInsured));
    if (!showInsurance && insuranceClaim) setInsuranceClaim("");
  }, [showInsurance, totalInsured]); // eslint-disable-line react-hooks/exhaustive-deps

  const claimNum = Number(insuranceClaim) || 0;

  const handleSubmit = async () => {
    setError(null);
    if (selected.length === 0) return setError("Pick at least one animal.");
    if (isGift && !giftedTo.trim()) return setError("Enter the recipient's name for the gift.");
    if (isGift && !giftDestination.trim()) return setError("Enter the destination for the gift.");

    let succeeded = 0;
    let queued = 0;
    const completed: string[] = [];

    const perAnimalClaim = showInsurance && claimNum > 0
      ? Math.round(claimNum / selected.length)
      : undefined;

    for (const animal of selected) {
      try {
        const r = await mutation.mutateAsync({
          animal: animal.id,
          animalName: animal.name,
          disposalType: type,
          disposalDate: todayISO(),
          salePrice: !isGift && sVal > 0 ? sVal : undefined,
          reasonDetails: reason.trim() || undefined,
          witness: witness.trim() || undefined,
          insuranceClaimAmount: perAnimalClaim,
          giftedTo: isGift ? giftedTo.trim() : undefined,
          giftDestination: isGift ? giftDestination.trim() : undefined,
        });
        if (r.queued) queued += 1;
        else succeeded += 1;
        completed.push(animal.name);
      } catch (err) {
        setError(
          `${completed.length} of ${selected.length} disposed. Stopped at ${animal.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }

    // Best-effort post-mortem attachment to each disposal. Look up the most
    // recent Animal Disposal per animal (just submitted) and attach.
    const attachErrors: string[] = [];
    if (postMortemFiles.length > 0 && succeeded > 0) {
      for (const animal of selected) {
        try {
          const rows = await listDocuments<{ name: string }>({
            doctype: "Animal Disposal",
            fields: ["name"],
            filters: [["animal", "=", animal.id]],
            orderBy: "creation desc",
            limit: 1,
          });
          const dispName = rows[0]?.name;
          if (!dispName) continue;
          for (const f of postMortemFiles) {
            try {
              await attachFile({
                doctype: "Animal Disposal",
                docname: dispName,
                asset: f,
                isPrivate: true,
              });
            } catch (e) {
              attachErrors.push(`${animal.name} · ${f.name}: ${extractFrappeError(e)}`);
            }
          }
        } catch (e) {
          attachErrors.push(`${animal.name}: ${extractFrappeError(e)}`);
        }
      }
    }

    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} marked ${type}`);
    if (queued) parts.push(`${queued} queued (offline)`);
    const tail = isGift
      ? "Gift recipient + destination saved on each disposal."
      : isDeath && totalInsured > 0
        ? "Insurance receivable JE posts per animal."
        : succeeded > 0
          ? "Write-off JE posted per animal."
          : "";
    recordSuccess({
      title: "Disposal recorded",
      message: [
        parts.join(" · "),
        tail,
        attachErrors.length ? `Some attachments failed:\n${attachErrors.join("\n")}` : "",
      ].filter(Boolean).join("\n"),
      onAnother: resetForm,
    });
  };

  return (
    <Screen title="Record cull / death / gift" subtitle="Off the active herd" back>
      <Banner tone="warning">
        Submitting removes the animals from active herds and writes off their book values. If the
        animal is insured and the type is a death, Frappe posts the insurance receivable JE.
      </Banner>
      <Field
        label="Animals"
        help="Pick one, several, or a whole herd via the By-herd tab. Same disposal type applied to each."
      >
        <AnimalPickerButton
          mode="multi"
          title="Select animals"
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Search by tag or name…"}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>
      <Field label="Type">
        <Picker value={type} onChange={(v) => setType(v as DisposalType)} options={TYPES} />
      </Field>
      <FieldRow>
        <Field label="Date" style={{ flex: 1 }}>
          <Input value={todayISO()} editable={false} />
        </Field>
        {!isGift ? (
          <Field label="Salvage value per animal (KES)" style={{ flex: 1 }}>
            <Input value={salvage} onChangeText={setSalvage} keyboardType="numeric" placeholder="0" />
          </Field>
        ) : null}
      </FieldRow>

      {isGift ? (
        <>
          <Field label="Gifted to (recipient)">
            <Input
              value={giftedTo}
              onChangeText={setGiftedTo}
              placeholder="e.g. John Mwangi"
            />
          </Field>
          <Field label="Destination (place / organisation)">
            <Input
              value={giftDestination}
              onChangeText={setGiftDestination}
              placeholder="e.g. Kiambu Cooperative Farm"
            />
          </Field>
        </>
      ) : null}

      <Field label={isGift ? "Reason / occasion" : "Reason / cause"}>
        <Textarea
          value={reason}
          onChangeText={setReason}
          placeholder={isGift ? "Optional notes" : "e.g. Chronic mastitis, low yield, BCS critical..."}
        />
      </Field>
      <Field label="Witness / authorised by">
        <Input value={witness} onChangeText={setWitness} placeholder="Manager or vet name" />
      </Field>

      {showInsurance ? (
        <>
          <Banner tone="info">
            {insuredCount} insured animal{insuredCount === 1 ? "" : "s"} · Σ insured value KES {totalInsured.toLocaleString()}
          </Banner>
          <Field label="Insurance claim amount (KES)" help="Default: sum of insured values. Edit if the claim is partial.">
            <Input
              value={insuranceClaim}
              onChangeText={setInsuranceClaim}
              keyboardType="numeric"
              placeholder="0"
            />
          </Field>
          <Field label="Post-mortem report(s)">
            <AttachmentPicker value={postMortemFiles} onChange={setPostMortemFiles} />
          </Field>
        </>
      ) : null}

      <View style={styles.box}>
        <KV k="Animals" v={String(selected.length)} />
        {!isGift ? (
          <>
            <KV k="Salvage per animal" v={`${sVal.toLocaleString()} KES`} />
            <KV k="Total salvage" v={`${(sVal * selected.length).toLocaleString()} KES`} />
          </>
        ) : null}
        {showInsurance ? <KV k="Claim total" v={`${claimNum.toLocaleString()} KES`} /> : null}
        <KV k="Book values" v="(pulled per animal on submit)" />
      </View>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit"}
        disabled={mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        variant="danger"
        onPress={handleSubmit}
      />
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    box: { backgroundColor: c.bgMuted, padding: 12, borderRadius: RADIUS.md, marginBottom: 12 },
  });
