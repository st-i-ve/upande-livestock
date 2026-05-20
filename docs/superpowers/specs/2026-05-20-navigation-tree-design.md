# Navigation Tree Consolidation — Design

**Date:** 2026-05-20
**Project:** upande-livestock-1 (Expo Router / React Native)
**Status:** Design approved by user; awaiting implementation plan

## Problem

The app currently uses a flat Expo Router structure: every detail screen (`animal/[id]`, `herds/*`, `cases`, `diagnoses`, `sales/*`, `culls/*`, `events/*`, `reports/*`, `inventory/*`, `settings`, `event-success`) is registered as a sibling of `(tabs)` in `app/_layout.tsx`. Consequences:

- Tab switches reset to root; deep screens have no tab context.
- Back navigation does not preserve a per-tab stack.
- Three separate launchpads (`Home Quick Actions`, `Record`, `More drawerStruct`) all point at the same `/events/*` routes, with overlapping but inconsistent inventories. A new event entry must be added in three places to stay consistent.

## Goals

1. **Tree-shaped navigation** — every screen has a single canonical parent route under one tab; back navigation traces the parent chain.
2. **Per-tab back-stacks** — each tab maintains its own stack history across tab switches.
3. **One source of truth per launchpad concern** — events live in Record only; archive lists live in More only; alert-actionable lists live in Alerts only.

Non-goal: redesigning screen content. This is purely a routing + duplication-removal change.

## Decisions (from brainstorm)

1. **Canonical event launcher = Record tab.** Home becomes pure dashboard; More keeps only Reports / Inventory / Settings / archive lists.
2. **`cases` and `diagnoses` belong under Alerts** (both treated as action-queue oriented).
3. **Cross-tab links push within the current tab's stack.** Routes shared between tabs (e.g. animal detail) are mounted in each tab that needs them; the screen body is extracted once into `components/screens/` and reused.
4. **"New health case" from Record creates a new route** `record/cases/new` consistent with `sales/new` and `culls/new`. The cases list stays under Alerts.

## Architecture

Expo Router is file-based, so the route tree is the folder tree. Each tab folder under `app/(tabs)/` contains its own `_layout.tsx` exporting a `<Stack>`. The root `app/_layout.tsx` Stack registers only `(tabs)`.

Routes that need to be reachable from multiple tabs (initially: animal detail) have their screen **body** extracted into `components/screens/AnimalDetail.tsx`. Each tab that needs to show an animal mounts the same component from a thin route file. This keeps render code single-source while allowing each tab's stack to push onto itself.

Home is a leaf — no nested stack. Drilldowns from Home widgets jump to other tabs via `router.push('/(tabs)/<tab>/...')`, which is the only place tab-switching is accepted (dashboards are expected to bounce users to detail views in other contexts).

## Final route tree

```
app/
  _layout.tsx                     Root Stack (only (tabs))
  (tabs)/
    _layout.tsx                   Tabs (Home, Animals, Record, Alerts, More)
    index.tsx                     Home — dashboard (no stack, leaf)

    animals/
      _layout.tsx                 Stack
      index.tsx                   Animals list (filterable)
      [id].tsx                    -> <AnimalDetail id={…} />
      herds/
        index.tsx                 Herds list
        [name].tsx                Herd detail

    record/
      _layout.tsx                 Stack
      index.tsx                   Sectioned launcher
      events/
        [type].tsx                Generic event catch-all
        milk.tsx
        calf-feed.tsx
        animal-feed.tsx
        diagnosis.tsx
        calving.tsx
        dryoff.tsx
        movement.tsx
        pd.tsx
        service.tsx
      cases/new.tsx               NEW — case creation form
      sales/new.tsx
      culls/new.tsx
      success.tsx                 (was event-success.tsx)

    alerts/
      _layout.tsx                 Stack
      index.tsx                   Action queue
      cases.tsx                   Health cases list
      diagnoses.tsx               Diagnoses list
      animal/[id].tsx             -> <AnimalDetail id={…} />

    more/
      _layout.tsx                 Stack
      index.tsx                   Menu (drawer-style)
      settings.tsx
      reports/[type].tsx
      inventory/[type].tsx
      sales/index.tsx             Sales archive
      culls/index.tsx             Culls archive

components/
  screens/
    AnimalDetail.tsx              Shared screen body
```

