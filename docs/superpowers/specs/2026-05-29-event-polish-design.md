# Event polish — sub-project A

**Date:** 2026-05-29
**Author:** james@upande.com (with Claude)
**Status:** Design — pending user review

---

## 1. Background

After the multi-animal-picker work landed (`9ae1c0a`), the vet-procedure event screens (Vaccination, Deworming, Dehorning, Hoof Trimming) submit one `Animal Event` per selected animal in a loop. Each event carries its own `custom_drug_issues` child rows and its own `custom_activity_cost`. Frappe server scripts fire on submit and turn each event's drug rows into a separate Stock Entry and each activity cost into a separate Journal Entry.

The result of vaccinating 50 cows with 200 ml of Vaccine Y today: 50 Animal Events, 50 Stock Entries of 200 ml each (= 10 L issued — wrong), 50 vet-expense JEs. Reporting and stock accuracy both break.

This spec covers the smallest coherent set of fixes around these screens, plus two unrelated form-polish items that share the same file and code path: a "Vet" field replacing "Operator", and a Handlers picker on Dehorning, and a "served-and-pending-PD" filter on the PD screen.

Sub-projects B (case lifecycle + insurance), C (gift animals), and D (lifecycle automation + breeding-cycle reminders) are **out of scope** for this document.

## 2. Goals

- One `Material Issue` Stock Entry per batch submit on Vaccination / Deworming / Dehorning / Hoof Trimming, totalled across all selected animals.
- One Journal Entry for the activity cost per batch (not per cow), against the Vet Expense account from Livestock Settings.
- Per-animal Animal Event docs preserved (per-cow audit of "vaccinated on date X"), with empty `custom_drug_issues` and no `custom_activity_cost` on the per-cow records.
- "Vet" free-text field replaces the visible "Operator" picker on the four vet-procedure screens; underlying `operator` field still set silently from auth for audit.
- Dehorning gains a multi-select "Handlers" Employee picker.
- PD screen's animal picker shows only animals with a Service event and no later PD or Calving.

## 3. Non-goals

- No service / PD / calving date popups or reminders (sub-project D).
- No auto herd-moves on calving or auto age-bucket transitions (sub-project D).
- No insurance, post-mortem, gift, or case-outcome work (sub-projects B and C).
- No new automated tests; manual verification only (consistent with prior specs).
- No changes to other event screens (Milk, Calving, Service, Drying Off, Heat Detection, Movement, Weight Recording).
- No retroactive cleanup of historical events / stock entries that were created in the per-cow shape.

## 4. Fixed decisions (locked during brainstorming)

| Decision | Choice | Reason |
|---|---|---|
| Drug qty meaning | Total for the batch | User enters one number; one Stock Entry of exactly that qty. |
| Activity cost meaning | Total for the batch | One JE for the whole submit. |
| Aggregation approach | Standalone Stock Entry from the app (not first-event-carries-all) | Keeps per-event audit clean; one new `frappeCreateAndSubmit("Stock Entry", …)` call. |
| Vet field type | Free-text Data field on Animal Event (`custom_vet_name`) | Captures external vet names that aren't Frappe Employees. |
| Operator visibility | Hidden, auto-set from auth | Operator field is required by the schema; we keep audit, just don't surface it on these screens. |
| Vet rename scope | All four vet-procedure screens | Vaccination, Deworming, Dehorning, Hoof Trimming. |
| Handlers field | Multi-select `EmployeePickerButton mode="multi"`, Dehorning only | Real Frappe links for accountable handlers. |
| Handlers storage | `custom_handlers` Small Text, comma-joined Employee names | Simple, queryable, no child table needed. |
| PD filter semantics | Computed from event history (Service with no later PD / Calving) | More robust than `repro_status` drift. 365-day lookback window. |

## 5. Architecture & file layout

```
src/
  frappe/
    animalEvent.ts          modified — drop drug/cost from vet event payloads
    batchDrugIssue.ts       new — submitBatchDrugIssue() helper
    breeding.ts             new — getServicedPendingPdAnimalIds()
  hooks/
    mutations.ts            modified — new useBatchDrugIssue mutation
    useServicedPendingPd.ts new — React Query wrapper around the breeding helper
  offline/
    dispatcher.ts           modified — new BatchDrugIssue handler
    queue.ts                modified — new mutation type
  components/
    EmployeePickerButton.tsx modified — add `mode: "multi"` prop
app/(tabs)/record/events/
  [type].tsx                modified — submit flow split (events first, then batch issue)
  pd.tsx                    modified — picker uses serviced-pending filter
```

### 5.1 Submit flow on the four vet screens

