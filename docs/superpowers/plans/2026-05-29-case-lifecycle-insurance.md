# Case lifecycle + insurance — sub-project B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Operator can close Health Cases with an outcome (Recovered / Chronic / Died), attach post-mortem files when relevant, see insured value on the animal detail and during disposal, and override the insurance-claim amount on disposal.

**Architecture:** Pure UI + new Frappe writes/reads against existing fields. No schema changes (reuses `Animal.insured_value`, `Animal Health Case.case_status / closing_notes / closing_date`, `Animal Disposal.insurance_claim_amount`). New `attachFile()` helper wraps Frappe's `/api/method/upload_file` endpoint.

**Tech Stack:** Expo / React Native, expo-router, React Query, Axios, Frappe REST API, `expo-document-picker`.

**Spec:** `docs/superpowers/specs/2026-05-29-case-lifecycle-insurance-design.md`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/frappe/files.ts` | Create | `attachFile()` — uploads a file and attaches it to a Frappe doc. |
| `components/AttachmentPicker.tsx` | Create | UI wrapper around expo-document-picker, returns one or more selected assets. |
| `src/frappe/animalHealthCase.ts` | Modify | `updateAnimalHealthCase(input)` + `getAnimalHealthCase(name)`. |
| `src/hooks/useAnimalHealthCase.ts` | Create | React Query hook for a single case. |
| `src/hooks/mutations.ts` | Modify | `useUpdateAnimalHealthCase`. |
| `src/offline/queue.ts` | Modify | New mutation type `"AnimalHealthCaseUpdate"`. |
| `src/offline/dispatcher.ts` | Modify | Wire handler. |
| `app/(tabs)/alerts/cases.tsx` | Modify | Row press routes to `/(tabs)/alerts/cases/[name]`. |
| `app/(tabs)/alerts/cases/[name].tsx` | Create | Case detail + close screen. |
| `src/frappe/animalDisposal.ts` | Modify | Add `insuranceClaimAmount` and `postMortemFile` (returned, not sent) to input; map to `insurance_claim_amount` on payload. |
| `app/(tabs)/record/culls/new.tsx` | Modify | Insured-value banner + claim-amount input + post-mortem picker. |
| `app/(tabs)/animals/[id].tsx` | Modify | Show "Insured value" KV when set. |

---

## Task 1: Install dependency + write `attachFile` helper

**Files:**
- Modify: `package.json` (only if `expo-document-picker` not installed)
- Create: `src/frappe/files.ts`

- [ ] **Step 1: Verify or install `expo-document-picker`**

Run:
```bash
node -e "try{require('expo-document-picker');console.log('OK')}catch(e){console.log('MISSING')}"
```

If output is `MISSING`, run:
```bash
npx expo install expo-document-picker
```

(If `OK`, skip this command.)

- [ ] **Step 2: Write `src/frappe/files.ts`**

```ts
// src/frappe/files.ts
import { getClient } from "@/src/services/api";

export type FileAsset = {
  uri: string;
  name: string;
  mimeType: string;
};

export type AttachFileInput = {
  doctype: string;
  docname: string;
  asset: FileAsset;
  /** Post-mortems are sensitive — default true (private File doc). */
  isPrivate?: boolean;
};

export type AttachFileResult = {
  fileName: string;
  fileUrl: string;
};

/**
 * Uploads a file to Frappe and attaches it to the given doc via the
 * standard /api/method/upload_file endpoint. Returns the resulting File
 * doc's name + URL. Throws on HTTP / Frappe errors.
 */
