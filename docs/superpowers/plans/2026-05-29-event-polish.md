# Event polish — sub-project A — Implementation Plan

**Status:** Implemented 2026-05-29 (commits `013f750`, `9cdfe49`, `07b306d`, `8341fcb`, `0241e3a`, `c5268c0`). Frappe schema migration (§7 / Task 7 Step 1) and the manual verification matrix (Task 7 Step 2) are operator tasks — execute on the live site before relying on the new flow.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land four tightly-related changes on the vet-procedure event screens (Vaccination, Deworming, Dehorning, Hoof Trimming) and the PD screen: (1) one aggregated Stock Entry per batch submit, (2) "Vet" text field replacing the visible Operator picker, (3) Handlers multi-Employee picker on Dehorning, (4) PD picker filtered to animals with an open service.

**Architecture:** Per-animal `Animal Event` docs remain (no drug rows / no activity cost). After the loop succeeds, one `Material Issue` Stock Entry is submitted with the batch-total drug rows; one Vet Expense Journal Entry is submitted if activity cost > 0 and accounts are configured. Offline path: the events queue per-animal as today; a new `BatchDrugIssue` mutation type carries the batch payload (with an empty `eventNames` if the events haven't yet replayed) under a client-generated `batchId` that also lands in remarks for forensic linking.

**Tech Stack:** Expo / React Native, expo-router, React Query, Axios, Frappe REST API, AsyncStorage-backed offline queue.

**Spec:** `docs/superpowers/specs/2026-05-29-event-polish-design.md`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `components/HandlersPicker.tsx` | Create | Employee multi-select with chip list; reuses `EmployeePickerButton` for the picker step. |
| `src/frappe/breeding.ts` | Create | `getServicedPendingPdAnimalIds()` — computes the served-pending-PD set from event history. |
| `src/hooks/useServicedPendingPd.ts` | Create | React Query wrapper around the breeding helper. |
| `src/frappe/batchDrugIssue.ts` | Create | `submitBatchDrugIssue()` — one Stock Entry + optional JE. |
| `src/frappe/animalEvent.ts` | Modify | Drop `drugIssues` / `activityCost` from Vaccination/Deworming/Dehorning/Hoof Trimming event payloads. Add `vetName` (required) and `handlerIds` (Dehorning). Map to `custom_vet_name`, `custom_handlers`. |
| `src/offline/queue.ts` | Modify | Add `"BatchDrugIssue"` to `PendingMutationType`. |
| `src/offline/dispatcher.ts` | Modify | Wire `BatchDrugIssue` → `submitBatchDrugIssue`. |
| `src/hooks/mutations.ts` | Modify | New `useBatchDrugIssue` hook. |
| `app/(tabs)/record/events/[type].tsx` | Modify | Form: hide Operator on the four vet screens; add Vet field; add HandlersPicker on Dehorning. Submit flow: per-cow events without drug/cost, then one batch issue + JE. |
| `app/(tabs)/record/events/pd.tsx` | Modify | Apply the served-pending-PD `include` predicate on `AnimalPickerButton`. |

**Decision changes from spec:**
- The spec's §5.5 proposed a new `idAllowList?: Set<string>` prop on `AnimalPickerButton`. The existing `include?: (a: Animal) => boolean` prop is sufficient — we use `include={(a) => servedIds?.has(a.id) ?? false}` instead. No component API change needed.
- Handlers will use a new lightweight `HandlersPicker` wrapper rather than extending `EmployeePickerButton` with a `mode: "multi"` prop. Smaller blast radius and avoids touching every existing operator picker call site.

---

## Task 1: Build the `HandlersPicker` component

**Files:**
- Create: `components/HandlersPicker.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/HandlersPicker.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useEmployee } from "@/src/hooks/useEmployees";

import { EmployeePickerButton } from "./EmployeePickerButton";

/**
 * Multi-select picker built on top of EmployeePickerButton. Picks one
 * employee at a time and accumulates them as removable chips. Used by
 * Dehorning's "Handlers" field.
 */
export function HandlersPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  // Use a key to reset the inner picker between additions so each pick
  // starts from a blank slate.
  const [pickerKey, setPickerKey] = useState(0);

  const add = (id: string) => {
    if (!id || value.includes(id)) {
      setPickerKey((k) => k + 1);
      return;
    }
    onChange([...value, id]);
    setPickerKey((k) => k + 1);
  };

  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  return (
    <View>
      <EmployeePickerButton
        key={pickerKey}
        value={null}
        onChange={add}
        placeholder={value.length ? "Add another handler…" : "Pick handler…"}
      />
      {value.length > 0 ? (
        <View style={s.chips}>
          {value.map((id) => (
            <HandlerChip key={id} id={id} onRemove={() => remove(id)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function HandlerChip({ id, onRemove }: { id: string; onRemove: () => void }) {
  const { data } = useEmployee(id);
  return (
    <Pressable onPress={onRemove} style={s.chip}>
      <Text style={s.chipText} numberOfLines={1}>
        {data?.employeeName || id}
      </Text>
      <MaterialCommunityIcons name="close" size={13} color={COLORS.textMuted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.md,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.medium,
    maxWidth: 160,
  },
});
```

- [ ] **Step 2: Manual smoke check**

Compile the file with no other changes. Should TypeScript-check cleanly: no module resolves to a missing path, no unused imports.

Run: `npx tsc --noEmit`
Expected: no errors related to `HandlersPicker.tsx`. (Other pre-existing errors, if any, can be ignored — verify by checking the file path in any error message.)

- [ ] **Step 3: Commit**

```bash
git add components/HandlersPicker.tsx
git commit -m "feat(events): HandlersPicker multi-select component"
```

---

## Task 2: PD screen — only-serviced-pending filter

**Files:**
- Create: `src/frappe/breeding.ts`
- Create: `src/hooks/useServicedPendingPd.ts`
- Modify: `app/(tabs)/record/events/pd.tsx`

- [ ] **Step 1: Create the breeding helper**

```ts
// src/frappe/breeding.ts
import { listDocuments } from "./generic";

/**
 * Returns the set of Animal IDs whose latest Service event is more recent
 * than their latest Pregnancy Diagnosis or Calving event. These are the
 * animals that should appear in the PD picker — they've been served and
 * are awaiting diagnosis.
 *
 * Both queries are bounded to the last 365 days to keep the response set
 * predictable on busy farms. Animals serviced before that window are
 * almost certainly already diagnosed (or stale data) and shouldn't dominate
 * the picker.
 */
export async function getServicedPendingPdAnimalIds(): Promise<Set<string>> {
  const since = isoDateNDaysAgo(365);

  const [services, closings] = await Promise.all([
    listDocuments<{ animal: string; event_date: string }>({
      doctype: "Animal Event",
      fields: ["animal", "event_date"],
      filters: [
        ["docstatus", "=", 1],
        ["event_type", "=", "Service"],
        ["event_date", ">=", since],
      ],
      limit: 5000,
    }),
    listDocuments<{ animal: string; event_date: string; event_type: string }>({
      doctype: "Animal Event",
      fields: ["animal", "event_date", "event_type"],
      filters: [
        ["docstatus", "=", 1],
        ["event_type", "in", ["Pregnancy Diagnosis", "Calving"]],
        ["event_date", ">=", since],
      ],
      limit: 5000,
    }),
  ]);

  const latestService = new Map<string, string>();
  for (const s of services) {
    const prev = latestService.get(s.animal);
    if (!prev || s.event_date > prev) latestService.set(s.animal, s.event_date);
  }

  const latestClosing = new Map<string, string>();
  for (const c of closings) {
    const prev = latestClosing.get(c.animal);
    if (!prev || c.event_date > prev) latestClosing.set(c.animal, c.event_date);
  }

  const out = new Set<string>();
  for (const [animal, svc] of latestService) {
    const close = latestClosing.get(animal);
    if (!close || svc > close) out.add(animal);
  }
  return out;
}

function isoDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Create the React Query hook**

```ts
// src/hooks/useServicedPendingPd.ts
import { useQuery } from "@tanstack/react-query";

import { getServicedPendingPdAnimalIds } from "@/src/frappe/breeding";

/**
 * Drives the PD screen's animal picker filter. Cached for 5 minutes so
 * reopening the picker after a quick navigation doesn't re-hit Frappe.
 */
export function useServicedPendingPd() {
  return useQuery({
    queryKey: ["breeding", "serviced-pending-pd"],
    queryFn: getServicedPendingPdAnimalIds,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Wire the PD screen**

Modify `app/(tabs)/record/events/pd.tsx`. Replace the existing imports + Field block for cow selection.

Add to imports (after existing imports):

```tsx
import { useServicedPendingPd } from "@/src/hooks/useServicedPendingPd";
```

Inside the component, after `const mutation = useCreateAnimalEvent();`, add:

```tsx
  const { data: servedIds, isLoading: filterLoading } = useServicedPendingPd();
```

Replace the existing animal-picker `Field` block (currently:
```
<Field label="Cow(s)" help="Pick one or many — same result applied to each. One Animal Event per cow.">
  <AnimalPickerButton
    mode="multi"
    title="Select served cows"
    placeholder={selected.length ? `${selected.length} selected — tap to change` : "Search served cow..."}
    include={(a) => a.sex === "F"}
    value={selected}
    onPickMulti={setSelected}
  />
</Field>
```
) with:

```tsx
      <Field
        label="Cow(s)"
        help={
          filterLoading
            ? "Loading served animals…"
            : "Only animals with an open service. Pick one or many — same result applied to each."
        }
      >
        <AnimalPickerButton
          mode="multi"
          title="Select served cows"
          placeholder={
            filterLoading
              ? "Loading served animals…"
              : selected.length
                ? `${selected.length} selected — tap to change`
                : "Search served cow..."
          }
          include={(a) => a.sex === "F" && (servedIds ? servedIds.has(a.id) : false)}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>
```

- [ ] **Step 4: Type-check + manual smoke**

Run: `npx tsc --noEmit`
Expected: no new errors.

Smoke check: open PD screen in the app, confirm the picker says "Loading served animals…" briefly, then shows only animals whose latest event is a Service (no later PD/Calving). Pick one and submit; the existing submit flow should work unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/frappe/breeding.ts src/hooks/useServicedPendingPd.ts app/\(tabs\)/record/events/pd.tsx
git commit -m "feat(pd): filter picker to serviced-pending animals"
```

---

## Task 3: Refactor `animalEvent.ts` types and mapping

**Files:**
- Modify: `src/frappe/animalEvent.ts`

- [ ] **Step 1: Update the `EventSpecificInput` union**

Open `src/frappe/animalEvent.ts`. Find the union branch:

```ts
  | {
      eventType: "Vaccination" | "Deworming" | "Dehorning" | "Hoof Trimming";
      drugIssues?: AnimalDrugIssueInput[];
      activityCost?: number;
    }
```

Replace it with:

```ts
  | {
      eventType: "Vaccination" | "Deworming" | "Hoof Trimming";
      /** Free-text name of the vet who performed the procedure. */
      vetName: string;
    }
  | {
      eventType: "Dehorning";
      vetName: string;
      /** Employee IDs of farmhands holding the animal. */
      handlerIds?: string[];
    }
```

- [ ] **Step 2: Update `createAnimalEvent` switch**

In the same file, find the case block:

```ts
    case "Vaccination":
    case "Deworming":
    case "Dehorning":
    case "Hoof Trimming":
      if (input.drugIssues?.length) {
        base.custom_drug_issues = input.drugIssues.map(mapDrugIssue);
      }
      if (input.activityCost != null) {
        base.custom_activity_cost = input.activityCost;
      }
      break;
```

Replace it with:

```ts
    case "Vaccination":
    case "Deworming":
    case "Hoof Trimming":
      base.custom_vet_name = input.vetName;
      break;

    case "Dehorning":
      base.custom_vet_name = input.vetName;
      if (input.handlerIds?.length) {
        base.custom_handlers = input.handlerIds.join(", ");
      }
      break;
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: TypeScript will now complain in `app/(tabs)/record/events/[type].tsx` about `drugIssues` / `activityCost` no longer being valid on those event variants. **This is expected and will be fixed in Task 6.** Note the errors are confined to that one screen.

- [ ] **Step 4: Commit**

```bash
git add src/frappe/animalEvent.ts
git commit -m "refactor(events): drop per-event drug/cost from vet event types"
```

Note: this commit intentionally leaves `[type].tsx` broken (compile error) until Task 6 finishes the rewrite. The next four tasks build the new infrastructure; Task 6 rewires the screen to use it.

---

## Task 4: Create `batchDrugIssue.ts`

**Files:**
- Create: `src/frappe/batchDrugIssue.ts`

- [ ] **Step 1: Write the helper**

```ts
// src/frappe/batchDrugIssue.ts
import { frappeCreateAndSubmit, todayISO } from "@/src/services/api";

import { getDocument } from "./generic";

export type BatchDrugRow = {
  itemCode: string;
  qty: number;             // batch total quantity
  uom?: string;
  sourceWarehouse: string;
  withdrawalDays?: number;
};

export type BatchDrugIssueInput = {
  /** Drug rows with batch-total quantities. May be empty if the user only entered an activity cost. */
  drugRows: BatchDrugRow[];
  /** Batch-total vet fee. If > 0 and Vet Expense accounts are configured, posts one JE. */
  activityCost?: number;
  /** Server-assigned Animal Event names that this batch covers. May be empty when replaying offline. */
  eventNames: string[];
  /** Client-generated id grouping events + this batch issue. Lands in remarks for forensic linking. */
  batchId: string;
  /** Human-readable batch label, e.g. "Vaccination · 50 animals · 2026-05-29". */
  remarks: string;
  /** Frappe Company for the Stock Entry and JE. */
  company: string;
};

export type BatchDrugIssueResult = {
  stockEntry: { name: string } | null;
  journalEntry: { name: string } | null;
};

/**
 * Submits at most one Material Issue Stock Entry (when drugRows is non-empty)
 * and at most one Vet Expense Journal Entry (when activityCost > 0 AND the
 * Vet Expense accounts are configured in Livestock Settings).
 *
 * Failure semantics: if the Stock Entry submit fails, the error propagates
 * and the JE is not attempted. If the Stock Entry succeeds but the JE fails,
 * the function still resolves — the result reports the Stock Entry name and
 * a null journalEntry, plus a console warning. Callers decide how to surface
 * a partial state.
 */
export async function submitBatchDrugIssue(
  input: BatchDrugIssueInput,
): Promise<BatchDrugIssueResult> {
  const result: BatchDrugIssueResult = { stockEntry: null, journalEntry: null };

  const baseRemarks = buildRemarks(input);

  if (input.drugRows.length > 0) {
    const se = await frappeCreateAndSubmit<{ name: string }>("Stock Entry", {
      stock_entry_type: "Material Issue",
      company: input.company,
      posting_date: todayISO(),
      remarks: baseRemarks,
      items: input.drugRows.map((d) => ({
        item_code: d.itemCode,
        qty: d.qty,
        uom: d.uom,
        s_warehouse: d.sourceWarehouse,
      })),
    });
    result.stockEntry = { name: se.name };
  }

  if (input.activityCost && input.activityCost > 0) {
    try {
      const accounts = await readVetExpenseAccounts();
      if (accounts) {
        const je = await frappeCreateAndSubmit<{ name: string }>("Journal Entry", {
          voucher_type: "Journal Entry",
          company: input.company,
          posting_date: todayISO(),
          user_remark: baseRemarks,
          accounts: [
            {
              account: accounts.debit,
              debit_in_account_currency: input.activityCost,
              credit_in_account_currency: 0,
            },
            {
              account: accounts.credit,
              debit_in_account_currency: 0,
              credit_in_account_currency: input.activityCost,
            },
          ],
        });
        result.journalEntry = { name: je.name };
      } else {
        console.warn(
          "[batchDrugIssue] Vet Expense accounts not configured in Livestock Settings; JE skipped.",
        );
      }
    } catch (e) {
      console.warn("[batchDrugIssue] JE submit failed; Stock Entry already posted", e);
    }
  }

  return result;
}

function buildRemarks(input: BatchDrugIssueInput): string {
  const parts = [input.remarks, `Batch ${input.batchId}`];
  if (input.eventNames.length) {
    parts.push(`Events: ${input.eventNames.slice(0, 10).join(", ")}${input.eventNames.length > 10 ? "…" : ""}`);
  }
  return parts.join(" · ");
}

type VetExpenseAccounts = { debit: string; credit: string };

async function readVetExpenseAccounts(): Promise<VetExpenseAccounts | null> {
  const settings = await getDocument<{
    custom_vet_expense_account?: string;
    custom_vet_expense_credit_account?: string;
  }>("Livestock Settings", "Livestock Settings", [
    "custom_vet_expense_account",
    "custom_vet_expense_credit_account",
  ]);
  if (!settings?.custom_vet_expense_account || !settings?.custom_vet_expense_credit_account) {
    return null;
  }
  return {
    debit: settings.custom_vet_expense_account,
    credit: settings.custom_vet_expense_credit_account,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors in `batchDrugIssue.ts`. (`[type].tsx` still has the expected pre-existing errors from Task 3.)

- [ ] **Step 3: Commit**

```bash
git add src/frappe/batchDrugIssue.ts
git commit -m "feat(events): submitBatchDrugIssue helper for aggregated Material Issue + JE"
```

---

## Task 5: Wire `BatchDrugIssue` into the offline path

**Files:**
- Modify: `src/offline/queue.ts`
- Modify: `src/offline/dispatcher.ts`
- Modify: `src/hooks/mutations.ts`

- [ ] **Step 1: Add the mutation type**

Open `src/offline/queue.ts`. Find:

```ts
export type PendingMutationType =
  | "AnimalEvent"
  | "MilkRecording"
  | "AnimalDisposal"
  | "Animal"
  | "CalfFeeding"
  | "AnimalDiagnosis"
  | "AnimalHealthCase"
  | "FeedingWorkOrder";
```

Add `"BatchDrugIssue"` to the union:

```ts
export type PendingMutationType =
  | "AnimalEvent"
  | "MilkRecording"
  | "AnimalDisposal"
  | "Animal"
  | "CalfFeeding"
  | "AnimalDiagnosis"
  | "AnimalHealthCase"
  | "FeedingWorkOrder"
  | "BatchDrugIssue";
```

- [ ] **Step 2: Add the dispatcher handler**

Open `src/offline/dispatcher.ts`. After the existing imports, add:

```ts
import { submitBatchDrugIssue } from "@/src/frappe/batchDrugIssue";
```

Find the HANDLERS map:

```ts
const HANDLERS: Record<PendingMutationType, (payload: any) => Promise<any>> = {
  AnimalEvent: createAnimalEvent,
  MilkRecording: createMilkRecording,
  AnimalDisposal: createAnimalDisposal,
  Animal: createAnimal,
  CalfFeeding: createCalfFeeding,
  AnimalDiagnosis: createAnimalDiagnosis,
  AnimalHealthCase: createAnimalHealthCase,
  FeedingWorkOrder: createFeedingWorkOrder,
};
```

Add the new entry:

```ts
const HANDLERS: Record<PendingMutationType, (payload: any) => Promise<any>> = {
  AnimalEvent: createAnimalEvent,
  MilkRecording: createMilkRecording,
  AnimalDisposal: createAnimalDisposal,
  Animal: createAnimal,
  CalfFeeding: createCalfFeeding,
  AnimalDiagnosis: createAnimalDiagnosis,
  AnimalHealthCase: createAnimalHealthCase,
  FeedingWorkOrder: createFeedingWorkOrder,
  BatchDrugIssue: submitBatchDrugIssue,
};
```

- [ ] **Step 3: Add the mutation hook**

Open `src/hooks/mutations.ts`. Add to imports:

```ts
import {
  BatchDrugIssueInput,
  submitBatchDrugIssue,
} from "@/src/frappe/batchDrugIssue";
```

Add a label helper near the others:

```ts
const labelBatchDrug = (i: BatchDrugIssueInput): string =>
  `Batch drug issue · ${i.eventNames.length} animals`;
```

Add the hook export at the bottom of the file:

```ts
export const useBatchDrugIssue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BatchDrugIssueInput) =>
      tryDirectOrEnqueue("BatchDrugIssue", input, submitBatchDrugIssue, labelBatchDrug(input)),
    onSuccess: () => invalidateAll(qc),
  });
};
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors in the three modified files.