```
on Submit:
  1. validate (vet name, animals, drug rows, handlers if Dehorning)
  2. for each animal in selected:
       submit Animal Event   ──────►  custom_vet_name, custom_handlers (Dehorning), no drug rows, no cost
       collect event name
  3. if any drug rows AND/OR activityCost > 0:
       submitBatchDrugIssue({
         drugRows,          // total qty per drug
         activityCost,
         eventNames,        // for traceability
         remarks: "<Vaccination> · <N> animals · <ISO date>",
         company,
       })
  4. surface partial-state errors clearly:
     • events ok + Stock Entry failed  → alert with event names, top-up hint
     • some events failed              → existing "X of Y submitted" alert
```

### 5.2 `submitBatchDrugIssue` shape

Input:
```ts
type BatchDrugIssueInput = {
  drugRows: {
    itemCode: string;
    qty: number;            // batch total
    uom?: string;
    sourceWarehouse: string;
    withdrawalDays?: number;
  }[];
  activityCost?: number;    // batch total; if > 0 we post a JE
  eventNames: string[];     // for Stock Entry remarks + JE remarks
  remarks: string;          // human-readable batch label
  company: string;
};
```

Steps:
1. `frappeCreateAndSubmit("Stock Entry", { stock_entry_type: "Material Issue", company, remarks, items: [...] })`
   — one item row per drug row.
2. If `activityCost && activityCost > 0`: `frappeCreateAndSubmit("Journal Entry", ...)` posting Vet Expense (Dr) vs. cash/payable (Cr). Account names read from Livestock Settings (`custom_vet_expense_account`, `custom_vet_expense_credit_account`). If either setting is missing, **skip the JE silently and log a warning** — drug issue still goes through.
3. Return both submitted doc names for the success Alert.

### 5.3 Offline path

A new `BatchDrugIssue` mutation type added to `src/offline/queue.ts` and a matching handler in `src/offline/dispatcher.ts` that calls `submitBatchDrugIssue` on replay.