export async function attachFile(input: AttachFileInput): Promise<AttachFileResult> {
  const client = await getClient();
  const form = new FormData();
  // React Native FormData accepts the { uri, name, type } shape directly.
  form.append("file", {
    uri: input.asset.uri,
    name: input.asset.name,
    type: input.asset.mimeType,
  } as any);
  form.append("doctype", input.doctype);
  form.append("docname", input.docname);
  form.append("is_private", input.isPrivate === false ? "0" : "1");

  const res = await client.post("/api/method/upload_file", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const file = res.data?.message;
  if (!file?.name) {
    throw new Error("Upload succeeded but Frappe returned no File doc.");
  }
  return { fileName: file.name, fileUrl: file.file_url || "" };
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/frappe/files.ts package.json package-lock.json 2>/dev/null
git commit -m "feat(files): attachFile helper for Frappe uploads"
```

(The `2>/dev/null` ignores missing package-lock.json — fine.)

---

## Task 2: `AttachmentPicker` component

**Files:**
- Create: `components/AttachmentPicker.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/AttachmentPicker.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS, FONT_FAMILY, RADIUS } from "@/constants/theme";
import type { FileAsset } from "@/src/frappe/files";

/**
 * Multi-file picker for post-mortem attachments. Returns assets the
 * caller can pass to attachFile() after the parent doc is created.
 *
 * Hard cap of 10 MB per file (Frappe's default Site config).
 */
export function AttachmentPicker({
  value,
  onChange,
  label = "Attachments",
  helpText = "Tap to pick PDF or image. Max 10 MB.",
}: {
  value: FileAsset[];
  onChange: (assets: FileAsset[]) => void;
  label?: string;
  helpText?: string;
}) {
  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const next: FileAsset[] = [...value];
    for (const a of result.assets) {
      if (a.size && a.size > 10 * 1024 * 1024) {
        // Silently skip oversize. The component renders a hint below.
        continue;
      }
      next.push({
        uri: a.uri,
        name: a.name,
        mimeType: a.mimeType || "application/octet-stream",
      });
    }
    onChange(next);
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <View style={s.box}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.help}>{helpText}</Text>
      {value.map((a, i) => (
        <View key={`${a.uri}-${i}`} style={s.row}>
          <MaterialCommunityIcons name="paperclip" size={14} color={COLORS.textMuted} />
          <Text style={s.fileName} numberOfLines={1}>{a.name}</Text>
          <Pressable onPress={() => remove(i)} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={14} color={COLORS.textMuted} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={pick} style={s.btn}>
        <MaterialCommunityIcons name="plus" size={14} color={COLORS.text} />
        <Text style={s.btnText}>Add file</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 10,
    gap: 6,
  },
  label: { fontSize: 12, color: COLORS.textMuted, fontFamily: FONT_FAMILY.medium },
  help: { fontSize: 11, color: COLORS.textSubtle },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  fileName: { flex: 1, fontSize: 12, color: COLORS.text },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.md,
  },
  btnText: { fontSize: 12, color: COLORS.text, fontFamily: FONT_FAMILY.medium },
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/AttachmentPicker.tsx
git commit -m "feat(attachments): AttachmentPicker component for case + disposal docs"
```

---

## Task 3: Animal Health Case update + read helpers

**Files:**
- Modify: `src/frappe/animalHealthCase.ts`

- [ ] **Step 1: Add update + getter at the bottom of the file**

Open `src/frappe/animalHealthCase.ts` and append (do not remove existing code):

```ts
// ---------------------------------------------------------------------------
// Update path — used to close a case with an outcome.

export type UpdateAnimalHealthCaseInput = {
  /** Frappe doc name of the existing case. */
  name: string;
  /** New status. Only the closing-statuses make sense here. */
  caseStatus: "Recovered" | "Chronic" | "Died";
  closingNotes?: string;
  closingDate?: string;
};

import { getClient } from "@/src/services/api";
import { getDocument } from "./generic";

export async function updateAnimalHealthCase(
  input: UpdateAnimalHealthCaseInput,
): Promise<any> {
  const client = await getClient();
  const body: Record<string, any> = {
    case_status: input.caseStatus,
  };
  if (input.closingNotes) body.closing_notes = input.closingNotes;
  if (input.closingDate) body.closing_date = input.closingDate;
  const res = await client.put(
    `/api/resource/Animal Health Case/${encodeURIComponent(input.name)}`,
    body,
  );
  return res.data?.data;
}

export type AnimalHealthCaseDetail = {
  name: string;
  animal: string;
  animalName: string;
  caseStatus: CaseStatus;
  severity: CaseSeverity | null;
  openedDate: string;
  closingDate: string | null;
  closingNotes: string | null;
  presentingSymptoms: string;
  totalTreatmentCost: number;
  treatments: {
    treatmentDate: string;
    itemCode: string;
    itemName: string;
    qty: number;
    uom: string;
    rate: number;
    amount: number;
  }[];
};

export async function getAnimalHealthCase(name: string): Promise<AnimalHealthCaseDetail | null> {
  const row = await getDocument<any>("Animal Health Case", name);
  if (!row) return null;
  return {
    name: row.name,
    animal: row.animal,
    animalName: row.animal_name || row.animal,
    caseStatus: row.case_status,
    severity: row.severity ?? null,
    openedDate: row.opened_date,
    closingDate: row.closing_date ?? null,
    closingNotes: row.closing_notes ?? null,
    presentingSymptoms: row.presenting_symptoms ?? "",
    totalTreatmentCost: Number(row.total_treatment_cost ?? 0),
    treatments: Array.isArray(row.treatments)
      ? row.treatments.map((t: any) => ({
          treatmentDate: t.treatment_date ?? "",
          itemCode: t.item_code,
          itemName: t.item_name || t.item_code,
          qty: Number(t.qty ?? 0),
          uom: t.uom || "",
          rate: Number(t.rate ?? 0),
          amount: Number(t.amount ?? Number(t.qty ?? 0) * Number(t.rate ?? 0)),
        }))
      : [],
  };
}
```

Note: the file uses one extra import (`getClient`). If TypeScript flags duplicate imports of `getDocument`, consolidate manually.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/frappe/animalHealthCase.ts
git commit -m "feat(cases): updateAnimalHealthCase + getAnimalHealthCase"
```

---

## Task 4: Hook + offline-aware mutation for case update

**Files:**
- Create: `src/hooks/useAnimalHealthCase.ts`
- Modify: `src/offline/queue.ts`
- Modify: `src/offline/dispatcher.ts`
- Modify: `src/hooks/mutations.ts`

- [ ] **Step 1: Create the detail hook**

```ts
// src/hooks/useAnimalHealthCase.ts
import { useQuery } from "@tanstack/react-query";

import { getAnimalHealthCase } from "@/src/frappe/animalHealthCase";

export function useAnimalHealthCase(name: string | undefined) {
  return useQuery({
    queryKey: ["health-case", name],
    queryFn: () => (name ? getAnimalHealthCase(name) : null),
    enabled: !!name,
  });
}
```

- [ ] **Step 2: Add the mutation type**

In `src/offline/queue.ts`, append to `PendingMutationType`:

```ts
  | "AnimalHealthCaseUpdate";
```

- [ ] **Step 3: Wire dispatcher**

In `src/offline/dispatcher.ts`, add import:

```ts
import { updateAnimalHealthCase } from "@/src/frappe/animalHealthCase";
```

Add to `HANDLERS`:

```ts
  AnimalHealthCaseUpdate: updateAnimalHealthCase,
```

- [ ] **Step 4: Add mutation hook**

In `src/hooks/mutations.ts`, add to existing case imports:

```ts
import {
  CreateAnimalHealthCaseInput,
  UpdateAnimalHealthCaseInput,
  createAnimalHealthCase,
  updateAnimalHealthCase,
} from "@/src/frappe/animalHealthCase";
```

(Replace the existing `createAnimalHealthCase` import block — keep what's there, just add `UpdateAnimalHealthCaseInput` and `updateAnimalHealthCase`.)

Add a label helper:

```ts
const labelCaseUpdate = (i: UpdateAnimalHealthCaseInput): string =>
  `Case close · ${i.name} · ${i.caseStatus}`;
```

Add the hook at the bottom:

```ts
export const useUpdateAnimalHealthCase = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAnimalHealthCaseInput) =>
      tryDirectOrEnqueue("AnimalHealthCaseUpdate", input, updateAnimalHealthCase, labelCaseUpdate(input)),
    onSuccess: () => invalidateAll(qc),
  });
};
```

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc --noEmit
git add src/hooks/useAnimalHealthCase.ts src/offline/queue.ts src/offline/dispatcher.ts src/hooks/mutations.ts
git commit -m "feat(cases): offline-aware useUpdateAnimalHealthCase + detail hook"
```

---

## Task 5: Case detail + close screen

**Files:**
- Create: `app/(tabs)/alerts/cases/[name].tsx`
- Modify: `app/(tabs)/alerts/cases.tsx` — make rows tappable

- [ ] **Step 1: Read existing `app/(tabs)/alerts/cases.tsx`**

Use the Read tool to see current row rendering. Then update so each row in the open/closed lists is a `Pressable` that calls `router.push("/(tabs)/alerts/cases/" + encodeURIComponent(c.name))`. If rows already use `Row` from `components/Row`, just add `onPress` to the Row. Keep all existing display logic.

- [ ] **Step 2: Create the detail screen**

```tsx
// app/(tabs)/alerts/cases/[name].tsx
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

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
import { COLORS, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { attachFile, type FileAsset } from "@/src/frappe/files";
import { useAnimal } from "@/src/hooks/useAnimal";
import { useAnimalHealthCase } from "@/src/hooks/useAnimalHealthCase";
import { useUpdateAnimalHealthCase } from "@/src/hooks/mutations";
import { extractFrappeError, todayISO } from "@/src/services/api";

type Outcome = "Recovered" | "Chronic" | "Died";

export default function CaseDetail() {
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
  const insuredValue = animal ? Number((animal as any).insured_value ?? 0) : 0;

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

    // Best-effort file uploads. Failures don't roll back the close.
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

    Alert.alert(
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

const s = StyleSheet.create({
  box: { backgroundColor: COLORS.bgMuted, padding: 12, borderRadius: RADIUS.md, marginBottom: 12 },
  body: { fontSize: 13, color: COLORS.text, marginBottom: 12, fontFamily: FONT_FAMILY.regular },
});
```

If `useAnimal` doesn't exist at `@/src/hooks/useAnimal`, look in `src/hooks/` — it's used elsewhere in this codebase. If genuinely absent, replace the `useAnimal(theCase?.animal)` line with a direct `useQuery` against `getAnimal(theCase?.animal)` from `src/frappe/animal.ts`, mirroring the existing pattern of other `use<Name>` hooks.

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit
git add app/\(tabs\)/alerts/cases/\[name\].tsx app/\(tabs\)/alerts/cases.tsx
git commit -m "feat(cases): case detail + close screen with outcome and post-mortem"
```

---

## Task 6: Disposal-form enrichment

**Files:**
- Modify: `src/frappe/animalDisposal.ts`
- Modify: `app/(tabs)/record/culls/new.tsx`

- [ ] **Step 1: Extend the disposal input type**

In `src/frappe/animalDisposal.ts`, add `insuranceClaimAmount?: number;` to `CreateAnimalDisposalInput`:

```ts
export type CreateAnimalDisposalInput = {
  animal: string;
  animalName?: string;
  disposalType: DisposalType;
  disposalDate?: string;
  bookValue?: number;
  salePrice?: number;
  buyerName?: string;
  buyerContact?: string;
  reasonDetails?: string;
  witness?: string;
  costCenter?: string;
  incomeAccount?: string;
  disposalAccount?: string;
  insuranceClaimAmount?: number;   // NEW
};
```

In `createAnimalDisposal`, after the existing `if (input.disposalAccount)` line, add:

```ts
  if (input.insuranceClaimAmount != null) body.insurance_claim_amount = input.insuranceClaimAmount;
```

- [ ] **Step 2: Update the disposal screen**

Rewrite `app/(tabs)/record/culls/new.tsx` to (a) compute the total insured value across selected animals, (b) show banner + claim-amount + AttachmentPicker when relevant, (c) split the claim amount pro-rata across animals, (d) upload attachments per disposal after submit.

Read the existing file first. Then add these changes:

State additions:
```tsx
  const [insuranceClaim, setInsuranceClaim] = useState("");
  const [postMortemFiles, setPostMortemFiles] = useState<FileAsset[]>([]);
```

Add imports at top:
```tsx
import { AttachmentPicker } from "@/components/AttachmentPicker";
import { attachFile, type FileAsset } from "@/src/frappe/files";
```

Derived values inside the component (after `sVal` line):
```tsx
  const isDeath = type.startsWith("Died");
  const insuredAnimals = useMemo(() => selected.filter((a: any) => Number(a.insured_value ?? 0) > 0), [selected]);
  const totalInsured = useMemo(
    () => insuredAnimals.reduce((sum: number, a: any) => sum + Number(a.insured_value ?? 0), 0),
    [insuredAnimals],
  );
  const showInsurance = isDeath && totalInsured > 0;
  const claimNum = Number(insuranceClaim) || 0;
```

Reset `insuranceClaim` to `String(totalInsured)` whenever the show-insurance condition flips on. Use a useEffect:
```tsx
  useEffect(() => {
    if (showInsurance && !insuranceClaim) setInsuranceClaim(String(totalInsured));
    if (!showInsurance && insuranceClaim) setInsuranceClaim("");
  }, [showInsurance, totalInsured]); // eslint-disable-line react-hooks/exhaustive-deps
```

Add `useMemo`, `useEffect` to React import.

In the JSX, after the existing `<Field label="Witness ...">` block, add a conditional region:
```tsx
      {showInsurance ? (
        <>
          <Banner tone="info">
            {insuredAnimals.length} insured animal{insuredAnimals.length === 1 ? "" : "s"} ·
            Σ insured value KES {totalInsured.toLocaleString()}
          </Banner>
          <Field label="Insurance claim amount (KES)" help="Default: sum of insured values across animals. Edit if the claim is partial.">
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
```

In `handleSubmit`, when building the per-animal mutation payload, add:
```ts
          insuranceClaimAmount: showInsurance && claimNum > 0
            ? Math.round(claimNum / selected.length)
            : undefined,
```

After the for-loop (and before the success Alert), upload any post-mortem files to each succeeded disposal:
```ts
    // Best-effort: attach post-mortem files to each disposal doc we just created.
    // Disposal doc names aren't returned in `r.data` consistently — instead we
    // re-fetch by (animal, disposal_date) is overkill; for now attach to a
    // single newest disposal by querying the animal. Skip if no files.
    if (postMortemFiles.length > 0 && completed.length > 0) {
      // We use the animal's most recent disposal name as the parent.
      const { listDocuments } = await import("@/src/frappe/generic");
      for (const animal of selected) {
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
            console.warn("[culls] attach failed", dispName, e);
          }
        }
      }
    }
```

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit
git add src/frappe/animalDisposal.ts app/\(tabs\)/record/culls/new.tsx
git commit -m "feat(disposal): insured value, claim amount, post-mortem attachment"
```

---

## Task 7: Animal detail KV row

**Files:**
- Modify: `app/(tabs)/animals/[id].tsx`

- [ ] **Step 1: Read the existing file**

Open `app/(tabs)/animals/[id].tsx`. Locate where existing animal facts (DOB, herd, sex, etc.) are rendered.

- [ ] **Step 2: Add the insured-value display**

Read the animal detail object (uses `useAnimal(id)`). The Frappe `Animal` doctype exposes `insured_value`. The existing detail mapper in `src/frappe/animal.ts → mapAnimalDetail` does NOT currently include this. Update `AnimalDetail` type + `mapAnimalDetail` to add:

```ts
  insuredValue: number;
```
mapped from `row.insured_value ?? 0`.

Also add `insured_value` to the read-side fields. The animal detail read fetches the full doc (no explicit fields list, the response carries everything), so no fields change is needed. Just augment the mapper.

In the screen, add a tile next to the existing fact display (use whatever `Row`, `KV`, or text pattern is already there). If `insuredValue > 0`, show "Insured value · KES X". If 0, omit.

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit
git add app/\(tabs\)/animals/\[id\].tsx src/frappe/animal.ts
git commit -m "feat(animals): show insured value on detail page"
```

---

## Task 8: Closeout note

**Files:**
- Modify: `docs/superpowers/plans/2026-05-29-case-lifecycle-insurance.md`

- [ ] **Step 1: Mark plan implemented**

Add a `**Status:** Implemented 2026-05-29` line at the top of this file.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-05-29-case-lifecycle-insurance.md
git commit -m "docs(plan): mark case-lifecycle plan implemented"
```

---

## Self-review

- [x] Spec coverage: all 7 spec sections map to tasks (§5.1 → T1, §5.2 → T5, §5.3 → T3+T4, §5.4 → T6, §5.5 → T7, §6 → no schema work, §7 → T5/T6 validation blocks).
- [x] No placeholders.
- [x] Types named consistently (`UpdateAnimalHealthCaseInput`, `FileAsset`, `AnimalHealthCaseDetail`).
- [x] No tests (project policy).
