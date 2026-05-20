# Navigation Tree Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the Expo Router app from a flat root-Stack registration of every detail screen into a per-tab nested Stack tree, eliminating three overlapping launchpads (Home Quick Actions, Record, More drawer) down to one canonical event launcher (Record).

**Architecture:** Expo Router file-based routing. Each tab gets its own folder under `app/(tabs)/` with an `_layout.tsx` exporting `<Stack>`. Routes shared between tabs (currently only `animal/[id]`) extract their screen body into `components/screens/` and are mounted by thin route files in each tab that needs them. The root `app/_layout.tsx` Stack registers only `(tabs)`.

**Tech Stack:** Expo Router 6, React Native 0.81, TypeScript, `@react-navigation/bottom-tabs`. No test framework currently — verification is `npx tsc --noEmit`, `npm run lint`, and a manual smoke test in the Expo dev client between tasks.

**Reference spec:** `docs/superpowers/specs/2026-05-20-navigation-tree-design.md`

---

## Verification harness used by every task

This project has no test framework. Each task's verification step runs:

```bash
npx tsc --noEmit
npm run lint
```

Plus a manual smoke test of the affected flows in Expo (start with `npm start` and tap through). If type-check or lint fails, fix before commit. If the smoke test surfaces a broken link, fix and add the missing path-rewrite before commit.

---

## Task 1: Convert each tab file into a tab folder with Stack layout

Each tab currently lives as a single `.tsx` file under `app/(tabs)/`. Expo Router auto-discovers routes from the file system, and `<Tabs.Screen name="animals" />` resolves to either `app/(tabs)/animals.tsx` OR `app/(tabs)/animals/index.tsx`. We convert all four tabs (except Home which stays a leaf) to the folder form and add an empty `<Stack>` layout. After this task, behavior is unchanged — each tab shows the same content, just relocated.

**Files:**
- Move: `app/(tabs)/animals.tsx` → `app/(tabs)/animals/index.tsx`
- Move: `app/(tabs)/record.tsx` → `app/(tabs)/record/index.tsx`
- Move: `app/(tabs)/alerts.tsx` → `app/(tabs)/alerts/index.tsx`
- Move: `app/(tabs)/more.tsx` → `app/(tabs)/more/index.tsx`
- Create: `app/(tabs)/animals/_layout.tsx`
- Create: `app/(tabs)/record/_layout.tsx`
- Create: `app/(tabs)/alerts/_layout.tsx`
- Create: `app/(tabs)/more/_layout.tsx`

- [ ] **Step 1: Move the four tab files into folders**

Run from project root in PowerShell:

```powershell
New-Item -ItemType Directory -Path "app\(tabs)\animals","app\(tabs)\record","app\(tabs)\alerts","app\(tabs)\more" -Force | Out-Null
Move-Item "app\(tabs)\animals.tsx" "app\(tabs)\animals\index.tsx"
Move-Item "app\(tabs)\record.tsx"  "app\(tabs)\record\index.tsx"
Move-Item "app\(tabs)\alerts.tsx"  "app\(tabs)\alerts\index.tsx"
Move-Item "app\(tabs)\more.tsx"    "app\(tabs)\more\index.tsx"
```

- [ ] **Step 2: Create the four Stack layouts**

Same content for all four. Create `app/(tabs)/animals/_layout.tsx`:

```tsx
import { Stack } from "expo-router";
import React from "react";

export default function AnimalsStackLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }} />;
}
```

Repeat with the function renamed (`RecordStackLayout`, `AlertsStackLayout`, `MoreStackLayout`) at:
- `app/(tabs)/record/_layout.tsx`
- `app/(tabs)/alerts/_layout.tsx`
- `app/(tabs)/more/_layout.tsx`

- [ ] **Step 3: Verify type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both pass with no errors. (Lint may warn about unused screen-options config — ignore.)

- [ ] **Step 4: Manual smoke test**

```bash
npm start
```

