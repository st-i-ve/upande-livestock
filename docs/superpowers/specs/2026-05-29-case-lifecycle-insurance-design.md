# Case lifecycle + insurance — sub-project B

**Date:** 2026-05-29
**Author:** james@upande.com (with Claude)
**Status:** Design — approved 2026-05-29

---

## 1. Background

The app's Animal Health Case flow today creates new cases in `Open` status but offers no UI to close them or set an outcome. The `case_status` enum on Frappe already includes `Open / Under Treatment / Recovered / Chronic / Died / Culled` — the three outcomes the operator cares about (okay / still sick / died after treatment) map directly to `Recovered / Chronic / Died`. The missing piece is the UI to transition.

When an animal dies, the operator wants to attach a post-mortem report, see the insured value, and capture the insurance claim amount so the existing server-script JE posts against the right figure. Frappe already exposes `Animal.insured_value` (settable on animal creation) and `Animal Disposal.insurance_claim_amount` (a field the server uses for receivable accounting). Neither is currently visible in the app UI.

## 2. Goals

- Operator can close a Health Case from the cases list with a clear outcome: Recovered / Chronic / Died.
- Closing a "Died" case prompts for an optional post-mortem file attachment and shows the animal's insured value.
- The Animal Disposal form surfaces insured value when relevant and accepts an editable `insurance_claim_amount`.
- Post-mortem files can be attached to either the Health Case or the Animal Disposal.
- Animal detail page shows insured value when set.

## 3. Non-goals

- No new "Insurance Claim" doctype. Frappe's existing receivable-JE flow on Animal Disposal is sufficient.
- No new `case_status` enum values. The three outcomes reuse existing enum members.
- No bulk-close-cases action.
- No claim-status workflow (filed / approved / paid). That's the insurer's process, not ours.
- No automated tests (consistent with project policy).

## 4. Fixed decisions (locked during brainstorming)

| Decision | Choice | Reason |
|---|---|---|
| Outcome mapping | Recovered / Chronic / Died (existing enum) | No schema change; semantics already aligned. |
| Case close UI location | `app/(tabs)/alerts/cases/[name].tsx` (tap a row in the cases list) | Discoverability — cases live in the alerts tab. |
| Insurance claim model | Edit `insurance_claim_amount` on Animal Disposal | Server scripts already use this for the receivable JE. |
| Post-mortem storage | Standard Frappe `File` doc, attached to whichever parent the operator was on (Case or Disposal) | Reuses Frappe's built-in attachment. |
| File picker | `expo-document-picker` for PDFs/images, `expo-image-picker` only if camera UX needed (not in scope) | Document picker covers both. |
| Upload mechanism | POST to Frappe `/api/method/upload_file` with the doctype + name | Standard Frappe upload endpoint. |
| Insured value display | KV on animal detail; banner on disposal form when relevant; banner on case-close when outcome=Died | Three points of visibility; no schema add. |

## 5. Architecture & file layout

```
src/
  frappe/
    files.ts                            new — attachFile({ doctype, name, asset })
    animalDisposal.ts                   modified — add insuranceClaimAmount to input/payload
    animalHealthCase.ts                 modified — add updateAnimalHealthCase + close payload type
  hooks/
    mutations.ts                        modified — useUpdateAnimalHealthCase, plumb insuranceClaimAmount
    useAnimalHealthCase.ts              new — fetch a single case by name (detail screen)
  offline/
    queue.ts                            modified — add "AnimalHealthCaseUpdate" mutation type
    dispatcher.ts                       modified — wire updateAnimalHealthCase
components/
  AttachmentPicker.tsx                  new — wraps expo-document-picker + upload progress
app/(tabs)/alerts/
  cases/
    [name].tsx                          new — case detail + close screen
  cases.tsx                             modified — rows route to /alerts/cases/[name]
app/(tabs)/animals/
  [id].tsx                              modified — KV row for insured value
app/(tabs)/record/culls/
  new.tsx                               modified — insured-value banner, insurance_claim_amount input, post-mortem picker
```

