import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PillButton } from "@/components/PillButton";
import { font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import {
  MONTHS,
  WEEKDAYS,
  clampDay,
  isDayDisabled,
  isMonthDisabled,
  isTimeDisabled,
  longLabel,
  monthGrid,
  quickChips,
  sameDay,
  shortLabel,
  addMonths,
  withTimeOf,
  yearRange,
  type YM,
} from "@/src/ui/calendar";
import { resolveDismissed, resolvePicked, useDatePicker, type PickerRequest } from "@/src/ui/datetimepicker";

const IN_MS = 240;
const OUT_MS = 170;
const EASE = Easing.inOut(Easing.cubic);

type Page = "days" | "years" | "months" | "time";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Draws every date and time picker (src/ui/datetimepicker.ts): rendered once,
 * at the root. A bottom sheet over a dimmed backdrop — the month as a Monday-
 * first grid (today ringed, the chosen day a filled pill, days outside the
 * allowed range greyed and not tappable), the month title opening a year list
 * then a month list, Today/Yesterday when allowed, Cancel and OK. Time mode:
 * hour and minute grids. Slides up (reduce motion: fades).
 */
export function DatePickerHost() {
  const req = useDatePicker((s) => s.request);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const closing = useRef<number | null>(null);

  useEffect(() => {
    if (!req) return;
    closing.current = null;
    progress.set(0);
    progress.set(withTiming(1, { duration: reduceMotion ? 150 : IN_MS, easing: EASE }));
    // A new request (not the same one with fresh callbacks) eases in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req?.id, progress, reduceMotion]);

  const close = useCallback(
    (then: (r: PickerRequest) => void) => {
      const r = useDatePicker.getState().request;
      if (!r || closing.current === r.id) return;
      closing.current = r.id;
      progress.set(withTiming(0, { duration: OUT_MS, easing: EASE }));
      // The request stays (and the sheet drawn) while it eases out; resolving
      // it clears it, then calls back with the store's latest callbacks.
      setTimeout(() => then(useDatePicker.getState().request?.id === r.id ? useDatePicker.getState().request! : r), OUT_MS);
    },
    [progress],
  );

  const cancel = useCallback(() => close(resolveDismissed), [close]);
  const ok = useCallback((d: Date) => close((r) => resolvePicked(r, d)), [close]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheet = useAnimatedStyle(() =>
    reduceMotion ? { opacity: progress.value } : { opacity: Math.min(1, progress.value * 2), transform: [{ translateY: (1 - progress.value) * 420 }] },
  );

  if (!req) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={cancel}>
      <View style={s.fill}>
        <Animated.View style={[s.fill, s.dim, backdrop]}>
          <Pressable style={s.fill} onPress={cancel} accessible={false} importantForAccessibility="no" />
        </Animated.View>
        <Animated.View style={[s.bottom, sheet]}>
          <PickerSheet key={req.id} req={req} onCancel={cancel} onOk={ok} />
        </Animated.View>
      </View>
    </Modal>
  );
}

/** The sheet's content: a self-contained picker for one request. */
export function PickerSheet({ req, onCancel, onOk, now }: { req: PickerRequest; onCancel: () => void; onOk: (d: Date) => void; now?: Date }) {
  const c = useColors();
  const st = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const mode = req.mode ?? "date";
  const timeOnly = mode === "time" || mode === "countdown";
  const min = req.minimumDate ?? null;
  const max = req.maximumDate ?? null;
  const today = useMemo(() => now ?? new Date(), [now]);

  const [picked, setPicked] = useState<Date>(() => (timeOnly ? new Date(req.value.getTime()) : clampDay(req.value, min, max)));
  const [view, setView] = useState<YM>(() => ({ year: picked.getFullYear(), month: picked.getMonth() }));
  const [page, setPage] = useState<Page>(timeOnly ? "time" : "days");

  const choose = (d: Date) => {
    setPicked(withTimeOf(d, picked));
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  const prev = addMonths(view, -1);
  const next = addMonths(view, 1);
  const prevOff = isMonthDisabled(prev, min, max);
  const nextOff = isMonthDisabled(next, min, max);
  const title = `${MONTHS[view.month]} ${view.year}`;
  const chips = timeOnly ? [] : quickChips(today, min, max);
  const okDisabled = timeOnly ? isTimeDisabled(picked, min, max) : isDayDisabled(picked, min, max);

  return (
    <View
      style={[st.sheet, { paddingBottom: 16 + insets.bottom }]}
      accessibilityViewIsModal
      aria-modal
      role="dialog"
      testID="date-picker-sheet"
    >
      <View style={st.handle} />
      <Text style={st.caption}>{req.title || (timeOnly ? "Choose a time" : "Choose a date")}</Text>
      <Text style={st.heading} accessibilityRole="header" accessibilityLiveRegion="polite">
        {timeOnly ? hhmm(picked) : mode === "datetime" ? `${shortLabel(picked)} · ${hhmm(picked)}` : shortLabel(picked)}
      </Text>

      {mode === "datetime" ? (
        <View style={st.chipRow}>
          <SmallChip label="Date" active={page !== "time"} onPress={() => setPage("days")} st={st} />
          <SmallChip label="Time" active={page === "time"} onPress={() => setPage("time")} st={st} />
        </View>
      ) : null}

      {page === "days" ? (
        <>
          <View style={st.navRow}>
            <Pressable
              onPress={() => setPage("years")}
              accessibilityRole="button"
              accessibilityLabel={`${title}. Choose month and year`}
              hitSlop={6}
              style={({ pressed }) => [st.titleBtn, pressed && { backgroundColor: c.bgMuted }]}
              testID="date-picker-title"
            >
              <Text style={st.title}>{title}</Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color={c.text} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <IconBtn icon="chevron-left" label="Previous month" disabled={prevOff} onPress={() => setView(prev)} st={st} c={c} testID="date-picker-prev" />
            <IconBtn icon="chevron-right" label="Next month" disabled={nextOff} onPress={() => setView(next)} st={st} c={c} testID="date-picker-next" />
          </View>
          <View style={st.week} importantForAccessibility="no-hide-descendants">
            {WEEKDAYS.map((w) => (
              <Text key={w} style={st.weekday}>
                {w.slice(0, 2)}
              </Text>
            ))}
          </View>
          {monthGrid(view).map((week, wi) => (
            <View key={wi} style={st.week}>
              {week.map(({ date, inMonth }) => {
                const off = isDayDisabled(date, min, max);
                const sel = sameDay(date, picked);
                const isToday = sameDay(date, today);
                return (
                  <Pressable
                    key={date.getTime()}
                    onPress={off ? undefined : () => choose(date)}
                    accessibilityRole="button"
                    accessibilityLabel={`${longLabel(date)}${isToday ? ", today" : ""}${off ? ", not available" : ""}`}
                    accessibilityState={{ selected: sel, disabled: off }}
                    style={st.cell}
                    testID={`day-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`}
                  >
                    {({ pressed }) => (
                      <View
                        style={[
                          st.dot,
                          isToday && !sel && st.todayRing,
                          sel && st.selectedDot,
                          pressed && !sel && { backgroundColor: c.bgMuted },
                        ]}
                      >
                        <Text
                          style={[
                            st.dayText,
                            !inMonth && { color: c.textSubtle },
                            isToday && font("700"),
                            sel && { color: c.bg, ...font("700") },
                            off && st.offText,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
          {chips.length > 0 ? (
            <View style={st.chipRow}>
              {chips.map((ch) => (
                <SmallChip key={ch.label} label={ch.label} active={sameDay(ch.date, picked)} onPress={() => choose(ch.date)} st={st} />
              ))}
            </View>
          ) : null}
        </>
      ) : page === "years" ? (
        <YearList req={req} picked={picked} view={view} today={today} st={st} c={c} onPick={(y) => { setView({ year: y, month: view.month }); setPage("months"); }} />
      ) : page === "months" ? (
        <>
          <View style={st.navRow}>
            <Pressable
              onPress={() => setPage("years")}
              accessibilityRole="button"
              accessibilityLabel={`${view.year}. Choose another year`}
              style={({ pressed }) => [st.titleBtn, pressed && { backgroundColor: c.bgMuted }]}
            >
              <MaterialCommunityIcons name="chevron-left" size={20} color={c.text} />
              <Text style={st.title}>{view.year}</Text>
            </Pressable>
          </View>
          <View style={st.grid}>
            {MONTHS.map((m, i) => {
              const off = isMonthDisabled({ year: view.year, month: i }, min, max);
              const sel = picked.getFullYear() === view.year && picked.getMonth() === i;
              return (
                <Pressable
                  key={m}
                  onPress={off ? undefined : () => { setView({ year: view.year, month: i }); setPage("days"); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${m} ${view.year}${off ? ", not available" : ""}`}
                  accessibilityState={{ selected: sel, disabled: off }}
                  style={({ pressed }) => [st.gridCell, { width: "33.333%" }, pressed && !off && { opacity: 0.7 }]}
                  testID={`month-${i}`}
                >
                  <View style={[st.gridPill, sel && st.selectedDot]}>
                    <Text style={[st.gridText, sel && { color: c.bg, ...font("700") }, off && st.offText]}>{m.slice(0, 3)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <TimeGrid picked={picked} min={min} max={max} interval={typeof req.minuteInterval === "number" && req.minuteInterval > 0 ? req.minuteInterval : 5} st={st} c={c} onPick={setPicked} />
      )}

      <View style={st.actions}>
        <PillButton label={req.negativeButton?.label || "Cancel"} variant="secondary" onPress={onCancel} style={st.actionBtn} testID="date-picker-cancel" />
        <PillButton label={req.positiveButton?.label || "OK"} onPress={() => onOk(picked)} disabled={okDisabled} style={st.actionBtn} testID="date-picker-ok" />
      </View>
    </View>
  );
}

type St = ReturnType<typeof makeStyles>;
type C = ReturnType<typeof useColors>;

function SmallChip({ label, active, onPress, st }: { label: string; active: boolean; onPress: () => void; st: St }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [st.chip, active && st.chipActive, pressed && { opacity: 0.7 }]}
      testID={`date-picker-chip-${label}`}
    >
      <Text style={[st.chipText, active && st.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function IconBtn({ icon, label, disabled, onPress, st, c, testID }: { icon: "chevron-left" | "chevron-right"; label: string; disabled: boolean; onPress: () => void; st: St; c: C; testID: string }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed }) => [st.iconBtn, pressed && !disabled && { backgroundColor: c.bgMuted }, disabled && { opacity: 0.3 }]}
      testID={testID}
    >
      <MaterialCommunityIcons name={icon} size={24} color={c.text} />
    </Pressable>
  );
}

const YEAR_ROW = 52;

function YearList({ req, picked, view, today, st, c, onPick }: { req: PickerRequest; picked: Date; view: YM; today: Date; st: St; c: C; onPick: (y: number) => void }) {
  const years = yearRange(picked, today, req.minimumDate, req.maximumDate);
  const at = Math.max(0, years.indexOf(view.year));
  return (
    <ScrollView style={st.yearScroll} contentOffset={{ x: 0, y: Math.max(0, Math.floor(at / 4) - 1) * YEAR_ROW }}>
      <View style={st.grid}>
        {years.map((y) => {
          const sel = y === picked.getFullYear();
          return (
            <Pressable
              key={y}
              onPress={() => onPick(y)}
              accessibilityRole="button"
              accessibilityLabel={String(y)}
              accessibilityState={{ selected: sel }}
              style={({ pressed }) => [st.gridCell, { width: "25%", height: YEAR_ROW }, pressed && { opacity: 0.7 }]}
              testID={`year-${y}`}
            >
              <View style={[st.gridPill, sel && st.selectedDot, y === today.getFullYear() && !sel && st.todayRing]}>
                <Text style={[st.gridText, sel && { color: c.bg, ...font("700") }]}>{y}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function TimeGrid({ picked, min, max, interval, st, c, onPick }: { picked: Date; min: Date | null; max: Date | null; interval: number; st: St; c: C; onPick: (d: Date) => void }) {
  const at = (h: number, m: number) => new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), h, m);
  const minutes: number[] = [];
  for (let m = 0; m < 60; m += interval) minutes.push(m);
  const cell = (label: string, sel: boolean, off: boolean, onPress: () => void, a11y: string, width: string, key: string) => (
    <Pressable
      key={key}
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={`${a11y}${off ? ", not available" : ""}`}
      accessibilityState={{ selected: sel, disabled: off }}
      style={({ pressed }) => [st.gridCell, { width: width as `${number}%` }, pressed && !off && { opacity: 0.7 }]}
      testID={key}
    >
      <View style={[st.gridPill, sel && st.selectedDot]}>
        <Text style={[st.gridText, sel && { color: c.bg, ...font("700") }, off && st.offText]}>{label}</Text>
      </View>
    </Pressable>
  );
  // Whole hours are off only when every minute in them is.
  const hourOff = (h: number) => minutes.every((m) => isTimeDisabled(at(h, m), min, max));
  return (
    <View>
      <Text style={st.section}>Hour</Text>
      <View style={st.grid}>
        {Array.from({ length: 24 }, (_, h) =>
          cell(pad(h), picked.getHours() === h, hourOff(h), () => onPick(at(h, picked.getMinutes())), `${h} hours`, "16.666%", `hour-${h}`),
        )}
      </View>
      <Text style={st.section}>Minute</Text>
      <View style={st.grid}>
        {minutes.map((m) =>
          cell(pad(m), picked.getMinutes() === m, isTimeDisabled(at(picked.getHours(), m), min, max), () => onPick(at(picked.getHours(), m)), `${m} minutes`, "16.666%", `minute-${m}`),
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  dim: { backgroundColor: "rgba(0,0,0,0.5)" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" },
});

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    sheet: {
      width: "100%",
      maxWidth: 520,
      backgroundColor: c.bg,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
      paddingHorizontal: 16,
      paddingTop: 8,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: -4 },
      elevation: 16,
    },
    handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 10 },
    caption: { fontSize: 13, color: c.textMuted, paddingHorizontal: 4 },
    heading: { fontSize: 22, ...font("600"), color: c.text, paddingHorizontal: 4, marginTop: 2, marginBottom: 8 },
    navRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
    titleBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999 },
    title: { fontSize: 16, ...font("600"), color: c.text },
    iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    week: { flexDirection: "row" },
    weekday: { flex: 1, textAlign: "center", fontSize: 12, color: c.textMuted, paddingVertical: 6, ...font("600") },
    cell: { flex: 1, height: 46, alignItems: "center", justifyContent: "center" },
    dot: { minWidth: 40, height: 40, paddingHorizontal: 4, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    todayRing: { borderWidth: 1.5, borderColor: c.text },
    selectedDot: { backgroundColor: c.text },
    dayText: { fontSize: 15, color: c.text },
    offText: { color: c.textSubtle, opacity: 0.45, textDecorationLine: "line-through" },
    chipRow: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 2, paddingHorizontal: 4 },
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: c.bgMuted, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    chipActive: { backgroundColor: c.text, borderColor: c.text },
    chipText: { fontSize: 13, color: c.text, ...font("500") },
    chipTextActive: { color: c.bg, ...font("600") },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    gridCell: { height: 50, alignItems: "center", justifyContent: "center" },
    gridPill: { minWidth: 48, height: 40, paddingHorizontal: 8, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    gridText: { fontSize: 15, color: c.text },
    yearScroll: { maxHeight: 6 * YEAR_ROW },
    section: { fontSize: 12, color: c.textMuted, ...font("600"), marginTop: 6, marginBottom: 2, paddingHorizontal: 4 },
    actions: { flexDirection: "row", gap: 10, marginTop: 14 },
    actionBtn: { flex: 1 },
  });