## Concrete file moves

| From | To |
|---|---|
| `app/animal/[id].tsx` | split: body → `components/screens/AnimalDetail.tsx`; route → `app/(tabs)/animals/[id].tsx` + `app/(tabs)/alerts/animal/[id].tsx` |
| `app/herds/index.tsx` | `app/(tabs)/animals/herds/index.tsx` |
| `app/herds/[name].tsx` | `app/(tabs)/animals/herds/[name].tsx` |
| `app/cases.tsx` | `app/(tabs)/alerts/cases.tsx` |
| `app/diagnoses.tsx` | `app/(tabs)/alerts/diagnoses.tsx` |
| `app/events/*.tsx` (10 files) | `app/(tabs)/record/events/*.tsx` |
| `app/sales/new.tsx` | `app/(tabs)/record/sales/new.tsx` |
| `app/culls/new.tsx` | `app/(tabs)/record/culls/new.tsx` |
| `app/sales/index.tsx` | `app/(tabs)/more/sales/index.tsx` |
| `app/culls/index.tsx` | `app/(tabs)/more/culls/index.tsx` |
| `app/reports/[type].tsx` | `app/(tabs)/more/reports/[type].tsx` |
| `app/inventory/[type].tsx` | `app/(tabs)/more/inventory/[type].tsx` |
| `app/settings.tsx` | `app/(tabs)/more/settings.tsx` |
| `app/event-success.tsx` | `app/(tabs)/record/success.tsx` |
| `app/(tabs)/animals.tsx` | `app/(tabs)/animals/index.tsx` |
| `app/(tabs)/record.tsx` | `app/(tabs)/record/index.tsx` |
| `app/(tabs)/alerts.tsx` | `app/(tabs)/alerts/index.tsx` |
| `app/(tabs)/more.tsx` | `app/(tabs)/more/index.tsx` |

## New files

- `app/(tabs)/animals/_layout.tsx` — `<Stack screenOptions={{ headerShown: false }}>`
- `app/(tabs)/record/_layout.tsx` — same
- `app/(tabs)/alerts/_layout.tsx` — same
- `app/(tabs)/more/_layout.tsx` — same
- `app/(tabs)/record/cases/new.tsx` — case creation form (skeleton consistent with `sales/new.tsx` shape — animal picker + reason chips + notes; uses existing `Field`/`Picker`/`Button` components)
- `components/screens/AnimalDetail.tsx` — extracted from the current `app/animal/[id].tsx` body, exports `function AnimalDetail({ id }: { id: string })`

## Edits to existing files

### `app/_layout.tsx`
Delete all `<Stack.Screen name="..." />` entries except `(tabs)`. The flat-registration block (lines 16–29 of current file) becomes a single line.

### `app/(tabs)/_layout.tsx`
No structural change. Tab `name` props remain `index`, `animals`, `record`, `alerts`, `more` — the folder + `index.tsx` convention means each tab still resolves correctly to a single tab entry.

### `app/(tabs)/index.tsx` (Home)
- Delete `QUICK_ACTIONS` constant (lines 14–31).
- Delete the `<SectionTitle>Quick actions</SectionTitle>` + `<TileGrid>` block (lines 88–93).
- Keep Banner, top-row tiles, "Today's milk by herd", "Action queue · milk safety".
- Update the milk-by-herd row to be a `<Pressable>` pushing `/(tabs)/animals/herds/[name]`.
- Alert-row `onPress` already targets `/(tabs)/alerts` — leave as is (it lands on the alerts index; from there the user can drill into cases or diagnoses).

