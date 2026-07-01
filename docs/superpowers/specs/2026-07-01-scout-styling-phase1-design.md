# Scout-styled Livestock — Phase 1 Design

Date: 2026-07-01
Status: Approved for spec review

## Goal

Bring the visual system of `upande-livestock-1` closer to the reference app
`Upande-Scout/upande_scout_rn`: larger fonts, a Scout-style login page,
Scout-style collapsible/tree navigation, and a theme (light + dark) built on
React Native Paper.

This is **Phase 1**: foundation + the highest-impact surfaces. Full dark-mode
migration of every screen is deferred to Phase 2.

## Context / constraints

- Current app loads Poppins in 4 weights and auto-maps `fontWeight` → the right
  Poppins face via a `Text.render` patch in `app/_layout.tsx`. Keep that patch.
- Current app uses a **static** `COLORS` object (`constants/theme.ts`) imported
  into ~40 screens; each screen bakes light values into `StyleSheet.create` at
  module-eval time. This is why full dark mode is broad — it is Phase 2.
- Reference app is built on `react-native-paper` with light/dark themes driven by
  `useColorScheme()`, Poppins fonts, and custom elevation levels.
- Assets already present: `home_bg.png`, `home_bg_d.png`,
  `upande_logo_no_bg.png`, `upande_logo_no_bg_d.png`. A `Banner.tsx` component
  already exists and will back the login banner.
- `react-native-paper` is NOT yet installed.

## Non-goals (Phase 1)

- Converting the ~40 content screens to dynamic theming (Phase 2).
- Porting Scout's animated role-cycling login button or role/SegmentedButton
  config dialog (Scout-specific auth logic, not wanted here).
- Any API/data changes.

## Design

### 1. Dependency + Paper theme

- Install `react-native-paper` (version compatible with Expo 54 / RN 0.81).
- New file `constants/paperTheme.ts`:
  - Base tokens: `INK #080808`, `PAPER #ffffff`, `GRAPHITE #2b2b2b`,
    `DIM #6e6e6e` (Scout values).
  - `poppinsFonts = configureFonts({ config: { fontFamily: "Poppins_400Regular" } })`.
  - `LIGHT_ELEVATION` / `DARK_ELEVATION` maps (Scout values).
  - `getPaperTheme(scheme: "light" | "dark" | null)` returning an MD3 theme:
    primary/onPrimary/background/surface/outline/etc. flipped by `dark`, with
    `danger` preserved as `#A32D2D` in the error slots.

### 2. Dynamic color palette + hook

- Extend `constants/theme.ts`: keep the existing `COLORS` export unchanged (so
  the ~40 unconverted screens keep compiling in Phase 2 order), and ADD:
  - `LIGHT` palette = current values.
  - `DARK` palette = inverted per Scout (bg `#080808`, text `#ffffff`,
    muted/subtle greys lightened, borders `#6e6e6e`), `danger` unchanged.
- New hook `src/hooks/useColors.ts`: `const scheme = useColorScheme();
  return scheme === "dark" ? DARK : LIGHT;` — same key shape as `COLORS` so
  components swap by replacing the import with the hook.

### 3. Bigger fonts (global `FONT` scale)

Update `constants/theme.ts` `FONT`:

| token   | old | new |
|---------|-----|-----|
| body    | 13  | 16  |
| card    | 14  | 16  |
| page    | 16  | 20  |
| meta    | 11  | 13  |
| label   | 11  | 13  |
| section | 11  | 13  |
| metric  | 22  | 28  |

Shared components that hardcode sizes (e.g. `Row` title 13/meta 11) are updated
to the new scale or to reference `FONT`. Screens that already use `FONT.*` pick
up larger text automatically.

### 4. Root wiring (`app/_layout.tsx`)

- Wrap the tree in `<PaperProvider theme={getPaperTheme(useColorScheme())}>`
  (inside `SafeAreaProvider`, outside `Stack`).
- `StatusBar style` becomes `useColorScheme() === "dark" ? "light" : "dark"`.
- `Stack.screenOptions.contentStyle.backgroundColor` and the font-loading
  fallback background read from the dynamic palette.
- Keep the Poppins `Text.render` patch and `useFonts` as-is.
- `app.json`: add `"userInterfaceStyle": "automatic"` to `expo`.

### 5. Theme-aware shared components

Convert these to resolve colors at render via `useColors()` and adopt the
larger `FONT` scale: `Button`, `TextInput`/`Field`, `Row`, `Screen`, `Avatar`,
`Card`. Pattern: move `StyleSheet.create` into the component body over the
resolved palette, or split static layout styles from dynamic color styles.
Result: every screen composed from these adapts to dark automatically.

### 6. Login page → Scout look (`app/(auth)/login.tsx`)

- Background image swaps by scheme: `home_bg.png` / `home_bg_d.png`.
- Logo: straight image swap by scheme — light mode `upande_logo_no_bg.png`,
  dark mode `upande_logo_no_bg_d.png` (both `200x200`). No white circle needed
  since a dark-optimized logo asset exists. Title 45px / lineHeight 52 /
  letterSpacing 1.
- Inputs: Paper `TextInput mode="outlined"` with `outlineStyle={{ borderRadius: 50 }}`,
  `outlineColor` = DIM, `activeOutlineColor` = INK/PAPER by scheme; password eye
  toggle via `TextInput.Icon`. Keep the three existing fields
  (instance URL + email + password) and existing `handleLogin` logic.
- Errors: replace the plain error `Text` with the semantic banner
  (reuse/extend `Banner.tsx`) using Scout banner colors
  (`error {bg #FDECEA, fg #B3261E}` light / `{bg #3A1714, fg #F2B8B5}` dark).
- Pill login button (existing `Button`, radius 50, height ~52).

### 7. Collapsibles / tree (`components/Collapsible.tsx` + Animals screen)

- New `components/Collapsible.tsx`: header row (rotating chevron 0°→90°,
  `defaultSemiBold` title), body indented `marginLeft: 24`, `useState` toggle,
  theme-aware via `useColors()`.
- Apply to the **Animals list grouped by herd**: render each herd as a
  Paper `List.Accordion` (or the new `Collapsible`) with the herd name + head
  count as the header and the animals (`AnimalRow`) as children. Preserve
  existing navigation on row press.

## Testing / verification

- App builds and launches (Expo) with no red-screen.
- Toggle device light/dark: login, tab bar, and shared-component screens flip
  palette; fonts are visibly larger.
- Login: inputs are pill outlined, eye toggle works, error surfaces as a banner,
  bg/logo swap by scheme.
- Animals screen: herds expand/collapse; tapping an animal still navigates.
- Lint passes (`npm run lint`).

## Phase 2 (out of scope here)

Migrate remaining content screens from `COLORS` → `useColors()` for complete
dark mode, screen by screen.
