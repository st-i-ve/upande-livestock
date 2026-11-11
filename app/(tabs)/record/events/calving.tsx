import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { BackdateBanner } from "@/components/BackdateBanner";
import { BackdateButton } from "@/components/BackdateButton";
import { Banner } from "@/components/Banner";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { DateField, fromISODate } from "@/components/DateTimeField";
import { Field, FieldRow, Input } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { CalfPhotoField } from "@/components/CalfPhotoField";
import { BirthWindowNotice } from "@/components/BirthWindowNotice";
import { StockItemFields } from "@/components/StockItemFields";
import {
  BIRTH_NEEDS_SERVICE,
  diagnosisFits,
  normaliseWindow,
  retroPayload,
  retroProblem,
  suggestedDiagnosisDate,
  suggestedServiceDate,
  type RetroDraft,
} from "@/src/breeding/birthWindow";
import { birthCheck, checkFromRefusal, type BirthCheck } from "@/src/frappe/birthCheck";
import { stockOutcomeText } from "@/src/frappe/eventItems";
import { OpsError } from "@/src/frappe/opsError";
import { useEventItems } from "@/src/hooks/useEventItems";
import { syncAnimals } from "@/src/db/sync";
import type { CalfInput } from "@/src/frappe/calves";
import type { FileAsset } from "@/src/frappe/files";
import { useAnimals } from "@/src/hooks/useAnimals";
import { useBackdate } from "@/src/hooks/useBackdate";
import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";
import { useOperator } from "@/src/hooks/useOperator";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useBeefSettings, useHerds } from "@/src/hooks/useHerds";
import { useLivestockSettings } from "@/src/hooks/useLivestockSettings";
import { extractFrappeError } from "@/src/services/api";
import type { Animal } from "@/types";

type CalfRow = {
  key: number;
  sex: "Female" | "Male";
  burnName: string;
  birthWt: string;
  coat: string;
  health: "Healthy" | "Weak" | "Needs Attention" | "Critical";
  /** "" = the herd Settings routes this sex to. */
  herdPick: string;
  isStillborn: boolean;
  photo: FileAsset | null;
};

let nextCalfKey = 1;
const blankCalf = (): CalfRow => ({
  key: nextCalfKey++,
  sex: "Female",
  burnName: "",
  birthWt: "",
  coat: "",
  health: "Healthy",
  herdPick: "",
  isStillborn: false,
  photo: null,
});