Naming gap: when offline, the per-animal Animal Events don't have server-assigned names yet, so `eventNames` can't be pre-populated at queue time. To handle this, the queue groups the N per-animal events plus the one batch issue under a single client-generated `batchId` (UUID, set when the user taps Submit). The dispatcher processes a batch together: it submits the events first, captures their returned names, then submits the batch issue with `eventNames` filled in just-in-time. If any event in the group fails, the batch issue stays queued (the existing dispatcher's per-item retry handles that). The `batchId` is also written into each Animal Event's `remarks` and into the Stock Entry's `remarks` as a forensic fallback if the link is ever needed during reconciliation.

### 5.4 PD filter computation

In `src/frappe/breeding.ts`:

```ts
export async function getServicedPendingPdAnimalIds(): Promise<Set<string>> {
  const since = isoDateNDaysAgo(365);

  const [services, closings] = await Promise.all([
    listDocuments({
      doctype: "Animal Event",
      fields: ["animal", "event_date"],
      filters: [
        ["docstatus", "=", 1],
        ["event_type", "=", "Service"],
        ["event_date", ">=", since],
      ],
      limit: 5000,
    }),
    listDocuments({
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

  // Latest service date per animal
  const latestService = new Map<string, string>();
  for (const s of services) {
    const prev = latestService.get(s.animal);
    if (!prev || s.event_date > prev) latestService.set(s.animal, s.event_date);
  }

  // Latest closing event per animal
  const latestClosing = new Map<string, string>();
  for (const c of closings) {
    const prev = latestClosing.get(c.animal);
    if (!prev || c.event_date > prev) latestClosing.set(c.animal, c.event_date);
  }

  // Serviced animals whose latest service is after their latest closing
  const out = new Set<string>();
  for (const [animal, svc] of latestService) {
    const close = latestClosing.get(animal);
    if (!close || svc > close) out.add(animal);
  }
  return out;
}
```

The hook `useServicedPendingPd()` wraps this in React Query keyed on today's date with `staleTime: 5 minutes`. PD screen disables the picker until the set resolves and shows a tiny "Loading served animals…" hint.

### 5.5 `AnimalPickerButton` filter prop

A new optional prop `idAllowList?: Set<string>` on `AnimalPickerButton`. When set:
- Search results restrict to animals whose `id` is in the set.
- The flat list rendering filters to the same set.

No other call site needs to change; the prop is additive.

## 6. Frappe schema changes (one-time on live site)

| DocType | Field | Type | Notes |
|---|---|---|---|
| Animal Event | `custom_vet_name` | Data | Label "Vet". Used by Vaccination, Deworming, Dehorning, Hoof Trimming. |
| Animal Event | `custom_handlers` | Small Text | Comma-joined Employee names. Used by Dehorning only. |
| Livestock Settings | `custom_vet_expense_account` | Link → Account | Dr side of the activity-cost JE. Optional. |
| Livestock Settings | `custom_vet_expense_credit_account` | Link → Account | Cr side of the activity-cost JE. Optional. |

All four fields are nullable / optional. Adding them is additive and safe to deploy ahead of the app.

## 7. UI changes (form-level)

| Screen | Change |
|---|---|
| Vaccination, Deworming, Dehorning, Hoof Trimming | Hide existing "Operator" picker. Show new **Vet** Data field (required). Update drug-row help text: "Quantities are the total for the whole batch." Update activity cost help: "Total vet fee for the batch." Show a read-only KV tile *"Stock Entry: 1 Material Issue for N animals"* when drugs are present. |
| Dehorning only | Add **Handlers** field below Vet — uses `EmployeePickerButton mode="multi"`. Optional. |
| PD | Picker uses `AnimalPickerButton` with `idAllowList` set to the result of `useServicedPendingPd()`. Picker disabled while the set is loading. Header subtitle updated to "*Only animals with an open service*". |

Operator field on Service, Calving, Drying Off, Heat Detection, Weight Recording, Movement, Animal Feeding, Milk Recording, and Health Cases is **unchanged**.

## 8. Validation rules

| Rule | Where | Message |
|---|---|---|
| At least one animal selected | All four vet screens | "Pick at least one animal." (unchanged) |
| Vet name not blank | Vaccination, Deworming, Dehorning, Hoof Trimming | "Enter the vet's name." |
| Each drug row has source warehouse | All four vet screens with drugs | unchanged (existing rule). |
| Each drug row has qty > 0 | All four vet screens with drugs | unchanged. |
| Stock Entry submit failed mid-flow | All four vet screens | "N events recorded, but the drug issue failed. Top up the source warehouse and issue from desktop, referencing events: ..." |
| Vet Expense accounts unset | submitBatchDrugIssue | Silent skip + console warning. Submit succeeds; the operator can post the JE manually. |
| PD screen: pick from served-only list | PD | Picker shows only filtered animals; no separate "you picked an unserved animal" message because the unserved are not selectable. |

## 9. Error handling & partial-state recovery

Three failure modes worth handling:

1. **Per-cow Animal Event submit fails partway through the loop.** Existing behavior: stop at the first failure, show "K of N submitted. Stopped at <animal>: <error>". *Unchanged.* In this case we **do not** post the batch issue, because per-cow audit is incomplete.

2. **All events succeed, batch Stock Entry fails.** The drug was *not* issued from stock, but the per-cow records exist. Alert shows: *"N events recorded, but the Material Issue failed. Top up the source warehouse and create the issue from desktop, referencing events: <names>."* The screen routes to success anyway (per-cow events are valid records).

3. **Stock Entry succeeds, JE fails.** Drug issued; vet expense not booked. Alert shows: *"N events + drug issue recorded, but the Vet Expense JE failed: <error>. Post it manually from desktop."* Again, screen routes to success.

Offline path piggybacks on the existing queue/dispatcher resilience — failures during replay get the same alerts on next sync.

## 10. Testing & rollout

No automated tests. Manual verification matrix:

1. **Aggregated drug Stock Entry (online):** Vaccination, 3 animals from one herd, 1 drug row 30 ml, activity cost KES 600 → 3 Animal Events with `custom_vet_name` + empty drug rows, 1 Stock Entry of 30 ml, 1 JE of KES 600.
2. **Drug-only / no cost:** Deworming, 5 animals, 1 drug row, activity cost blank → 5 events, 1 Stock Entry, no JE.
3. **Cost-only / no drug:** Hoof Trimming, 4 animals, activity cost KES 1,200, no drug rows → 4 events, no Stock Entry, 1 JE.
4. **Failure: disabled drug item.** Repeat test 1 with a disabled drug → events submit, batch issue fails, alert shows the recovery instruction.
5. **Offline:** Airplane mode, repeat test 1, reconnect → both events and batch issue replay in order; resulting docs match the online case.
6. **Vet & Handlers fields:** Dehorning, leave Vet blank → submit blocked. Fill Vet, pick 2 handlers → `custom_handlers` = `"HR-EMP-00012, HR-EMP-00037"`.
7. **PD filter:** seed three animals (A serviced 30d ago no PD; B serviced 60d ago PD'd 50d ago; C never serviced) → only A appears in the PD picker.
8. **PD filter regression for re-services:** animal D calved 90d ago, re-serviced 10d ago → D appears (latest service after latest closing).

**Rollout:**

1. Customize Form on the live Frappe site to add the four new fields (§6). Verify they're visible in the Animal Event desk view.
2. Configure Vet Expense accounts in Livestock Settings (optional; if skipped, JEs no-op).
3. Ship the app build with the four code areas modified.
4. Spot-check the first real submit on prod to confirm the Stock Entry / JE come out as expected.

**Rollback:** revert the app changes — the new Frappe fields go dormant, no data corruption. Existing events/Stock Entries created in the new shape remain valid records.

## 11. Open questions

None at sign-off time. All clarifications resolved during brainstorming.