### `data/mock.ts` (`drawerStruct`)
- Delete the entire `Daily routine` group (3 items).
- Delete the entire `Animal events` group (13 items).
- Keep `Overview`, `Records`, `Reports`, `Inventory` groups.
- Update hrefs:
  - `Records` group: `/herds` → `/(tabs)/animals/herds`; `/diagnoses` → `/(tabs)/alerts/diagnoses`; `/cases` → `/(tabs)/alerts/cases`; `/sales` → `/(tabs)/more/sales`; `/culls` → `/(tabs)/more/culls`
  - `Reports` group: `/reports/<x>` → `/(tabs)/more/reports/<x>`
  - `Inventory` group: `/inventory/<x>` → `/(tabs)/more/inventory/<x>`
  - `Overview` items already target `/(tabs)` and `/(tabs)/alerts` — leave as is

### `app/(tabs)/record/index.tsx` (was `record.tsx`)
- Same content as current, but update every `href` in `SECTIONS`:
  - `/events/<x>` → `/(tabs)/record/events/<x>`
  - `/cases` (label "New health case") → `/(tabs)/record/cases/new`
  - `/sales/new` → `/(tabs)/record/sales/new`
  - `/culls/new` → `/(tabs)/record/culls/new`

### `app/(tabs)/alerts/cases.tsx`
The "New case" button (currently no `onPress`) gets `onPress={() => router.push('/(tabs)/record/cases/new')}`. No other changes.

### `app/(tabs)/alerts/diagnoses.tsx`
Update `router.push('/events/diagnosis')` → `router.push('/(tabs)/record/events/diagnosis')`.

### Any other intra-app `router.push` calls
Sweep all remaining `router.push('/...')` calls in the codebase and rewrite root-level paths to their new nested paths. Candidates to grep: `/animal/`, `/herds`, `/diagnoses`, `/cases`, `/sales`, `/culls`, `/events/`, `/reports/`, `/inventory/`, `/settings`, `/event-success`.

## Cross-tab navigation rules

| Source | Target | Resulting route |
|---|---|---|
| Animals list row | Animal detail | `/(tabs)/animals/[id]` (push in Animals) |
| Alerts cases row | Animal detail | `/(tabs)/alerts/animal/[id]` (push in Alerts) |
| Home alert preview | Alerts index | `/(tabs)/alerts` (tab switch, intentional) |
| Home milk-by-herd row | Herd detail | `/(tabs)/animals/herds/[name]` (tab switch, intentional) |
| More menu items | Their owner tab | tab switch (intentional — More is a directory) |
| Record event tile | Event form | `/(tabs)/record/events/<type>` (push in Record) |
| Event submit | success screen | `/(tabs)/record/success` (push in Record) |

The only intentional tab-switching is from Home (a dashboard) and from More (a directory). Within a feature tab (Animals, Record, Alerts), all navigation is push within the same stack.

## What we are explicitly NOT doing

- No modal sheets for shared detail screens. (Considered and rejected; chosen approach is per-tab nested routes with shared body components.)
- No global redesign of screen content, components, or theming.
- No backwards-compatible alias routes for old paths. The old paths are dead links after move; we update all internal callers in the same change.
- No migration of mock data shape.
- No new shared components beyond `AnimalDetail`. If future work needs to surface herd detail or another screen from a non-owning tab, the same pattern is followed at that time.

## Risks

1. **Missed `router.push` callsite.** A path-rewrite that misses an internal caller produces a broken link. Mitigation: full grep of `router.push(` and href literals before completion.
2. **Tab `name` resolution.** Expo Router resolves `<Tabs.Screen name="animals" />` to either `app/(tabs)/animals.tsx` or `app/(tabs)/animals/index.tsx`. After moving to the folder form, the existing tab layout file should continue to work unchanged. Verify on first run.
3. **Deep-link breakage.** External links (e.g. push notifications, if any exist in the future) targeting old paths would 404. None in the current codebase, so no immediate impact, but worth flagging when notification work begins.

## Open questions

None at design time. Implementation will surface any path-rewrite oversights.