Open in Expo Go or web. Tap through all five tabs — each should still display its original content. Tabs Home, Animals, Record, Alerts, More all resolve to their original screens.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/"
git commit -m "refactor(nav): convert tab files into folders with Stack layouts"
```

---

## Task 2: Extract AnimalDetail shared body to components/screens/

Currently `app/animal/[id].tsx` reads `id` from search params and renders the detail view inline. The route will eventually be mounted in both Animals and Alerts tab stacks (the spec's shared-screen pattern). Extract the body into a reusable component that takes `id` as a prop; replace the route file with a thin wrapper that passes search params in. No path changes — the route still answers at `/animal/[id]` for now.

**Files:**
- Read: `app/animal/[id].tsx` (full file)
- Create: `components/screens/AnimalDetail.tsx`
- Modify: `app/animal/[id].tsx` (replace body with wrapper)

- [ ] **Step 1: Read the current animal detail file**

Open `app/animal/[id].tsx`. Identify the body (everything inside `export default function AnimalDetail()` after the `id` extraction and `animals.find(...)` lookup).

- [ ] **Step 2: Create the shared component**

Create `components/screens/AnimalDetail.tsx`. Copy the entire current `app/animal/[id].tsx` file content, then change two things:

1. The export signature changes from `export default function AnimalDetail()` to `export function AnimalDetail({ id }: { id: string })`
2. Delete the line `const { id } = useLocalSearchParams<{ id: string }>();` — `id` now comes from props
3. Remove the `useLocalSearchParams` import (no longer used in this file)

Everything else (imports, JSX, the `animals.find`, the "Not found" branch, the Tile grids, the Banner, the Timeline) stays identical.

- [ ] **Step 3: Replace the route file with a thin wrapper**

Overwrite `app/animal/[id].tsx` with:

```tsx
import { useLocalSearchParams } from "expo-router";
import React from "react";

import { AnimalDetail } from "@/components/screens/AnimalDetail";

