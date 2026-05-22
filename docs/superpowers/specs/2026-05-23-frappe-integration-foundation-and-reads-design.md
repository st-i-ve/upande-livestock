# Frappe integration — Sub-project #1: Foundation + read paths

**Date:** 2026-05-23
**Author:** james@upande.com (with Claude)
**Status:** Design — pending user review

---

## 1. Background

The Upande Livestock app (Expo / React Native, expo-router) currently runs entirely off mock data in `data/mock.ts` with a fake login that simply navigates to `/(tabs)` after a 300 ms timeout. The Westwood Dairies (WDL) Frappe site at `upande-kaitet2.c.frappe.cloud` already hosts the production schema and server scripts that back the livestock module (see `references/livestock_server_scripts.md`).

We want the app to talk to that Frappe site for both reads and writes. The full integration was scoped into three sub-projects during brainstorming; this spec covers **only the first**:

1. **Foundation + reads** (this spec) — auth + API client + storage; replace mock data on every reasonably-mappable read screen.
2. Online writes (Animal Event, Milk Recording, Animal Disposal, Animal create) — separate spec.
3. Offline queue + sync — separate spec, layered on top of #2.

Sub-projects #2 and #3 are **out of scope** for this document.

## 2. Goals

- App launches into a real login screen backed by `/api/method/login` on a configurable Frappe instance.
- Authenticated session (cookie + `sid`) persists across app restarts; expiry routes the user back to login.
- Every reasonably-mappable read screen renders live data from Frappe (animals list, animal detail, herds, today's milk by herd, safety alerts derived from those).
- Mock data is fully removed for the migrated screens; the rest stays on mock and is explicitly listed as out-of-scope.
- Loading and error states are uniform across migrated screens.

## 3. Non-goals

- No write paths (`Animal Event`, `Milk Recording`, `Animal Disposal`, `Animal` create) — sub-project #2.
- No offline writes / queue / sync — sub-project #3.
- No realtime updates or polling beyond pull-to-refresh.
- No renaming of UI types to Frappe field names — a mapper layer absorbs the gap.
- No automated tests; manual verification only (per decision in §10).
- No multi-tenant role separation; one app, one user, one Frappe site at a time.

## 4. Fixed decisions (locked during brainstorming)

| Decision | Choice | Reason |
|---|---|---|
| Auth mechanism | Cookie / `sid` (Frappe session login) | Matches Upande-Scout; one less credential to manage per user. The `Authorization: token` style in the server-scripts doc is **not** used. |
| Instance URL | Scout-style configurable, hidden behind long-press dev modal | Lets the app point at staging / other tenants without rebuilding. Default: `https://upande-kaitet2.c.frappe.cloud`. |
| Data mapping | Mapper layer (UI types stay shorthand) | Faster, zero UI regressions, keeps the screens unchanged. |
| Data fetching | React Query (TanStack Query) | Per-query caching, dedupe, retry, focus refetch — the read surface is broad enough to warrant it. |
| Layer style | Co-located query hooks per domain | Each domain has one obvious home; React Query keeps loading/error uniform. |
| Testing | Manual verification only | Project has no test runner today; adding one is its own scope decision. |

## 5. Architecture & file layout

```
src/
  services/
    storage.ts          AsyncStorage wrapper, STORAGE_KEYS const
    api.ts              Axios client factory (cookie/sid headers, logging, extractFrappeError)
    queryClient.ts      Single React Query QueryClient with project defaults
  auth/
    authStore.ts        Zustand: isAuthenticated, instanceUrl, fullname, checkAuth(), login(), logout()
  frappe/
    animal.ts           getAnimals(), getAnimal(id) + Animal mapper, ANIMAL_LIST_FIELDS
    herd.ts             getHerds() + Herd mapper, HERD_LIST_FIELDS
    milkRecording.ts    getMilkRecordingsForDate() + DailyMilkRow mapper
    alerts.ts           buildSafetyAlerts(animals, milkRows) — pure derived state
  hooks/
    useAnimals.ts, useAnimal.ts, useHerds.ts, useTodaysMilk.ts, useSafetyAlerts.ts
components/
  Loader.tsx            new — centered ActivityIndicator
  ErrorState.tsx        new — error card with retry button
```

- `data/mock.ts` stays in place during migration. The closing commit of this sub-project deletes it (and any re-exports).
- The query client and the auth store are both wired into the root `app/_layout.tsx`.
- Existing UI primitives (`Screen`, `Row`, `Banner`, `Avatar`, `Chips`, `Empty`) are unchanged.
- The route group structure (`(auth)` / `(tabs)`) is unchanged.

**New dependencies:**

- `axios` (network client)
- `@tanstack/react-query` (data fetching)
- `zustand` (auth state)
- `@react-native-async-storage/async-storage` (cookie/url persistence)

## 6. Auth flow & session lifecycle

### Login

`app/(auth)/login.tsx` keeps its current visual design. `handleLogin` is rewired to call `authStore.login(email, password)`.

The instance URL field is hidden by default; long-press on the logo opens a small dev dialog exposing it. The URL defaults to `https://upande-kaitet2.c.frappe.cloud` and is stored under `STORAGE_KEYS.INSTANCE_URL`. A backup copy is kept under `STORAGE_KEYS.INSTANCE_URL_BACKUP` so logout doesn't force the user to retype it.

### Login call (`src/services/api.ts → api.login`)

1. Normalize URL — strip trailing slashes; prepend `https://` if no protocol; HEAD-probe HTTPS (5 s timeout); fall back to HTTP only if HTTPS fails.
2. Persist normalized URL to `STORAGE_KEYS.INSTANCE_URL`.
3. `POST {url}/api/method/login` with body `usr=...&pwd=...` (`application/x-www-form-urlencoded`).
4. Parse `Set-Cookie` header. Store the full cookie string under `STORAGE_KEYS.COOKIE` and extract `sid` separately under `STORAGE_KEYS.SID`. Also extract `full_name` (→ `STORAGE_KEYS.FULLNAME`) and persist the submitted email under `STORAGE_KEYS.EMAIL` for the home banner and login-form prefill on next launch.
5. On success → `router.replace('/(tabs)')`. On failure → surface `extractFrappeError(err)`.

### Auth gate

`app/_layout.tsx` calls `useAuthStore.checkAuth()` on mount.

- Cookie present → `isAuthenticated = true` → land on `/(tabs)`.
- Cookie absent → `/(auth)/login`.
- While checking → centered `<Loader />`.

This replaces the current `unstable_settings = { anchor: '(auth)' }` always-start-at-login behavior.

### Session expiry

Axios response interceptor in `getClient()` watches for:

- HTTP `401` / `403`
- Frappe `CSRFTokenError` exception string in `response.data.exc`

On any of these:

1. Clear cookie + `sid` (keep `INSTANCE_URL`).
2. `authStore.set({ isAuthenticated: false })`.
3. `queryClient.clear()`.
4. Route to `/(auth)/login` with a toast: "Session expired, please log in again."

### Logout

`app/(tabs)/profile/index.tsx` already has a logout entry point. `authStore.logout()`:

1. Best-effort `POST /api/method/logout`.
2. Clear `COOKIE`, `SID`, `FULLNAME`, `EMAIL` (keep `INSTANCE_URL`, `INSTANCE_URL_BACKUP`).
3. `queryClient.clear()`.
4. `router.replace('/(auth)/login')`.

### Storage keys

```ts
COOKIE, SID, INSTANCE_URL, INSTANCE_URL_BACKUP, EMAIL, FULLNAME
```

## 7. API client

`src/services/api.ts` exports `getClient()` returning a fresh `axios` instance per call:

```
baseURL = stored INSTANCE_URL
headers = {
  'Content-Type': 'application/json',
  Cookie:         <stored cookie string>,
  sid:            <stored sid>,
  'X-Frappe-CSRF-Token': <extracted from cookie 'csrf_token' segment, if present>,
}
timeout = 15_000
+ request/response logging interceptor (mirrors Scout's attachLogging)
+ response interceptor handling 401/403/CSRFTokenError → auth flow above
```

### Frappe endpoint conventions

| Need | Endpoint | Notes |
|---|---|---|
| List a DocType | `GET /api/resource/{DocType}` | `params: { fields: JSON.stringify([...]), filters: JSON.stringify([...]), limit: 1000, order_by: '...' }` |
| Single doc with child tables | `GET /api/resource/{DocType}/{name}` | Child tables returned inline (e.g. `weight_history` on `Animal`). |
| Settings single value | `GET /api/method/frappe.client.get_single_value` | Used sparingly; prefer one bulk fetch. |

`fields` must always be specified — Frappe's default is `['name']`. The mapper layer documents which fields each domain needs.

### Error extraction

Shared helper `extractFrappeError(err)` reads in order:

1. `err.response.data._server_messages` (JSON-decoded twice — Frappe wraps each message in JSON inside a JSON string array).
2. `err.response.data.exception`
3. `err.response.data.message`
4. `err.message`

Returns a single user-readable string.

## 8. Domain layer

### Animal (`src/frappe/animal.ts`)

**Fields requested:**

```ts
ANIMAL_LIST_FIELDS = [
  'name', 'burn_name', 'sex', 'date_of_birth', 'current_herd', 'repro_status',
  'days_in_milk', 'parity', 'last_weight_kg', 'milk_safe_date', 'in_treatment',
]
```

**Mapper:**

```ts
mapAnimal(row): Animal = {
  id:          row.name,
  name:        row.burn_name ?? row.name,
  sex:         row.sex === 'Male' ? 'M' : 'F',
  dob:         row.date_of_birth ?? '',
  herd:        row.current_herd ?? '',
  repro:       row.repro_status ?? '',
  dim:         row.days_in_milk ?? null,
  parity:      row.parity ?? 0,
  lastWt:      row.last_weight_kg ?? 0,
  milkSafe:    row.milk_safe_date ?? null,
  inTreatment: row.in_treatment ? 1 : 0,
  pregnant:    (row.repro_status ?? '').toLowerCase().includes('pregnant') ? 1 : 0,
}
```

**Fetchers:**

- `getAnimals(): Promise<Animal[]>` → `/api/resource/Animal?fields=...&limit=1000&order_by=name asc`
- `getAnimal(id): Promise<Animal & { weightHistory: ... }>` → `/api/resource/Animal/{id}` (child tables come inline).

### Herd (`src/frappe/herd.ts`)

```ts
HERD_LIST_FIELDS = ['name', 'category', 'head_count', 'cost_center', 'bom']
mapHerd(row): Herd = {
  n: row.name, cat: row.category, cnt: row.head_count,
  cc: row.cost_center, bom: row.bom,
  ration: [], kgPerHeadPerDay: 0,
}
```

**Known gap:** `ration` and `kgPerHeadPerDay` are not on the `Herds` DocType per the server-scripts doc. The mapper returns empty/zero; UI tolerates these (renders "—" or hides the ration section). When these fields are added in Frappe, the mapper is updated in place.

### Milk Recording (`src/frappe/milkRecording.ts`)

```ts
getMilkRecordingsForDate(date): Promise<MilkRow[]>
  → /api/resource/Milk Recording
     filters: [['recording_date','=', date], ['docstatus','=', 1]]
     fields:  ['name','herd','session','net_yield_kg','cows_milked','recording_date']

mapTodaysMilkByHerd(rows, herds): DailyMilkRow[]
  group by herd → for each herd produce { herd, cnt: herd.cnt, am, pm, expected }
  am  = sum of net_yield_kg where session contains 'AM'
  pm  = sum of net_yield_kg where session contains 'PM'
  expected = herd.cnt * herd.kgPerHeadPerDay   (until field exists, computes to 0 → UI shows "—")
```

### Safety alerts (`src/frappe/alerts.ts`)

Pure derived state, no Frappe call of its own:

```ts
buildSafetyAlerts(animals: Animal[], todaysMilk: DailyMilkRow[]): Alert[]
  - For each animal with milkSafe >= today           → danger row "{name} in withdrawal"
  - For each animal in_treatment && repro fresh      → "Colostrum present in fresh cow"
  - For each milk row with am === null               → "AM milking not recorded · {herd} · {cnt} cows"
  - For each milk row with pm === null               → "PM milking pending"
```

## 9. Hook layer

Each hook is a thin React Query wrapper. Stale times are set per-domain.

```ts
useAnimals       = ()   => useQuery({ queryKey: ['animals'],          queryFn: getAnimals,             staleTime: 60_000 })
useAnimal        = (id) => useQuery({ queryKey: ['animal', id],       queryFn: () => getAnimal(id),    staleTime: 30_000 })
useHerds         = ()   => useQuery({ queryKey: ['herds'],            queryFn: getHerds,               staleTime: 5 * 60_000 })
useTodaysMilk    = ()   => useQuery({ queryKey: ['milk', 'today'],    queryFn: () => getMilkRecordingsForDate(today()) })
useSafetyAlerts  = ()   => {
  const a = useAnimals()
  const m = useTodaysMilk()
  return useMemo(() => buildSafetyAlerts(a.data ?? [], m.data ?? []), [a.data, m.data])
}
```

## 10. Screen migration

### Recipe (applied per screen)

```tsx
// before
import { animals } from "@/data/mock"
const list = animals.filter(...)

// after
import { useAnimals } from "@/hooks/useAnimals"
const { data: animals = [], isLoading, error, refetch } = useAnimals()
if (isLoading) return <Loader />
if (error)     return <ErrorState text={extractFrappeError(error)} onRetry={refetch} />
const list = animals.filter(...)
```

### New shared components

- `<Loader />` — centered `ActivityIndicator` matching `_layout.tsx`.
- `<ErrorState text onRetry />` — short tone-aligned card, used wherever a query fails.

### Migration order (one screen per commit)

1. `app/(tabs)/animals/index.tsx` — list of animals.
2. `app/(tabs)/animals/[id].tsx` — single animal detail (including `weight_history`).
3. `app/(tabs)/animals/herds/[id].tsx` — herd detail.
4. `app/(tabs)/index.tsx` — home (uses `useTodaysMilk`, `useSafetyAlerts`, `useHerds`).
5. `app/(tabs)/alerts/*` — already reads from the same source as the home banner.
6. **Closing commit:** delete `data/mock.ts`, remove `homeAlerts` / `allAlerts` re-exports, run typecheck (`tsc --noEmit`).

### Explicitly out of scope for this sub-project (stay on mock)

- All screens under `app/(tabs)/record/*` — these are the write paths, owned by sub-project #2.
- Drawer reports — milk yield, reproduction, health, growth (need server-script endpoints we don't have yet).
- Inventory screens (colostrum bank, drugs, semen straws, feed).
- Sales archive, culls archive (read from `Sales Invoice` / `Animal Disposal`; deferred unless trivial).

If any of the above gets migrated opportunistically in this sub-project, that's fine — but they are not required.

## 11. Errors & edge cases

| Case | Handling |
|---|---|
| Empty cookie at startup | Auth gate routes to login. |
| Stale cookie (server restart, 401) | Response interceptor catches, kicks to login with toast. |
| Frappe field null | Mappers default to `null` / `0` / `''`. UI already tolerates these. |
| DocType field missing in current schema | Mapper returns type-correct default; UI renders "—". Listed in §13. |
| Slow network | 15 s timeout, React Query default 3-retry policy. Home screen runs three parallel queries (animals, herds, milk) — React Query dedupes and renders progressively. |
| Wrong instance URL | HEAD probe at login surfaces a network error before `/login` call; form shows "Could not connect to server." |
| Per-row mapping failure | Mapper wraps each row in a try/catch; on failure log + skip; list still renders the remaining rows. |
| User on flaky connection mid-session | React Query refetches on focus by default — when the network comes back, screens refresh themselves. |

**Not handled here (left to later sub-projects):**

- Offline reads beyond React Query's in-memory cache.
- Concurrent edits from the Frappe web UI (no realtime, no polling).
- Conflict resolution for parallel writes.

## 12. Verification checklist (manual)

To be run on `upande-kaitet2.c.frappe.cloud` with a real account before merging:

- [ ] Fresh install → app lands on login screen (no auto-bypass).
- [ ] Empty fields → login button shows a clear error.
- [ ] Wrong password → Frappe error surfaces, no navigation.
- [ ] Correct credentials → land on `/(tabs)` home; banner shows real `full_name`.
- [ ] Kill app, reopen → auth gate restores the session, lands on `/(tabs)`.
- [ ] Long-press logo on login → dev dialog appears, URL field is editable, saved value persists.
- [ ] Home screen — today's milk by herd reflects what's submitted in Frappe today.
- [ ] Home screen — safety alerts reflect real animals in withdrawal and missed milkings.
- [ ] Animals list — count and contents match Frappe; search and filter chips work; tap row → detail screen loads.
- [ ] Animal detail — fields populate from Frappe; weight history child table renders.
- [ ] Herd detail — heads count and cost centre match Frappe.
- [ ] Force-expire the session in Frappe (delete the cookie / restart server) → next interaction routes to login with toast.
- [ ] Logout from profile → cookie cleared, lands on login, query cache empty.
- [ ] Re-login → `INSTANCE_URL` survives; user only retypes email + password.
- [ ] Pull-to-refresh on home and animals list re-queries Frappe.
- [ ] Airplane mode → loading state → `<ErrorState>` with retry button; back online + retry → data renders.

## 13. Known gaps in Frappe schema (out of scope to fix here)

Surfaced for follow-up:

- `Herds.ration` (child table or text) — not in schema; mapper returns `[]`.
- `Herds.kg_per_head_per_day` — not in schema; mapper returns `0`.
- No `Open Cases` count source — the home "Open cases" tile currently hard-codes `3`. For this sub-project we leave it hard-coded; a follow-up will wire it once we know the source (probably an Animal Event / health-case DocType filter).

These are flagged here so they aren't silently lost.

## 14. Dependencies added

```
axios
@tanstack/react-query
zustand
@react-native-async-storage/async-storage
```

All are widely used, actively maintained, and used by the Upande-Scout sibling app — keeping conventions consistent across the two apps.

## 15. Follow-up sub-projects

- **#2 — Online writes** (Animal Event for 9 event types, Milk Recording, Animal Disposal, Animal create) using the same client + auth from this sub-project, with the create→submit two-step described in the server-scripts doc.
- **#3 — Offline queue + sync** on top of #2: persistent queue, retry, idempotency keys, surfaced conflict states.

---

*End of design.*
