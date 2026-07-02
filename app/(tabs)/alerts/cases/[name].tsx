import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { appAlert } from "@/src/ui/appAlert";

import { AttachmentPicker } from "@/components/AttachmentPicker";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { ErrorState } from "@/components/ErrorState";
import { Field, Input, Textarea } from "@/components/Field";
import { KV } from "@/components/KV";
import { Loader } from "@/components/Loader";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { attachFile, type FileAsset } from "@/src/frappe/files";
import { useAnimal } from "@/src/hooks/useAnimal";
import { useAnimalHealthCase } from "@/src/hooks/useAnimalHealthCase";
import { useUpdateAnimalHealthCase } from "@/src/hooks/mutations";
import { extractFrappeError, todayISO } from "@/src/services/api";

type Outcome = "Recovered" | "Chronic" | "Died";

export default function CaseDetail() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { name } = useLocalSearchParams<{ name: string }>();
  const decodedName = name ? decodeURIComponent(name) : "";
  const { data: theCase, isLoading, error, refetch } = useAnimalHealthCase(decodedName);
  const { data: animal } = useAnimal(theCase?.animal);
  const updateMutation = useUpdateAnimalHealthCase();

  const [outcome, setOutcome] = useState<Outcome>("Recovered");
  const [closingNotes, setClosingNotes] = useState("");
  const [closingDate, setClosingDate] = useState(todayISO());
  const [postMortemFiles, setPostMortemFiles] = useState<FileAsset[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (isLoading) return <Screen title="Case" back><Loader /></Screen>;
  if (error || !theCase) {
    return (
      <Screen title="Case" back>
        <ErrorState text={extractFrappeError(error) || "Case not found"} onRetry={refetch} />
      </Screen>
    );
  }

  const isOpen = theCase.caseStatus === "Open" || theCase.caseStatus === "Under Treatment";
  // Insured value sits on the Animal doc; useAnimal returns AnimalDetail
  // which doesn't yet expose insured_value explicitly. Read defensively.
  const insuredValue = Number((animal as any)?.insuredValue ?? (animal as any)?.insured_value ?? 0);

  const handleClose = async () => {
    setSubmitError(null);
    if (closingDate > todayISO()) {
      return setSubmitError("Closing date can't be in the future.");
    }
    try {
      await updateMutation.mutateAsync({
        name: theCase.name,
        caseStatus: outcome,
        closingNotes: closingNotes.trim() || undefined,
        closingDate,
      });
    } catch (err) {
      return setSubmitError(extractFrappeError(err));
    }

    const attachErrors: string[] = [];
    if (outcome === "Died" && postMortemFiles.length > 0) {
      for (const f of postMortemFiles) {
        try {
          await attachFile({
            doctype: "Animal Health Case",
            docname: theCase.name,
            asset: f,
            isPrivate: true,
          });
        } catch (e) {
          attachErrors.push(`${f.name}: ${extractFrappeError(e)}`);
        }
      }
    }

    appAlert(
      "Case closed",
      attachErrors.length
        ? `Case marked ${outcome}. Some attachments failed:\n${attachErrors.join("\n")}`
        : `Case marked ${outcome}.`,
    );
    router.replace("/(tabs)/alerts/cases");
  };

  return (
    <Screen title={theCase.animalName} subtitle={`Case · ${theCase.caseStatus}`} back>
      <View style={s.box}>
        <KV k="Animal" v={theCase.animalName} />
        <KV k="Status" v={theCase.caseStatus} />
        <KV k="Severity" v={theCase.severity || "—"} />
        <KV k="Opened" v={theCase.openedDate} />
        {theCase.closingDate ? <KV k="Closed" v={theCase.closingDate} /> : null}
        <KV k="Treatments cost" v={`${theCase.totalTreatmentCost.toLocaleString()} KES`} />
      </View>

      <SectionTitle>Symptoms</SectionTitle>
      <Text style={s.body}>{theCase.presentingSymptoms || "—"}</Text>

      {theCase.treatments.length > 0 ? (
        <>
          <SectionTitle>Treatments</SectionTitle>
          <View style={s.box}>
            {theCase.treatments.map((t, i) => (
              <KV
                key={i}
                k={`${t.itemName}${t.qty ? ` · ${t.qty} ${t.uom}` : ""}`}
                v={`${t.amount.toLocaleString()} KES`}
              />
            ))}
          </View>
        </>
      ) : null}

      {isOpen ? (
        <>
          <SectionTitle>Close case</SectionTitle>
          <Field label="Outcome">
            <Chips>
              {(["Recovered", "Chronic", "Died"] as Outcome[]).map((o) => (
                <Chip key={o} label={o} active={outcome === o} onPress={() => setOutcome(o)} />
              ))}
            </Chips>
          </Field>

          <Field label="Closing notes">
            <Textarea
              value={closingNotes}
              onChangeText={setClosingNotes}
              placeholder="Outcome details, follow-up, etc."
            />
          </Field>

          <Field label="Closing date">
            <Input value={closingDate} onChangeText={setClosingDate} placeholder={todayISO()} />
          </Field>

          {outcome === "Died" ? (
            <>
              <Banner tone={insuredValue > 0 ? "info" : "warning"}>
                {insuredValue > 0
                  ? `Insured for KES ${insuredValue.toLocaleString()}. After closing, record a disposal to trigger the insurance receivable JE.`
                  : "Not insured. Closing will mark the case Died; no claim posts."}
              </Banner>
              <Field label="Post-mortem report">
                <AttachmentPicker
                  value={postMortemFiles}
                  onChange={setPostMortemFiles}
                  helpText="PDF or image. Multiple files OK."
                />
              </Field>
              <Button
                label="Open disposal form"
                variant="outline"
                icon="logout"
                onPress={() =>
                  router.push(
                    `/(tabs)/record/culls/new?animalId=${encodeURIComponent(theCase.animal)}&disposalType=${encodeURIComponent("Died — Disease")}`,
                  )
                }
              />
            </>
          ) : null}

          {submitError ? <Banner tone="danger">{submitError}</Banner> : null}

          <Button
            label={updateMutation.isPending ? "Closing…" : `Close case (${outcome})`}
            loading={updateMutation.isPending}
            disabled={updateMutation.isPending}
            onPress={handleClose}
          />
        </>
      ) : (
        <Banner tone="info">This case is closed. Open it on desktop to make changes.</Banner>
      )}
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    box: { backgroundColor: c.bgMuted, padding: 12, borderRadius: RADIUS.md, marginBottom: 12 },
    body: { fontSize: 13, color: c.text, marginBottom: 12, fontFamily: FONT_FAMILY.regular },
  });
