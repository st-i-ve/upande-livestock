import { useEffect, useState } from "react";
import { create } from "zustand";

import { sameDay } from "@/src/ui/calendar";

/**
 * The app's own date/time picker, with the API of
 * `@react-native-community/datetimepicker`, so a screen written for the native
 * one works unchanged once its import points here:
 *
 *   import DateTimePicker, { DateTimePickerAndroid } from "@/src/ui/datetimepicker";
 *
 * Drawn by components/DatePickerHost.tsx (mounted once in app/_layout.tsx) as a
 * themed bottom sheet instead of Android's dialog. As on Android:
 * - the component opens the picker while it is mounted and closes it when it
 *   unmounts; it renders nothing in place;
 * - OK: `onValueChange(event, date)` when given, else
 *   `onChange({type:'set', nativeEvent:{timestamp, utcOffset}}, date)`;
 * - Cancel / back / backdrop: `onDismiss()` when given, else
 *   `onChange({type:'dismissed', nativeEvent:{timestamp, utcOffset}}, value)`
 *   with the value it opened with;
 * - `DateTimePickerAndroid.open(params)` / `.dismiss(mode)` do the same without
 *   a component.
 *
 * The native module is not imported anywhere (__tests__/noNativePickers.test.ts).
 */

export type EvtTypes = "set" | "neutralButtonPressed" | "dismissed";
export type DateTimePickerEvent = {
  type: EvtTypes;
  nativeEvent: { timestamp: number; utcOffset: number };
};
export type PickerMode = "date" | "time" | "datetime" | "countdown";

export type PickerParams = {
  value: Date;
  mode?: PickerMode;
  minimumDate?: Date | null;
  maximumDate?: Date | null;
  is24Hour?: boolean;
  minuteInterval?: number;
  title?: string;
  /** Accepted for compatibility; the sheet follows the app's theme. */
  display?: string;
  themeVariant?: "light" | "dark";
  accentColor?: string;
  textColor?: string;
  design?: string;
  testID?: string;
  positiveButton?: { label?: string };
  negativeButton?: { label?: string };
  onChange?: (event: DateTimePickerEvent, date?: Date) => void;
  onValueChange?: (event: DateTimePickerEvent, date: Date) => void;
  onDismiss?: () => void;
  // Anything else the native API takes is accepted and ignored.
  [other: string]: unknown;
};

export type PickerRequest = PickerParams & { id: number; owner: number | null };

type PickerStore = {
  request: PickerRequest | null;
  set: (r: PickerRequest | null) => void;
};

export const useDatePicker = create<PickerStore>((set) => ({
  request: null,
  set: (request) => set({ request }),
}));

let nextId = 1;

const utcOffsetOf = (d: Date) => -d.getTimezoneOffset();

export const setEvent = (date: Date): DateTimePickerEvent => ({
  type: "set",
  nativeEvent: { timestamp: date.getTime(), utcOffset: utcOffsetOf(date) },
});

export const dismissEvent = (date: Date): DateTimePickerEvent => ({
  type: "dismissed",
  nativeEvent: { timestamp: date.getTime(), utcOffset: utcOffsetOf(date) },
});

function openFor(params: PickerParams, owner: number | null) {
  const cur = useDatePicker.getState().request;
  // The same component re-rendering (new callbacks each render) updates the
  // open sheet rather than opening it again, unless what it shows changed.
  // (A value of `new Date()` written inline differs by milliseconds each
  // render: only a different day — or minute, for a time — counts as changed.)
  const mode = params.mode ?? "date";
  const same =
    cur &&
    owner !== null &&
    cur.owner === owner &&
    (cur.mode ?? "date") === mode &&
    (mode === "date" ? sameDay(cur.value, params.value) : Math.floor(cur.value.getTime() / 60000) === Math.floor(params.value.getTime() / 60000));
  useDatePicker.getState().set({ ...params, id: same ? cur.id : nextId++, owner });
}

export const DateTimePickerAndroid = {
  open(params: PickerParams): void {
    openFor(params, null);
  },
  /** Closes the picker without calling anything, as the native one does. */
  dismiss(_mode?: PickerMode, _design?: string): Promise<boolean> {
    const open = useDatePicker.getState().request !== null;
    useDatePicker.getState().set(null);
    return Promise.resolve(open);
  },
};

/** The user pressed OK on `req` with `date`. Called by the host. */
export function resolvePicked(req: PickerRequest, date: Date): void {
  if (useDatePicker.getState().request?.id === req.id) useDatePicker.getState().set(null);
  if (req.onValueChange) req.onValueChange(setEvent(date), date);
  else req.onChange?.(setEvent(date), date);
}

/** The user closed `req` without choosing. Called by the host. */
export function resolveDismissed(req: PickerRequest): void {
  if (useDatePicker.getState().request?.id === req.id) useDatePicker.getState().set(null);
  if (req.onDismiss) req.onDismiss();
  else req.onChange?.(dismissEvent(req.value), req.value);
}

let nextOwner = 1;

/** Drop-in for the native component: open while mounted, nothing in place. */
export default function DateTimePicker(props: PickerParams): null {
  const [owner] = useState(() => nextOwner++);
  const mode = props.mode ?? "date";

  useEffect(() => {
    return () => {
      if (useDatePicker.getState().request?.owner === owner) useDatePicker.getState().set(null);
    };
  }, [mode, owner]);

  const ts = props.value.getTime();
  useEffect(() => {
    openFor(props, owner);
    // Like the native component: re-open/update on these, not on every prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onChange, props.onValueChange, props.onDismiss, ts, mode]);

  return null;
}