**New dependencies:** `expo-document-picker` (already a common Expo package; verify it's installed — if not, add via npm/expo install). No other new packages.

### 5.1 `attachFile` helper

Wraps Frappe's upload endpoint:

```ts
type AttachFileInput = {
  doctype: string;
  docname: string;
  asset: { uri: string; name: string; mimeType: string };
  isPrivate?: boolean;          // default true (post-mortems are sensitive)
};
type AttachFileResult = { fileName: string; fileUrl: string };
attachFile(input: AttachFileInput): Promise<AttachFileResult>;
```

POST to `/api/method/upload_file` with a `FormData`:
- `file` (the asset blob)
- `doctype`, `docname` (parent doc)
- `is_private` (1/0)

Failure handling: if upload fails, the calling screen surfaces a non-blocking warning ("Doc saved, but the post-mortem attachment failed: …. Re-upload from desktop."). The parent doc save is NOT rolled back.

### 5.2 Case-close screen

Layout (top to bottom):
1. **Header strip:** animal name + tag, severity pill, opened date.
2. **Symptoms & notes** — pulled from the case doc.
3. **Treatments log** — read-only list of treatments with item, qty, rate, amount, total.
4. **Total cost tile.**
5. **Close case section** (collapsed if `case_status` not in Open/Under Treatment):
   - Outcome chips: Recovered / Chronic / Died.
   - Closing notes textarea.
   - Closing date (default today).
   - If outcome = Died:
     - "Insured for KES X" banner (or "Not insured" if 0).
     - `AttachmentPicker` for post-mortem (PDF or image, multiple files allowed).
     - "Open disposal form" button → `router.push("/(tabs)/record/culls/new?animal=<id>&disposalType=Died — Disease")` (default; operator can change).
   - Submit button: "Close case".

On submit:
- Call `useUpdateAnimalHealthCase` with `{ name, caseStatus, closingNotes, closingDate }`.
- After the case PUT succeeds, upload each post-mortem file via `attachFile({ doctype: "Animal Health Case", docname: name, asset })`.
- Navigate back to the cases list with a success banner.

### 5.3 `updateAnimalHealthCase` mutation

```ts
type UpdateAnimalHealthCaseInput = {
  name: string;
  caseStatus: CaseStatus;       // "Recovered" | "Chronic" | "Died"
  closingNotes?: string;
  closingDate?: string;
};
updateAnimalHealthCase(input): Promise<any>;
```

Uses `PUT /api/resource/Animal Health Case/<name>` with the patch fields. The hook wraps in `tryDirectOrEnqueue` with mutation type `"AnimalHealthCaseUpdate"` for offline resilience.

### 5.4 Disposal-form enrichment

In `app/(tabs)/record/culls/new.tsx`:
- When `disposalType` starts with "Died — " AND any selected animal has `insured_value > 0`:
  - Banner: `"<N> insured animal(s) · Σ insured value KES <total>"`.
  - New input: `Insurance claim amount (KES)` — default = sum of insured_values, editable.
  - `AttachmentPicker` for post-mortem reports.
- Otherwise: hide all three.

On submit:
- Per-animal disposal payload now includes `insuranceClaimAmount` (split pro-rata across animals: `total / count`, rounded). Per-animal post-mortem files attach to each disposal doc.
- If user picked one post-mortem file but there are multiple animals: attach to each disposal (Frappe's File doc supports many-to-one via `File.attached_to_doctype/name`).

### 5.5 Animal detail KV

In `app/(tabs)/animals/[id].tsx` (or wherever the detail tiles render), add a row:
```
Insured value | KES <insured_value> (or "—" when 0/null)
```

## 6. Frappe schema changes

**None required.** All fields used (`Animal.insured_value`, `Animal Health Case.case_status / closing_notes / closing_date`, `Animal Disposal.insurance_claim_amount`) already exist on the live site. Customize Form is not needed for this sub-project.

If `closing_notes` and `closing_date` do not exist on the live `Animal Health Case` doctype, Frappe silently ignores unknown PUT fields — the case will still close cleanly with just `case_status`. The operator can revert the spec if Frappe reports the fields are missing.

## 7. Validation rules

| Rule | Where | Message |
|---|---|---|
| Outcome must be picked | Case-close screen | "Pick an outcome before closing the case." |
| Closing date not in the future | Case-close screen | "Closing date can't be in the future." |
| Insurance claim amount ≥ 0 when shown | Disposal form | "Enter a non-negative claim amount." |
| File size sanity (under 10 MB) | AttachmentPicker | "File too large (>10 MB). Compress before attaching." |

## 8. Error handling

- Case PUT fails: alert with the Frappe error, no navigation.
- Case PUT succeeds but file upload fails: case-close completes, banner shows "Closed. Attachment failed: re-upload from desktop."
- Disposal submit fails: existing partial-state alert (unchanged from current behavior).
- Disposal succeeds but post-mortem upload fails: alert with the per-disposal failure list.

## 9. Testing & rollout

Manual verification:

1. **Recover a case:** open an existing Open case → choose Recovered → close. Case status updates on the list.
2. **Mark as Chronic:** repeat with Chronic. Case re-appears in the closed section.
3. **Die without insurance:** close a case with Died on an animal with `insured_value=0`. No banner. Optional post-mortem attaches.
4. **Die with insurance:** close a case with Died on an animal with `insured_value=50000`. Banner shows "Insured for KES 50,000". Attach a post-mortem PDF.
5. **Disposal of insured animal:** record a "Died — Disease" disposal for that animal. Banner shows the insured value; default claim amount = insured_value; operator overrides to 45000; submit. Confirm Animal Disposal doc has `insurance_claim_amount=45000` and the server-script JE used that value.
6. **Animal detail KV:** open the animal's detail page. The "Insured value" KV row shows KES 50,000.
7. **File upload offline:** airplane mode, close a case with attachment. The case PUT queues; the attachment fails with the offline message. Reconnect, queue drains the PUT, then re-upload manually.

**Rollout:** ship the app build; no Frappe schema work needed.

## 10. Open questions

None at sign-off.