- [ ] **Step 5: Commit**

```bash
git add src/offline/queue.ts src/offline/dispatcher.ts src/hooks/mutations.ts
git commit -m "feat(events): offline-aware useBatchDrugIssue mutation"
```

---

## Task 6: Rewrite `events/[type].tsx` form + submit flow

**Files:**
- Modify: `app/(tabs)/record/events/[type].tsx`

This task does the entire screen rewrite. The result reuses the existing DrugRows component but threads the new submit flow.

- [ ] **Step 1: Replace the file contents**

Overwrite `app/(tabs)/record/events/[type].tsx` with:

```tsx
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { HandlersPicker } from "@/components/HandlersPicker";
import { KV } from "@/components/KV";
import { Screen } from "@/components/Screen";
import { COLORS, RADIUS } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import {
  AnimalEventInput,
  AnimalEventType,
} from "@/src/frappe/animalEvent";
import { BatchDrugRow } from "@/src/frappe/batchDrugIssue";
import { useBatchDrugIssue, useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useDefaultCompany } from "@/src/hooks/useDefaultCompany";
import { useLivestockSettings } from "@/src/hooks/useLivestockSettings";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

type Spec = {
  title: string;
  eventType: AnimalEventType;
  needsWeight?: boolean;
  needsDrugs?: boolean;
  needsActivityCost?: boolean;
  needsMethod?: boolean;
  needsFeet?: boolean;
  needsHeatSigns?: boolean;
  /** Vet-procedure screens hide the Operator picker, show a Vet text field instead. */
  isVetProcedure?: boolean;
  /** Dehorning also collects Handlers. */
  needsHandlers?: boolean;
};

const SPECS: Record<string, Spec> = {
  weight:      { title: "Weight recording",  eventType: "Weight Recording",  needsWeight: true },
  vaccination: { title: "Vaccination",       eventType: "Vaccination",       needsDrugs: true, needsActivityCost: true, isVetProcedure: true },
  deworming:   { title: "Deworming",         eventType: "Deworming",         needsDrugs: true, needsActivityCost: true, isVetProcedure: true },
  dehorning:   { title: "Dehorning",         eventType: "Dehorning",         needsMethod: true, needsActivityCost: true, isVetProcedure: true, needsHandlers: true },
  hoof:        { title: "Hoof trimming",     eventType: "Hoof Trimming",     needsFeet: true, needsActivityCost: true, isVetProcedure: true },
  heat:        { title: "Heat detection",    eventType: "Heat Detection",    needsHeatSigns: true },
};

export default function GenericEvent() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const spec = SPECS[type || ""];

  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [vetName, setVetName] = useState("");
  const [handlerIds, setHandlerIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Animal[]>([]);
  const [weight, setWeight] = useState("");
  const [bcs, setBcs] = useState("");
  const [activityCost, setActivityCost] = useState("");
  const [method, setMethod] = useState("Hot iron");
  const [feet, setFeet] = useState("All four");
  const [heatSigns, setHeatSigns] = useState("");
  const [drugs, setDrugs] = useState<DrugRow[]>([]);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: settings } = useLivestockSettings();
  const { data: company } = useDefaultCompany();
  const defaultDrugWarehouse = settings?.custom_drug_warehouse || "";

  const eventMutation = useCreateAnimalEvent();
  const batchMutation = useBatchDrugIssue();

  const submitting = eventMutation.isPending || batchMutation.isPending;

  if (!spec) {
    return (
      <Screen title="Unknown event" back>
        <Banner tone="warning">No form configured for &quot;{type}&quot;.</Banner>
      </Screen>
    );
  }

  const filledDrugRows = useMemo(
    () => drugs.filter((d) => d.itemCode.trim() && Number(d.qty) > 0),
    [drugs],
  );

  const handleSubmit = async () => {
    setError(null);

    // ----- validation --------------------------------------------------------
    if (selected.length === 0) return setError("Pick at least one animal.");

    if (spec.isVetProcedure) {
      if (!vetName.trim()) return setError("Enter the vet's name.");
      if (!operator) return setError("Operator missing — sign out and back in.");
      if (!company) return setError("Default company not loaded yet. Try again in a moment.");
    } else {
      if (!operator) return setError("Pick the operator before submitting.");
    }

    if (spec.needsWeight) {
      if (!weight) return setError("Enter the weight (kg).");
      if (selected.length > 1) {
        return setError("Weight recording takes one animal at a time. Unselect the others.");
      }
    }

    if (spec.needsDrugs && filledDrugRows.length > 0) {
      const missing = filledDrugRows.find((d) => !d.sourceWarehouse);
      if (missing) {
        return setError(
          "Pick a source warehouse on every drug row (or set Drug warehouse in Livestock Settings to apply a default).",
        );
      }
    }

    if (operator && operator !== defaultOperator) await setStoredOperator(operator);

    // ----- compose per-cow events -------------------------------------------
    const remarksBits: string[] = [];
    if (spec.needsMethod) remarksBits.push(`Method: ${method}`);
    if (spec.needsFeet) remarksBits.push(`Feet: ${feet}`);
    if (spec.needsHeatSigns && heatSigns) remarksBits.push(`Heat signs: ${heatSigns}`);
    if (remarks) remarksBits.push(remarks);
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const baseRemarks = [remarksBits.join(" · ") || null, `Batch ${batchId}`]
      .filter(Boolean)
      .join(" · ");

    const eventNames: string[] = [];
    let succeededEvents = 0;
    let queuedEvents = 0;

    for (const a of selected) {
      const common = {
        animal: a.id,
        currentHerd: a.herd,
        operator: operator!, // checked above
        eventDate: todayISO(),
        remarks: baseRemarks,
      } as const;

      const payload: AnimalEventInput = (() => {
        switch (spec.eventType) {
          case "Weight Recording":
            return {
              ...common,
              eventType: "Weight Recording",
              weightKg: Number(weight),
              bcs: bcs ? Number(bcs) : undefined,
            };
          case "Vaccination":
          case "Deworming":
          case "Hoof Trimming":
            return {
              ...common,
              eventType: spec.eventType,
              vetName: vetName.trim(),
            };
          case "Dehorning":
            return {
              ...common,
              eventType: "Dehorning",
              vetName: vetName.trim(),
              handlerIds: handlerIds.length ? handlerIds : undefined,
            };
          case "Heat Detection":
            return { ...common, eventType: "Heat Detection" };
          default:
            throw new Error(`Unhandled event type ${spec.eventType}`);
        }
      })();

      try {
        const r = await eventMutation.mutateAsync(payload);
        if (r.queued) queuedEvents += 1;
        else {
          succeededEvents += 1;
          if (r.data?.name) eventNames.push(r.data.name);
        }
      } catch (err) {
        setError(
          `${succeededEvents + queuedEvents} of ${selected.length} submitted. Stopped at ${a.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }

    // ----- batch drug issue (vet procedures only) ----------------------------
    let batchOutcome: "ok" | "skipped" | "failed" = "skipped";
    let batchError = "";

    const hasBatchWork =
      spec.isVetProcedure &&
      (filledDrugRows.length > 0 || (activityCost && Number(activityCost) > 0));

    if (hasBatchWork && company) {
      const batchPayload = {
        drugRows: filledDrugRows.map<BatchDrugRow>((d) => ({
          itemCode: d.itemCode.trim(),
          qty: Number(d.qty),
          uom: d.uom || undefined,
          sourceWarehouse: d.sourceWarehouse || defaultDrugWarehouse,
          withdrawalDays: d.withdrawalDays ? Number(d.withdrawalDays) : undefined,
        })),
        activityCost: activityCost ? Number(activityCost) : undefined,
        eventNames,
        batchId,
        remarks: `${spec.title} · ${selected.length} animals · ${todayISO()}`,
        company,
      };

      try {
        const r = await batchMutation.mutateAsync(batchPayload);
        if (r.queued) batchOutcome = "ok"; // queued counts as ok from the operator's view
        else batchOutcome = "ok";
      } catch (err) {
        batchOutcome = "failed";
        batchError = extractFrappeError(err);
      }
    }

    // ----- success / partial messaging --------------------------------------
    const eventParts: string[] = [];
    if (succeededEvents) eventParts.push(`${succeededEvents} submitted`);
    if (queuedEvents) eventParts.push(`${queuedEvents} queued (offline)`);

    if (batchOutcome === "failed") {
      Alert.alert(
        `${spec.title} — partial`,
        `${eventParts.join(" · ") || "Events recorded"}, but the drug issue failed: ${batchError}\n\nEvents: ${eventNames.join(", ") || "(none — were they queued?)"}\nTop up the source warehouse and create the Material Issue from desktop.`,
      );
    } else {
      const extra = batchOutcome === "ok" ? "\nBatch drug issue submitted." : "";
      Alert.alert(`${spec.title} recorded`, `${eventParts.join(" · ")}${extra}`);
    }
    router.replace(`/(tabs)/record/success?name=${encodeURIComponent(spec.title)}`);
  };

  return (
    <Screen title={spec.title} subtitle="New event" back>
      {/* Operator picker: hidden for vet procedures (auto-set from auth). */}
      {!spec.isVetProcedure ? (
        <Field label="Operator">
          <EmployeePickerButton value={operator} onChange={setOperator} />
        </Field>
      ) : null}

      {spec.isVetProcedure ? (
        <Field label="Vet" help="Free-text — the vet who performed the procedure.">
          <Input value={vetName} onChangeText={setVetName} placeholder="Dr. Mwangi" />
        </Field>
      ) : null}

      <Field
        label={spec.needsWeight ? "Animal" : "Animal(s)"}
        help={
          spec.needsWeight
            ? "Pick one animal — weight is per-animal."
            : spec.isVetProcedure
              ? "Pick one cow, several, or a whole herd. Drug quantities below are the total for the batch."
              : "Pick one cow, several, or a whole herd. Same details applied per animal."
        }
      >
        <AnimalPickerButton
          mode="multi"
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Search by tag or name…"}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>

      <Field label="Date"><Input value={todayISO()} editable={false} /></Field>

      {spec.needsWeight ? (
        <FieldRow>
          <Field label="Weight (kg)" style={{ flex: 1 }}>
            <Input value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="480" />
          </Field>
          <Field label="BCS (1-5)" style={{ flex: 1 }}>
            <Input value={bcs} onChangeText={setBcs} keyboardType="numeric" placeholder="3.5" />
          </Field>
        </FieldRow>
      ) : null}

      {spec.needsMethod ? (
        <Field label="Method">
          <Chips>
            {["Hot iron", "Caustic paste", "Surgical"].map((m) => (
              <Chip key={m} label={m} active={method === m} onPress={() => setMethod(m)} />
            ))}
          </Chips>
        </Field>
      ) : null}

      {spec.needsHandlers ? (
        <Field label="Handlers" help="Farmhands assisting the vet.">
          <HandlersPicker value={handlerIds} onChange={setHandlerIds} />
        </Field>
      ) : null}

      {spec.needsFeet ? (
        <Field label="Feet">
          <Chips>
            {["Front-L", "Front-R", "Hind-L", "Hind-R", "All four"].map((f) => (
              <Chip key={f} label={f} active={feet === f} onPress={() => setFeet(f)} />
            ))}
          </Chips>
        </Field>
      ) : null}

      {spec.needsHeatSigns ? (
        <Field label="Heat signs">
          <Textarea
            value={heatSigns}
            onChangeText={setHeatSigns}
            placeholder="Mounting, mucus, restless, vulva swelling..."
          />
        </Field>
      ) : null}

      {spec.needsDrugs ? (
        <DrugRows
          rows={drugs}
          onChange={setDrugs}
          defaultWarehouse={defaultDrugWarehouse}
        />
      ) : null}

      {spec.needsActivityCost ? (
        <Field label="Activity cost (KES)" help="Total vet fee for the batch.">
          <Input
            value={activityCost}
            onChangeText={setActivityCost}
            keyboardType="numeric"
            placeholder="0"
          />
        </Field>
      ) : null}

      {spec.isVetProcedure && (filledDrugRows.length > 0 || (activityCost && Number(activityCost) > 0)) ? (
        <View style={s.summary}>
          <KV
            k="Stock Entry"
            v={filledDrugRows.length > 0 ? `1 Material Issue for ${selected.length || "—"} animals` : "—"}
          />
          <KV
            k="Vet Expense JE"
            v={activityCost && Number(activityCost) > 0 ? `1 entry · KES ${Number(activityCost).toLocaleString()}` : "—"}
          />
        </View>
      ) : null}

      <Field label="Remarks">
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Optional notes" />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={submitting ? "Submitting…" : `Submit ${spec.title.toLowerCase()}`}
        disabled={submitting || selected.length === 0}
        loading={submitting}
        onPress={handleSubmit}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

type DrugRow = {
  id: number;
  itemCode: string;
  qty: string;
  uom: string;
  sourceWarehouse: string;
  withdrawalDays: string;
};

function DrugRows({
  rows,
  onChange,
  defaultWarehouse,
}: {
  rows: DrugRow[];
  onChange: (rows: DrugRow[]) => void;
  defaultWarehouse: string;
}) {
  const add = () =>
    onChange([
      ...rows,
      {
        id: Date.now() + rows.length,
        itemCode: "",
        qty: "1",
        uom: "",
        sourceWarehouse: defaultWarehouse,
        withdrawalDays: "",
      },
    ]);
  const update = (id: number, patch: Partial<DrugRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: number) => onChange(rows.filter((r) => r.id !== id));

  return (
    <Field
      label="Drugs / vaccines (optional)"
      help={
        defaultWarehouse
          ? `Quantities are the total for the whole batch. One Stock Entry is created from these rows. Source warehouse defaults to ${defaultWarehouse}.`
          : "Quantities are the total for the whole batch. Pick a source warehouse for each row — set a default via Livestock Settings → Drug warehouse."
      }
    >
      {rows.length === 0 ? (
        <Text style={s.drugEmpty}>No drug rows. Tap “Add drug” if any drug was used.</Text>
      ) : null}
      {rows.map((r) => (
        <View key={r.id} style={s.drugBox}>
          <Field label="Item">
            <FrappeSearchPicker
              doctype="Item"
              value={r.itemCode || null}
              onChange={(name, row) =>
                update(r.id, { itemCode: name, uom: r.uom || row?.stock_uom || "" })
              }
              fields={["name", "item_name", "item_code", "stock_uom"]}
              displayField="item_name"
              metaField="item_code"
              searchField="item_name"
              filters={[["disabled", "=", 0], ["is_stock_item", "=", 1]]}
              icon="pill"
            />
          </Field>
          <Field label="Issue from warehouse">
            <FrappeSearchPicker
              doctype="Warehouse"
              value={r.sourceWarehouse || null}
              onChange={(name) => update(r.id, { sourceWarehouse: name })}
              fields={["name", "warehouse_name"]}
              displayField="warehouse_name"
              searchField="warehouse_name"
              filters={[["disabled", "=", 0]]}
              icon="warehouse"
            />
          </Field>
          <FieldRow>
            <Field label="Qty (batch total)" style={{ flex: 1 }}>
              <Input
                value={r.qty}
                onChangeText={(t) => update(r.id, { qty: t })}
                keyboardType="numeric"
                placeholder="1"
              />
            </Field>
            <Field label="UOM" style={{ flex: 1 }}>
              <Input value={r.uom} onChangeText={(t) => update(r.id, { uom: t })} placeholder="ml" />
            </Field>
          </FieldRow>
          <Field label="Withdrawal days">
            <Input
              value={r.withdrawalDays}
              onChangeText={(t) => update(r.id, { withdrawalDays: t })}
              keyboardType="numeric"
              placeholder="0"
            />
          </Field>
          <Button label="Remove row" variant="link" onPress={() => remove(r.id)} />
        </View>
      ))}
      <Button label="Add drug" icon="plus" variant="outline" onPress={add} />
    </Field>
  );
}

const s = StyleSheet.create({
  drugBox: {
    backgroundColor: COLORS.bgMuted,
    padding: 11,
    borderRadius: RADIUS.md,
    marginBottom: 7,
  },
  drugEmpty: {
    color: COLORS.textSubtle,
    fontSize: 12,
    paddingVertical: 4,
  },
  summary: {
    backgroundColor: COLORS.bgMuted,
    padding: 11,
    borderRadius: RADIUS.md,
    marginBottom: 10,
    gap: 4,
  },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project related to event screens.

- [ ] **Step 3: Manual smoke check**

Boot the app (`npm start` or `npx expo start`) on a simulator or device. Open Vaccination → confirm the Vet text field is present, Operator is hidden, drug-row helper text mentions "batch total". Submit a small batch (1-2 animals, 1 drug row, small activity cost) and confirm in Frappe desk:
- 1-2 Animal Event docs with `custom_vet_name` set, no `custom_drug_issues`, no `custom_activity_cost`.
- 1 Stock Entry of type Material Issue with the batch qty.
- 1 Journal Entry against Vet Expense (if accounts are configured).
- Stock Entry remarks contain the batch id.

Repeat the same flow on Dehorning, confirming Handlers chips render and `custom_handlers` stores a comma-joined Employee ID list.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/record/events/\[type\].tsx
git commit -m "feat(events): vet field, handlers, aggregated drug Stock Entry + JE"
```

---

## Task 7: Frappe schema migration + manual verification matrix

**Files:**
- Modify: `docs/superpowers/plans/2026-05-29-event-polish.md` (this file — add a "Done" note)

- [ ] **Step 1: Run the four schema additions on the live Frappe site**

On the production Frappe instance (`upande-kaitet2.c.frappe.cloud` per existing specs), use Customize Form on the Animal Event doctype to add:

| Fieldname | Label | Fieldtype | Notes |
|---|---|---|---|
| `custom_vet_name` | Vet | Data | Insert after `operator`. |
| `custom_handlers` | Handlers | Small Text | Insert after `custom_vet_name`. |

On the Livestock Settings single, add:

| Fieldname | Label | Fieldtype | Options |
|---|---|---|---|
| `custom_vet_expense_account` | Vet Expense Account (Debit) | Link | Account |
| `custom_vet_expense_credit_account` | Vet Expense Counter Account (Credit) | Link | Account |

Then fill in the two account links on Livestock Settings (typically `Veterinary Expenses - <COMPANY>` for the debit and the petty-cash or default-payable account for the credit). If either is left blank, the JE step in `submitBatchDrugIssue` will silently no-op.

- [ ] **Step 2: Run the verification matrix from spec §10**

Walk through each test below in the app and tick them off:

1. **Aggregated drug Stock Entry (online):** Vaccination, 3 animals from one herd, 1 drug row 30 ml, activity cost KES 600 → 3 Animal Events with `custom_vet_name` + empty drug rows, 1 Stock Entry of 30 ml, 1 JE of KES 600.
2. **Drug-only / no cost:** Deworming, 5 animals, 1 drug row, activity cost blank → 5 events, 1 Stock Entry, no JE.
3. **Cost-only / no drug:** Hoof Trimming, 4 animals, activity cost KES 1,200, no drug rows → 4 events, no Stock Entry, 1 JE.
4. **Failure: disabled drug item.** Repeat test 1 with a disabled drug → events submit, batch issue fails, alert shows the recovery instruction.
5. **Offline:** Airplane mode, repeat test 1, reconnect → both events and batch issue replay in order; resulting docs match the online case.
6. **Vet & Handlers fields:** Dehorning, leave Vet blank → submit blocked. Fill Vet, pick 2 handlers → `custom_handlers` = `"HR-EMP-00012, HR-EMP-00037"`.
7. **PD filter:** seed three animals (A serviced 30d ago no PD; B serviced 60d ago PD'd 50d ago; C never serviced) → only A appears in the PD picker.
8. **PD filter regression for re-services:** animal D calved 90d ago, re-serviced 10d ago → D appears.

- [ ] **Step 3: Commit a closeout note**

Append the date to the top of this plan, then commit:

```bash
git add docs/superpowers/plans/2026-05-29-event-polish.md
git commit -m "docs(plan): mark event-polish plan complete"
```

---

## Self-review (skill checklist run after writing this plan)

- [x] **Spec coverage:** every spec section maps to a task. §5.1 → Task 6. §5.2 → Task 4. §5.3 → Task 5. §5.4 → Task 2. §5.5 noted as superseded (uses existing `include` predicate). §6 → Task 7. §7 → Task 6 + Task 2. §8 → Task 6 (validation block in `handleSubmit`). §9 → Task 6 (partial-state alert). §10 → Task 7.
- [x] **Placeholders:** none — every step has full code or exact instruction.
- [x] **Type consistency:** `BatchDrugIssueInput`, `BatchDrugRow`, `vetName`, `handlerIds` named identically across Tasks 3-6. `useBatchDrugIssue` identical between Task 5 and Task 6 callsite.
- [x] **No automated tests:** consistent with project policy (§10 of the spec) — manual verification matrix in Task 7 is the test plan.