export default function AnimalDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AnimalDetail id={id ?? ""} />;
}
```

- [ ] **Step 4: Verify type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both pass.

- [ ] **Step 5: Manual smoke test**

In Animals tab, tap any animal row. The detail screen should render exactly as before — same banner, same metric grid, same tile actions, same timeline. (The action tiles still link to `/events/*` paths which exist; those move in Task 5.)

- [ ] **Step 6: Commit**

```bash
git add components/screens/AnimalDetail.tsx "app/animal/[id].tsx"
git commit -m "refactor(animal-detail): extract screen body to components/screens/AnimalDetail"
```

---

## Task 3: Move Animals stack content (animal detail + herds) + rewrite callers

Move `animal/[id].tsx` and `herds/*` under the Animals tab. Update every internal `router.push` that targets the old paths, and update the relevant `drawerStruct` rows in `data/mock.ts`. Clean the corresponding entries out of the root `app/_layout.tsx` Stack.

The herd detail screen contains `router.push` calls to `/events/animal-feed` and `/events/milk`. Events still live at the root path at this point — leave those references alone. Task 5 will rewrite them.

**Files:**
- Move: `app/animal/[id].tsx` → `app/(tabs)/animals/[id].tsx`
- Move: `app/herds/index.tsx` → `app/(tabs)/animals/herds/index.tsx`
- Move: `app/herds/[name].tsx` → `app/(tabs)/animals/herds/[name].tsx`
- Modify: `app/(tabs)/animals/index.tsx`
- Modify: `app/_layout.tsx`
- Modify: `data/mock.ts`

- [ ] **Step 1: Move the three files**

```powershell
New-Item -ItemType Directory -Path "app\(tabs)\animals\herds" -Force | Out-Null
Move-Item "app\animal\[id].tsx" "app\(tabs)\animals\[id].tsx"
Move-Item "app\herds\index.tsx" "app\(tabs)\animals\herds\index.tsx"
Move-Item "app\herds\[name].tsx" "app\(tabs)\animals\herds\[name].tsx"
Remove-Item "app\animal" -Recurse
Remove-Item "app\herds" -Recurse
```

- [ ] **Step 2: Update the Animals list caller**

In `app/(tabs)/animals/index.tsx`, find the line (currently line 57):

```tsx
<AnimalRow key={a.id} a={a} onPress={() => router.push(`/animal/${encodeURIComponent(a.id)}`)} />
```

Change to:

```tsx
<AnimalRow key={a.id} a={a} onPress={() => router.push(`/(tabs)/animals/${encodeURIComponent(a.id)}`)} />
```

- [ ] **Step 3: Delete the corresponding root Stack registrations**

In `app/_layout.tsx`, delete these three lines:

```tsx
<Stack.Screen name="animal/[id]" />
<Stack.Screen name="herds/index" />
<Stack.Screen name="herds/[name]" />
```

- [ ] **Step 4: Update drawerStruct hrefs in data/mock.ts**

Open `data/mock.ts`. In the `drawerStruct` constant, find the `Records` group. Change:

```ts
{ id: "animals", ic: "format-list-bulleted", l: "Animals", href: "/(tabs)/animals" },
{ id: "herds", ic: "fence", l: "Herds", href: "/herds" },
```

The `animals` line is already correct. Change the `herds` href:

```ts
{ id: "herds", ic: "fence", l: "Herds", href: "/(tabs)/animals/herds" },
```

- [ ] **Step 5: Verify type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both pass.

- [ ] **Step 6: Manual smoke test**

1. Animals tab → tap any animal → detail opens inside Animals stack. Back returns to list.
2. From More → Herds → herds list opens inside Animals stack (More tab indicator becomes Animals tab indicator — that's intentional, More items are directory links).
3. Tap a herd → herd detail opens. Back returns to herd list.
4. The "Feed this herd" and "Record milking" buttons on a herd detail still 404 (events not moved yet) — that's expected.

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/animals" "app/_layout.tsx" "data/mock.ts"
git commit -m "refactor(nav): nest animal & herd routes under Animals tab"
```

---

## Task 4: Move Alerts stack content (cases + diagnoses) + rewrite callers

Move `cases.tsx` and `diagnoses.tsx` under the Alerts tab. Update `drawerStruct` rows. Clean root Stack entries. The diagnoses page contains a `router.push("/events/diagnosis")` call — leave it; Task 5 rewrites events.

The cases page has a "New case" button without an `onPress`. We do NOT wire it in this task because the destination route `/(tabs)/record/cases/new` doesn't exist yet — Task 5 creates the form and wires the button at the same time.

**Files:**
- Move: `app/cases.tsx` → `app/(tabs)/alerts/cases.tsx`
- Move: `app/diagnoses.tsx` → `app/(tabs)/alerts/diagnoses.tsx`
- Modify: `app/_layout.tsx`
- Modify: `data/mock.ts`

- [ ] **Step 1: Move the two files**

```powershell
Move-Item "app\cases.tsx" "app\(tabs)\alerts\cases.tsx"
Move-Item "app\diagnoses.tsx" "app\(tabs)\alerts\diagnoses.tsx"
```

- [ ] **Step 2: Delete corresponding root Stack registrations**

In `app/_layout.tsx`, delete:

```tsx
<Stack.Screen name="diagnoses" />
<Stack.Screen name="cases" />
```

- [ ] **Step 3: Update drawerStruct hrefs in data/mock.ts**

In `data/mock.ts` `drawerStruct` → `Records` group, change:

```ts
{ id: "diagnoses", ic: "magnify", l: "Diagnoses", href: "/diagnoses" },
{ id: "cases", ic: "stethoscope", l: "Health cases", href: "/cases", b: 3 },
```

To:

```ts
{ id: "diagnoses", ic: "magnify", l: "Diagnoses", href: "/(tabs)/alerts/diagnoses" },
{ id: "cases", ic: "stethoscope", l: "Health cases", href: "/(tabs)/alerts/cases", b: 3 },
```

- [ ] **Step 4: Verify type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both pass.

- [ ] **Step 5: Manual smoke test**

1. From More → Diagnoses → diagnoses list opens (tab indicator switches to Alerts). Back goes to Alerts index.
2. From More → Health cases → cases list opens inside Alerts stack.
3. Diagnoses page "New diagnosis" button still 404s (events not moved yet) — expected.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/alerts" "app/_layout.tsx" "data/mock.ts"
git commit -m "refactor(nav): nest cases & diagnoses under Alerts tab"
```

---

## Task 5: Move Record stack content + create cases/new + remove Home Quick Actions + sweep all event callers

This is the largest task because the events folder is referenced from almost every other screen. We move all event forms, create the new `cases/new` form, remove Home's duplicate Quick Actions grid, delete event groups from `drawerStruct`, and rewrite every callsite that referenced `/events/*`, `/event-success`, `/sales/new`, `/culls/new`, or `/cases`.

The new `cases/new` form is modeled on `sales/new.tsx` — animal picker + a few fields + submit-to-success. Keep it minimal; we're not designing the case-creation business logic in this task, just making the route exist with a consistent shape.

**Files:**
- Move: `app/events/*.tsx` (10 files) → `app/(tabs)/record/events/`
- Move: `app/event-success.tsx` → `app/(tabs)/record/success.tsx`
- Move: `app/sales/new.tsx` → `app/(tabs)/record/sales/new.tsx`
- Move: `app/culls/new.tsx` → `app/(tabs)/record/culls/new.tsx`
- Create: `app/(tabs)/record/cases/new.tsx`
- Modify: `app/(tabs)/record/index.tsx` (rewrite all SECTIONS hrefs)
- Modify: `app/(tabs)/index.tsx` (delete QUICK_ACTIONS, make milk-by-herd rows pressable)
- Modify: `app/(tabs)/animals/[id].tsx` — wait, this file is the `AnimalDetailRoute` wrapper; the event hrefs live in the shared component instead.
- Modify: `components/screens/AnimalDetail.tsx` (rewrite all `/events/*` hrefs)
- Modify: `app/(tabs)/animals/herds/[name].tsx` (rewrite event hrefs)
- Modify: `app/(tabs)/alerts/cases.tsx` (wire "New case" button)
- Modify: `app/(tabs)/alerts/diagnoses.tsx` (rewrite event href)
- Modify: every file in `app/(tabs)/record/events/` (rewrite `event-success` hrefs)
- Modify: `app/(tabs)/record/sales/new.tsx` (rewrite `event-success` href)
- Modify: `app/(tabs)/record/culls/new.tsx` (rewrite `event-success` href)
- Modify: `app/(tabs)/record/success.tsx` (no path change — Done button targets `/(tabs)` which is correct)
- Modify: `app/_layout.tsx` (delete events/[type], event-success, sales/new, culls/new entries)
- Modify: `data/mock.ts` (delete `Daily routine` and `Animal events` groups from `drawerStruct`)

- [ ] **Step 1: Move the event forms and related files**

```powershell
New-Item -ItemType Directory -Path "app\(tabs)\record\events","app\(tabs)\record\sales","app\(tabs)\record\culls","app\(tabs)\record\cases" -Force | Out-Null
Move-Item "app\events\*"        "app\(tabs)\record\events\"
Move-Item "app\event-success.tsx" "app\(tabs)\record\success.tsx"
Move-Item "app\sales\new.tsx"   "app\(tabs)\record\sales\new.tsx"
Move-Item "app\culls\new.tsx"   "app\(tabs)\record\culls\new.tsx"
Remove-Item "app\events" -Recurse
```

(Don't remove `app\sales` and `app\culls` yet — `index.tsx` files are still there and move in Task 6.)

- [ ] **Step 2: Rewrite event-success destinations in moved event forms**

In each of these 10 files under `app/(tabs)/record/events/` (plus `sales/new.tsx` and `culls/new.tsx`), replace `/event-success` with `/(tabs)/record/success`:

Files to edit:
- `app/(tabs)/record/events/milk.tsx` line ~102
- `app/(tabs)/record/events/calf-feed.tsx` line ~80
- `app/(tabs)/record/events/animal-feed.tsx` line ~64
- `app/(tabs)/record/events/calving.tsx` line ~59
- `app/(tabs)/record/events/dryoff.tsx` line ~31
- `app/(tabs)/record/events/movement.tsx` line ~92
- `app/(tabs)/record/events/pd.tsx` line ~41
- `app/(tabs)/record/events/service.tsx` line ~36
- `app/(tabs)/record/events/diagnosis.tsx` — search for any `/event-success` references
- `app/(tabs)/record/events/[type].tsx` — search for any `/event-success` references
- `app/(tabs)/record/sales/new.tsx` line ~49
- `app/(tabs)/record/culls/new.tsx` line ~45

For each, change `router.replace("/event-success?name=X")` → `router.replace("/(tabs)/record/success?name=X")`.

Bulk approach (PowerShell, project root):

```powershell
Get-ChildItem -Path "app\(tabs)\record" -Recurse -Filter *.tsx | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  $updated = $content -replace '/event-success', '/(tabs)/record/success'
  if ($content -ne $updated) { Set-Content $_.FullName $updated -NoNewline }
}
```

- [ ] **Step 3: Fix the calving.tsx cross-event reference**

In `app/(tabs)/record/events/calving.tsx` line 31, the empty-state action pushes `/events/pd`. Change:

```tsx
emptyAction={{ label: "Add pregnancy", onPress: () => router.push("/events/pd") }}
```

To:

```tsx
emptyAction={{ label: "Add pregnancy", onPress: () => router.push("/(tabs)/record/events/pd") }}
```

- [ ] **Step 4: Create the new cases/new form**

Create `app/(tabs)/record/cases/new.tsx`. The `Picker` component (defined at `components/Picker.tsx`) takes `value: T`, `onChange: (next: T) => void`, and `options: T[]` (array of strings, not `{value, label}[]`).

```tsx
import { router } from "expo-router";
import React, { useState } from "react";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Button } from "@/components/Button";
import { Field, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { APP } from "@/constants/theme";

const SEVERITIES = ["Mild", "Moderate", "Severe"] as const;

export default function CaseNew() {
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("Moderate");

  return (
    <Screen title="New health case" subtitle="Opens an active case in the action queue" back>
      <Field label="Animal">
        <AnimalPickerButton />
      </Field>
      <Field label="Date">
        <Input value={APP.today} />
      </Field>
      <Field label="Condition">
        <Input placeholder="Mastitis, lameness, ..." />
      </Field>
      <Field label="Severity">
        <Picker value={severity} onChange={setSeverity} options={[...SEVERITIES]} />
      </Field>
      <Field label="Notes">
        <Textarea placeholder="Observations, treatment plan, ..." />
      </Field>
      <Button label="Open case" onPress={() => router.replace("/(tabs)/record/success?name=Health case")} />
    </Screen>
  );
}
```

If any imported component (`AnimalPickerButton`, `Field`, `Input`, `Textarea`) has a different prop signature than used above, adjust to match — open each file under `components/` to verify before committing.

- [ ] **Step 5: Rewrite Record launcher hrefs**

In `app/(tabs)/record/index.tsx` (formerly `record.tsx`), the `SECTIONS` constant has hrefs like `/events/milk`, `/cases`, `/sales/new`, `/culls/new`. Update all event hrefs to `/(tabs)/record/events/<x>`, and the four non-event hrefs:

```ts
{ icon: "stethoscope", label: "New health case", href: "/(tabs)/record/cases/new" },
{ icon: "cash", label: "Sell animal", href: "/(tabs)/record/sales/new" },
{ icon: "delete-outline", label: "Cull / death", href: "/(tabs)/record/culls/new" },
```

For events, replace every occurrence of `href: "/events/` with `href: "/(tabs)/record/events/`. Bulk-replace in this file is safe — every `/events/` href is in this file's `SECTIONS` array.

- [ ] **Step 6: Update Home (`app/(tabs)/index.tsx`) — delete Quick Actions, add herd row press**

In `app/(tabs)/index.tsx`:

a) Delete the entire `QUICK_ACTIONS` constant declaration (currently lines 14-31).

b) Delete the entire `<SectionTitle>Quick actions</SectionTitle>` plus the `<TileGrid>` block (currently lines 88-93):

```tsx
<SectionTitle>Quick actions</SectionTitle>
<TileGrid>
  {QUICK_ACTIONS.map((q) => (
    <Tile key={q.href} icon={q.icon} title={q.label} onPress={() => router.push(q.href as any)} />
  ))}
</TileGrid>
```

c) Remove the now-unused imports: `Tile` and `TileGrid` from `@/components/Tile`. The `router` import stays because the alert preview still uses it.

d) Wrap each herd row in the "Today's milk by herd" loop with a `<Pressable>` that routes to herd detail. The current loop (around line 55) is:

```tsx
{todaysMilk.map((r) => (
  <View key={r.herd} style={s.herdRow}>
    ...
  </View>
))}
```

Change `View` to `Pressable` and add the handler. Import `Pressable` from `react-native`:

```tsx
{todaysMilk.map((r) => (
  <Pressable
    key={r.herd}
    onPress={() => router.push(`/(tabs)/animals/herds/${encodeURIComponent(r.herd)}`)}
    style={({ pressed }) => [s.herdRow, pressed && { backgroundColor: COLORS.bgMuted }]}
  >
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={s.herdName} numberOfLines={1}>{r.herd}</Text>
      <Text style={s.herdMeta}>{r.cnt} cows · expected ~{r.expected} kg/day</Text>
    </View>
    <View style={s.session}>
      <Text style={s.sessLbl}>AM</Text>
      <Text style={[s.sessVal, r.am === null && s.sessPending]}>
        {r.am !== null ? `${r.am} kg` : "pending"}
      </Text>
    </View>
    <View style={s.session}>
      <Text style={s.sessLbl}>PM</Text>
      <Text style={[s.sessVal, r.pm === null && s.sessPending]}>
        {r.pm !== null ? `${r.pm} kg` : "pending"}
      </Text>
    </View>
  </Pressable>
))}
```

- [ ] **Step 7: Update other event-path callers**

Files containing stale `/events/...` references that must be rewritten to `/(tabs)/record/events/...`:

a) `components/screens/AnimalDetail.tsx` — lines previously at 45, 48, 49, 50, 54, 55, 56 of `app/animal/[id].tsx` (now in the shared component):

```
"/events/diagnosis"      → "/(tabs)/record/events/diagnosis"
"/events/calf-feed"      → "/(tabs)/record/events/calf-feed"
"/events/weight"         → "/(tabs)/record/events/weight"
"/events/movement"       → "/(tabs)/record/events/movement"
"/events/vaccination"    → "/(tabs)/record/events/vaccination"
"/events/service"        → "/(tabs)/record/events/service"
```

b) `app/(tabs)/animals/herds/[name].tsx` lines 60-61:

```
"/events/animal-feed" → "/(tabs)/record/events/animal-feed"
"/events/milk"        → "/(tabs)/record/events/milk"
```

c) `app/(tabs)/alerts/diagnoses.tsx` line 23:

```
"/events/diagnosis" → "/(tabs)/record/events/diagnosis"
```

- [ ] **Step 8: Wire the "New case" button on cases.tsx**

In `app/(tabs)/alerts/cases.tsx`, find the line:

```tsx
<Button label="New case" icon="plus" />
```

Change to:

```tsx
<Button label="New case" icon="plus" onPress={() => router.push("/(tabs)/record/cases/new")} />
```

Add `import { router } from "expo-router";` at the top if not already present.

- [ ] **Step 9: Delete event-related entries from data/mock.ts drawerStruct**

In `data/mock.ts`, delete two entire groups from `drawerStruct`:

- The `Daily routine` group (3 items: milk, calf-feed, animal-feed)
- The `Animal events` group (13 items: diagnosis, birth, weight, movement, vaccination, deworming, dehorning, hoof, heat, service, pd, calving, dryoff)

Keep all other groups (`Overview`, `Records`, `Reports`, `Inventory`, plus any others).

- [ ] **Step 10: Delete corresponding root Stack registrations**

In `app/_layout.tsx`, delete these four lines (the screens whose files moved in this task):

```tsx
<Stack.Screen name="sales/new" />
<Stack.Screen name="culls/new" />
<Stack.Screen name="events/[type]" />
<Stack.Screen name="event-success" />
```

Leave `sales/index`, `culls/index`, `reports/[type]`, `inventory/[type]`, and `settings` registrations — Task 6 moves those files and removes those entries.

- [ ] **Step 11: Verify type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both pass. If TypeScript complains about unused `QUICK_ACTIONS`, `Tile`, or `TileGrid` imports in `app/(tabs)/index.tsx`, remove them (Step 6c).

- [ ] **Step 12: Manual smoke test — full event flow**

1. Record tab → tap any event → form opens inside Record stack → submit → success screen → "Done" returns to Home.
2. Record tab → "New health case" → new form opens. Submit → success.
3. Record tab → "Sell animal" → form → submit → success.
4. Record tab → "Cull / death" → form → submit → success.
5. Alerts tab → Cases → "New case" → opens the new form (tab switches to Record).
6. Home tab → tap any herd row in "Today's milk by herd" → herd detail (tab switches to Animals).
7. Home tab → confirm Quick Actions grid is gone, no broken layout.
8. Animal detail → tap any action tile (Diagnose, Feed, etc.) → corresponding event form opens (tab switches to Record).
9. Calving form → "Add pregnancy" empty-state button → routes to PD form.
10. More tab → confirm Daily routine and Animal events sections are gone from the drawer.

- [ ] **Step 13: Commit**

```bash
git add "app/(tabs)" "app/_layout.tsx" "data/mock.ts" "components/screens/AnimalDetail.tsx"
git commit -m "refactor(nav): nest events/sales/culls under Record tab and remove Home Quick Actions"
```

---

## Task 6: Move More stack content (settings, reports, inventory, sales/index, culls/index)

Move the remaining archive lists, settings, and report/inventory dynamic routes under the More tab. Update `drawerStruct` rows for these destinations. Clean root Stack entries.

**Files:**
- Move: `app/settings.tsx` → `app/(tabs)/more/settings.tsx`
- Move: `app/sales/index.tsx` → `app/(tabs)/more/sales/index.tsx`
- Move: `app/culls/index.tsx` → `app/(tabs)/more/culls/index.tsx`
- Move: `app/reports/[type].tsx` → `app/(tabs)/more/reports/[type].tsx`
- Move: `app/inventory/[type].tsx` → `app/(tabs)/more/inventory/[type].tsx`
- Modify: `app/(tabs)/more/sales/index.tsx` (rewrite `/sales/new` reference)
- Modify: `app/(tabs)/more/culls/index.tsx` (rewrite `/culls/new` reference)
- Modify: `app/_layout.tsx`
- Modify: `data/mock.ts`

- [ ] **Step 1: Move the files**

```powershell
New-Item -ItemType Directory -Path "app\(tabs)\more\sales","app\(tabs)\more\culls","app\(tabs)\more\reports","app\(tabs)\more\inventory" -Force | Out-Null
Move-Item "app\settings.tsx"          "app\(tabs)\more\settings.tsx"
Move-Item "app\sales\index.tsx"       "app\(tabs)\more\sales\index.tsx"
Move-Item "app\culls\index.tsx"       "app\(tabs)\more\culls\index.tsx"
Move-Item "app\reports\[type].tsx"    "app\(tabs)\more\reports\[type].tsx"
Move-Item "app\inventory\[type].tsx"  "app\(tabs)\more\inventory\[type].tsx"
Remove-Item "app\sales" -Recurse
Remove-Item "app\culls" -Recurse
Remove-Item "app\reports" -Recurse
Remove-Item "app\inventory" -Recurse
```

- [ ] **Step 2: Rewrite the two list-page callsites**

In `app/(tabs)/more/sales/index.tsx` line ~20:

```
"/sales/new" → "/(tabs)/record/sales/new"
```

In `app/(tabs)/more/culls/index.tsx` line ~20:

```
"/culls/new" → "/(tabs)/record/culls/new"
```

- [ ] **Step 3: Delete corresponding root Stack registrations**

In `app/_layout.tsx`, delete any remaining entries for `settings`, `reports/[type]`, `inventory/[type]`. After this step the only line inside `<Stack>` should be `<Stack.Screen name="(tabs)" />`.

- [ ] **Step 4: Update drawerStruct hrefs in data/mock.ts**

In `data/mock.ts` `drawerStruct`:

- `Records` group: change `Sales` href from `/sales` to `/(tabs)/more/sales`. Change `Culls / deaths` href from `/culls` to `/(tabs)/more/culls`.
- `Reports` group: change every href from `/reports/<x>` to `/(tabs)/more/reports/<x>`.
- `Inventory` group: change every href from `/inventory/<x>` to `/(tabs)/more/inventory/<x>`.
- `Setup` group (line 144): change `Livestock settings` href from `/settings` to `/(tabs)/more/settings`.

- [ ] **Step 5: Verify type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both pass.

- [ ] **Step 6: Manual smoke test**

1. More tab → Settings → opens.
2. More tab → Sales (archive) → opens. "Record sale" button → opens sales/new in Record tab.
3. More tab → Culls / deaths (archive) → opens. "Record cull / death" button → opens culls/new in Record tab.
4. More tab → any Report → opens correct dynamic route.
5. More tab → any Inventory item → opens correct dynamic route.

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/more" "app/_layout.tsx" "data/mock.ts"
git commit -m "refactor(nav): nest settings, reports, inventory, and archives under More tab"
```

---

## Task 7: Final sweep — verify no stale paths remain, smoke-test everything

After all moves, sweep the codebase for any lingering references to old root-level paths. This is a safety net: every stale path should have been caught and fixed in tasks 3-6, but a final grep confirms nothing slipped through.

**Files:** none modified unless the sweep finds something.

- [ ] **Step 1: Grep for stale root-level paths**

Run each of these from the project root. None should produce hits except in the spec/plan docs (which legitimately mention old paths in the "From → To" table):

```bash
git grep -n '"/events/'
git grep -n '"/event-success'
git grep -n '"/animal/'
git grep -n '"/herds'
git grep -n '"/cases"'
git grep -n '"/diagnoses"'
git grep -n '"/sales/new'
git grep -n '"/culls/new'
git grep -n '"/sales"'
git grep -n '"/culls"'
git grep -n '"/reports/'
git grep -n '"/inventory/'
git grep -n '"/settings"'
```

For any hit in `app/`, `components/`, `data/`, or `services/`, rewrite to the new nested path. (Hits in `docs/superpowers/specs/` and `docs/superpowers/plans/` are documentation and stay.)

- [ ] **Step 2: Verify the root Stack is minimal**

Open `app/_layout.tsx`. The `<Stack>` block should contain exactly:

```tsx
<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}>
  <Stack.Screen name="(tabs)" />
</Stack>
```

No other `<Stack.Screen>` entries. If any remain, remove them.

- [ ] **Step 3: Verify type-check and lint one final time**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both pass.

- [ ] **Step 4: Full app smoke test**

Run through every tab and every drilldown:

1. **Home tab**: banner, top tiles, milk-by-herd rows (tap one → herd detail in Animals tab), alert preview (tap one → Alerts tab). No Quick Actions grid.
2. **Animals tab**: list filters work. Tap animal → detail inside Animals stack. Back returns to list. Tap any animal action tile → corresponding event form (tab switches to Record). Submit event → success → Done returns Home.
3. **Record tab**: every section item opens its form inside Record stack. New health case form opens and submits. Sales/Culls forms open and submit. All submits land on success screen, Done goes Home.
4. **Alerts tab**: action queue lists. Tap cases sub-link from More → cases list inside Alerts. Tap diagnoses from More → diagnoses inside Alerts. New diagnosis button → diagnosis event form (switches to Record). New case → new case form in Record.
5. **More tab**: every drawer item routes correctly. Daily routine and Animal events groups are gone from the drawer. Records/Reports/Inventory items all open. Settings opens.

- [ ] **Step 5: Commit any sweep fixes**

If Step 1 turned up missed paths and you fixed them:

```bash
git add -A
git commit -m "refactor(nav): sweep stale root-level path references"
```

If the sweep was clean, no commit needed — verification step only.

---

## Coverage check against the spec

- **Tree-shaped navigation per tab**: Tasks 1, 3, 4, 5, 6 build the nested Stack folders under each tab.
- **Per-tab back-stacks**: enabled by the per-tab `_layout.tsx` Stack files created in Task 1.
- **Record as canonical event launcher**: Task 5 moves all events under Record and removes the Home/More duplicates.
- **Home becomes dashboard only**: Task 5 deletes Quick Actions and converts milk-by-herd rows into navigable links.
- **More no longer lists events**: Task 5 deletes the two event groups from `drawerStruct`.
- **Cases and diagnoses under Alerts**: Task 4 places them under the Alerts tab.
- **Cross-tab links push within tab**: enforced by file-based routing — each tab owns its nested route copies. `AnimalDetail` shared body extracted in Task 2 supports the multiple-mount pattern, ready for Alerts to mount it if/when a cases row needs to drill into animal detail.
- **`record/cases/new` creation form**: Task 5 Step 4 creates the file.
- **All file moves listed in spec's table**: covered across Tasks 3, 4, 5, 6.
- **All `drawerStruct` href rewrites**: covered across Tasks 3, 4, 5, 6.
- **All internal `router.push` callsite rewrites**: covered in Task 5 (Steps 2, 3, 7, 8) and Task 6 (Step 2), with the safety-net sweep in Task 7.
- **What we're NOT doing**: no modals, no backwards-compat aliases, no screen redesign — plan respects all "out of scope" items from the spec.