export default function Calving() {
  const { data: animals = [] } = useAnimals();
  const { data: herds = [] } = useHerds();
  const { data: settings } = useLivestockSettings();
  const beef = useBeefSettings();

  const { operator, missingMessage } = useOperator();
  const { isBackdating, eventDate: backdateDate, setEventDate: setBackdateDate } = useBackdate();
  const { today: serverToday } = useBackdatingWindow();
  const offline = useOffline();
  const [dam, setDam] = useState<Animal | null>(null);
  const [outcome, setOutcome] = useState<"Live Birth" | "Still Birth" | "Abortion">("Live Birth");
  const [abortionCause, setAbortionCause] = useState<
    "Infectious" | "Nutritional" | "Traumatic" | "Congenital" | "Unknown" | "Other"
  >("Unknown");
  const [coatNote, setCoatNote] = useState("");
  const [calves, setCalves] = useState<CalfRow[]>(() => [blankCalf()]);
  const [error, setError] = useState<string | null>(null);

  const pregnantCount = animals.filter((a) => a.pregnant).length;
  const birthDate = isBackdating ? backdateDate : serverToday;

  // The birth window (server: common/birth_window). Asked as soon as a dam and
  // a date are picked, so the retro path is offered before the calves are typed.
  const [check, setCheck] = useState<BirthCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [retro, setRetro] = useState<RetroDraft | null>(null);
  const [herdTouched, setHerdTouched] = useState(false);
  const [strawUom, setStrawUom] = useState("");
  const { choices: strawChoices, consumes: serviceConsumes } = useEventItems("Service");
  const win = normaliseWindow(check?.window?.min_days, check?.window?.max_days);
  const needsRetro = !!check && !check.allowed && outcome !== "Abortion";
  const patchRetro = (patch: Partial<RetroDraft>) => setRetro((r) => (r ? { ...r, ...patch } : r));

  useEffect(() => {
    setCheck(null);
    setRetro(null);
    setHerdTouched(false);
    if (!dam || offline) return;
    let live = true;
    setChecking(true);
    birthCheck(dam.id, birthDate)
      .then((got) => live && setCheck(got))
      .catch(() => live && setCheck(null)) // the server decides again on save
      .finally(() => live && setChecking(false));
    return () => {
      live = false;
    };
  }, [dam, birthDate, offline]);

  // A retro path starts from the middle of the window, the farm's default service.
  useEffect(() => {
    if (!check || check.allowed || !check.retro_allowed) return;
    setRetro((r) =>
      r ?? {
        serviceDate: suggestedServiceDate(check.birth_date, win),
        serviceType: beef.defaultServiceType === "A.I." ? "A.I." : "Natural",
        withDiagnosis: false,
        herd: "",
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check]);

  // Where her history puts her on the service date starts the herd picker.
  const retroServiceDate = retro?.serviceDate ?? "";
  useEffect(() => {
    if (!dam || !retroServiceDate || herdTouched || offline) return;
    let live = true;
    birthCheck(dam.id, birthDate, retroServiceDate)
      .then((got) => {
        if (live) patchRetro({ herd: got.herd_on_service_date || got.current_herd || "" });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dam, birthDate, retroServiceDate, herdTouched, offline]);

  // A calf is born into its dam's herd and stays with her until the separation age.
  // Only a dam with no herd falls back to Livestock Settings' calf herd for the sex.
  const defaultCalfHerd = (sex: "Female" | "Male") => {
    if (dam?.herd && herds.some((h) => h.n === dam.herd)) return dam.herd;
    const t = sex === "Female" ? settings?.female_calf_herd : settings?.male_calf_herd;
    return t && herds.some((h) => h.n === t) ? t : (herds[0]?.n ?? "");
  };
  const patchCalf = (key: number, patch: Partial<CalfRow>) =>
    setCalves((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const mutation = useCreateAnimalEvent();

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError(missingMessage);
    if (!dam) return setError("Pick the dam (mother).");
    if (outcome === "Live Birth" && calves.some((c) => !c.isStillborn && !c.burnName.trim())) {
      return setError("Give every live calf a name. Its book number is assigned when you save.");
    }
    if (needsRetro) {
      if (!check?.retro_allowed) {
        return setError(check?.retro_refusal || "A Livestock Manager must record this birth.");
      }
      if (!retro) return setError("Fill in the service this calf came from.");
      const problem = retroProblem(retro, birthDate, win, !!check?.allow_diagnosis);
      if (problem) return setError(problem);
    }

    // A pregnancy loss is not a calving with a bad outcome. It closes the
    // pregnancy and re-opens the cow for service, and the server refuses
    // "Abortion" on a Calving event outright.
    if (outcome === "Abortion") {
      try {
        await mutation.mutateAsync({
          eventType: "Abortion",
          animal: dam.id,
          currentHerd: dam.herd,
          operator,
          eventDate: isBackdating ? backdateDate : serverToday,
          abortionCause,
          abortionNotes: coatNote || undefined,
        });
        Alert.alert(
          "Abortion recorded",
          `${dam.name}'s pregnancy is closed. She becomes servable again once the waiting period is up.`,
        );
        router.replace("/(tabs)/record/success?name=Abortion");
      } catch (err) {
        setError(extractFrappeError(err));
      }
      return;
    }

    try {
      const r = await mutation.mutateAsync({
        eventType: "Calving",
        animal: dam.id,
        currentHerd: dam.herd,
        operator,
        eventDate: birthDate,
        retro: needsRetro && retro ? retroPayload(retro) : undefined,
        calvingOutcome: outcome as "Live Birth" | "Still Birth",
        calves:
          outcome === "Live Birth"
            ? calves.map(
                (c): CalfInput => ({
                  sex: c.sex,
                  burnName: c.burnName.trim(),
                  birthWeightKg: c.birthWt ? Number(c.birthWt) : undefined,
                  coatColour: c.coat || undefined,
                  healthStatus: c.health,
                  herd: c.herdPick || defaultCalfHerd(c.sex) || undefined,
                  isStillborn: c.isStillborn,
                  photo: c.photo,
                }),
              )
            : [{ sex: calves[0]?.sex ?? "Female", isStillborn: true }],
      });

      // The server numbered each calf (A heifers, B bulls). Show them, then pull
      // them into the phone's own animal store now rather than at the next tick.
      const born: { animal: string; tag?: string; herd?: string }[] = r?.calves ?? [];
      void syncAnimals();
      if (outcome === "Live Birth" && born.length) {
        const photoLine =
          r?.photo === "attached"
            ? "\nPhoto saved on the calf's record."
            : r?.photo === "failed"
              ? "\nA photo could not be uploaded, so that calf has none yet. Add it from the animal's page."
              : "";
        const lines = born.map((c) => `${c.animal} in ${c.herd || "—"}`).join("\n");
        Alert.alert(
          "Calving recorded",
          `${dam.name} calved ${born.length === 1 ? "one calf" : `${born.length} calves`}:\n${lines}${photoLine}`,
        );
        const extra = [
          retroNote(r),
          r?.is_backdated ? "The calving and its calves are marked Backdated." : "",
          stockOutcomeText([r]),
          ...(Array.isArray(r?.warnings) ? r.warnings : []),
        ].filter(Boolean);
        if (extra.length) Alert.alert("Note", extra.join("\n"));
        router.replace("/(tabs)/record/success?name=Calving");
        return;
      }

      Alert.alert(
        "Calving recorded",
        [`${dam.name} marked as calved (${outcome}).`, retroNote(r), stockOutcomeText([r])].filter(Boolean).join("\n\n"),
      );
      router.replace("/(tabs)/record/success?name=Calving");
    } catch (err) {
      // Refused for want of a service: show the rule and offer the retro path
      // here, rather than a message to retry. Never queued — the server answered.
      if (err instanceof OpsError && err.code === BIRTH_NEEDS_SERVICE) {
        const refused = checkFromRefusal(err.details);
        if (refused) setCheck(refused);
      }
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen
      title="Calving"
      subtitle="Birth event from existing pregnancy"
      back
      headerRight={isBackdating ? undefined : <BackdateButton type="calving" />}
    >
      {isBackdating ? <BackdateBanner /> : null}
      {pregnantCount === 0 ? (
        <Banner tone="info">No pregnant cows on record; a calving can still be recorded.</Banner>
      ) : null}


      <Field label="Dam (mother)" help="She needs a confirmed pregnancy, or a service that fits the birth date. Without one, record the service first, backdated, below.">
        <AnimalPickerButton
          title="Select dam"
          placeholder="Search cow or heifer..."
          include={(a) => a.sex === "F" && a.repro !== "Calf"}
          value={dam}
          onPickSingle={setDam}
        />
      </Field>

      <FieldRow>
        <Field label="Calving date" style={{ flex: 1 }}>
          {isBackdating ? (
            <DateField value={backdateDate} onChange={setBackdateDate} maximumDate={fromISODate(serverToday)} />
          ) : (
            <Input value={serverToday} editable={false} />
          )}
        </Field>
        <Field label="Outcome" style={{ flex: 1 }}>
          <Picker
            value={outcome}
            onChange={(v) => setOutcome(v as typeof outcome)}
            options={["Live Birth", "Still Birth", "Abortion"]}
          />
        </Field>
      </FieldRow>

      {dam && checking ? <Banner tone="info">Checking her pregnancy record…</Banner> : null}
      {dam && check && outcome !== "Abortion" ? <BirthWindowNotice check={check} damName={dam.name} /> : null}

      {needsRetro && check?.retro_allowed && retro ? (
        <>
          <SectionTitle>1 · The service (backdated)</SectionTitle>
          <FieldRow>
            <Field label="Service date" style={{ flex: 1 }} help={`${check.service_from} to ${check.service_to}`}>
              <DateField
                value={retro.serviceDate}
                onChange={(v) => patchRetro({ serviceDate: v })}
                minimumDate={fromISODate(check.service_from)}
                maximumDate={fromISODate(check.service_to)}
              />
            </Field>
            <Field label="Type" style={{ flex: 1 }}>
              <Picker
                value={retro.serviceType}
                onChange={(v) => patchRetro({ serviceType: v as RetroDraft["serviceType"] })}
                options={["Natural", "A.I."]}
              />
            </Field>
          </FieldRow>
          {retro.serviceType === "A.I." && serviceConsumes ? (
            <StockItemFields
              choices={strawChoices}
              itemLabel="Semen straw (Item)"
              icon="test-tube"
              value={{ itemCode: retro.straw ?? "", uom: strawUom, warehouse: retro.strawWarehouse ?? "" }}
              onChange={(v) => {
                setStrawUom(v.uom);
                patchRetro({ straw: v.itemCode, strawWarehouse: v.warehouse });
              }}
              qtyNeeded={1}
            />
          ) : null}
          <Field
            label={retro.serviceType === "A.I." ? "Bull / sire" : "Bull (optional)"}
            help={retro.serviceType === "Natural" ? "Left blank, the bull in her herd that day is taken as the sire." : "Optional."}
          >
            <Input value={retro.sire ?? ""} onChangeText={(v) => patchRetro({ sire: v })} placeholder="Bull name or number" />
          </Field>

          {check.allow_diagnosis ? (
            <>
              <SectionTitle>2 · Pregnancy diagnosis (optional)</SectionTitle>
              <Chips>
                <Chip
                  label="No diagnosis"
                  active={!retro.withDiagnosis}
                  onPress={() => patchRetro({ withDiagnosis: false })}
                />
                <Chip
                  label="Confirmed by a diagnosis"
                  active={retro.withDiagnosis}
                  onPress={() =>
                    patchRetro({
                      withDiagnosis: true,
                      diagnosisDate:
                        retro.diagnosisDate && diagnosisFits(retro.diagnosisDate, retro.serviceDate, birthDate)
                          ? retro.diagnosisDate
                          : suggestedDiagnosisDate(retro.serviceDate, birthDate),
                    })
                  }
                />
              </Chips>
              {retro.withDiagnosis ? (
                <Field label="Diagnosis date" help="After the service and before the birth.">
                  <DateField
                    value={retro.diagnosisDate ?? ""}
                    onChange={(v) => patchRetro({ diagnosisDate: v })}
                    minimumDate={fromISODate(retro.serviceDate)}
                    maximumDate={fromISODate(birthDate)}
                  />
                </Field>
              ) : null}
            </>
          ) : null}

          <SectionTitle>{`${check.allow_diagnosis ? "3" : "2"} · Her herd on ${retro.serviceDate}`}</SectionTitle>
          <Field help="Recorded as a backdated move in her herd history; she stays where she is today.">
            <Picker
              value={retro.herd}
              placeholder="Choose the herd"
              onChange={(v) => {
                setHerdTouched(true);
                patchRetro({ herd: v });
              }}
              options={herds.map((h) => h.n)}
            />
          </Field>
          <SectionTitle>{`${check.allow_diagnosis ? "4" : "3"} · The birth`}</SectionTitle>
        </>
      ) : null}

      {outcome === "Abortion" ? (
        <>
          <SectionTitle>Pregnancy loss</SectionTitle>
          <Field
            label="Cause"
            help="Recorded so a pattern across the herd can be seen. Pick Unknown rather than guessing."
          >
            <Picker
              value={abortionCause}
              onChange={(v) => setAbortionCause(v as typeof abortionCause)}
              options={["Infectious", "Nutritional", "Traumatic", "Congenital", "Unknown", "Other"]}
            />
          </Field>
          <Field label="Notes">
            <Input
              value={coatNote}
              onChangeText={setCoatNote}
              placeholder="What was observed"
            />
          </Field>
        </>
      ) : null}

      {outcome === "Live Birth" ? (
        <>
          {calves.map((c, i) => (
            <React.Fragment key={c.key}>
              <SectionTitle>{calves.length > 1 ? `Calf ${i + 1} of ${calves.length}` : "Calf details"}</SectionTitle>
              <Field label="Sex">
                <Chips>
                  <Chip label="Female" active={c.sex === "Female"} onPress={() => patchCalf(c.key, { sex: "Female", herdPick: "" })} />
                  <Chip label="Male" active={c.sex === "Male"} onPress={() => patchCalf(c.key, { sex: "Male", herdPick: "" })} />
                  <Chip label="Stillborn" active={c.isStillborn} onPress={() => patchCalf(c.key, { isStillborn: !c.isStillborn })} />
                </Chips>
              </Field>
              <Field
                label="Calf book number"
                help={c.sex === "Female" ? "A series (heifer). The next number is given when you save." : "B series (bull). The next number is given when you save."}
              >
                <Input value={c.isStillborn ? "None - stillborn" : "Book no. assigned on save"} editable={false} />
              </Field>
              {c.isStillborn ? null : (
                <>
                  <Field
                    label="Calf moves to herd"
                    help="Default: the dam's herd. He or she stays with the dam until the calf separation age."
                  >
                    <Picker
                      value={c.herdPick || defaultCalfHerd(c.sex)}
                      onChange={(v) => patchCalf(c.key, { herdPick: v })}
                      options={herds.map((h) => h.n)}
                    />
                  </Field>
                  <Field label="Calf name">
                    <Input value={c.burnName} onChangeText={(v) => patchCalf(c.key, { burnName: v })} placeholder="e.g. BLOSSOM" autoCapitalize="characters" />
                  </Field>
                  <FieldRow>
                    <Field label="Birth weight (kg)" style={{ flex: 1 }}>
                      <Input value={c.birthWt} onChangeText={(v) => patchCalf(c.key, { birthWt: v })} keyboardType="numeric" placeholder="36" />
                    </Field>
                    <Field label="Coat colour" style={{ flex: 1 }}>
                      <Input value={c.coat} onChangeText={(v) => patchCalf(c.key, { coat: v })} placeholder="Black & White" />
                    </Field>
                  </FieldRow>
                  <Field
                    label="Condition at birth"
                    help="Goes onto the calf's own record. A weak calf found early is a calf that survives."
                  >
                    <Picker
                      value={c.health}
                      onChange={(v) => patchCalf(c.key, { health: v as CalfRow["health"] })}
                      options={["Healthy", "Weak", "Needs Attention", "Critical"]}
                    />
                  </Field>
                  <CalfPhotoField value={c.photo} onChange={(a) => patchCalf(c.key, { photo: a })} />
                </>
              )}
              {calves.length > 1 ? (
                <Button
                  label={`Remove calf ${i + 1}`}
                  variant="outline"
                  onPress={() => setCalves((cs) => cs.filter((x) => x.key !== c.key))}
                />
              ) : null}
            </React.Fragment>
          ))}
          <Button
            label="Add another calf (twins)"
            variant="outline"
            icon="plus"
            onPress={() => setCalves((cs) => [...cs, blankCalf()])}
          />
        </>
      ) : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <OnlineOnlyNotice />
      <Button
        label={mutation.isPending ? "Submitting…" : "Submit calving"}
        disabled={offline || mutation.isPending || !dam || (needsRetro && !check?.retro_allowed)}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}

/** What the retro path back-recorded, in words for the alert. */
function retroNote(r: any): string {
  const made = r?.retro;
  if (!made?.service) return "";
  const bits = [`service ${made.service}`];
  if (made.pregnancy_diagnosis) bits.push(`diagnosis ${made.pregnancy_diagnosis}`);
  if (made.movements?.length) bits.push(`${made.movements.length} herd move(s) in her history`);
  return `Back-recorded, marked Backdated: ${bits.join(", ")}.`;
}
