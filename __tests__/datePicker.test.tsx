jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated/src/css/native/proxy", () => ({
  ...jest.requireActual("react-native-reanimated/src/css/native/proxy"),
  setCSSEventHandler: () => {},
}));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

import React from "react";
import { Modal } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TestRenderer, { act } from "react-test-renderer";

import { DatePickerHost } from "@/components/DatePickerHost";
import DateTimePicker, { DateTimePickerAndroid, useDatePicker } from "@/src/ui/datetimepicker";

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const NOW = new Date(2026, 10, 12, 10, 0);

let r!: TestRenderer.ReactTestRenderer;
const mount = (el: React.ReactElement | null) =>
  act(() => {
    r = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        {el}
        <DatePickerHost />
      </SafeAreaProvider>,
    );
  });

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  useDatePicker.setState({ request: null });
});
afterEach(() => {
  act(() => r?.unmount());
  jest.useRealTimers();
});

const byId = (id: string) => r.root.find((n) => n.props.testID === id && typeof n.props.onPress !== "undefined" && n.props.accessibilityRole === "button");
const maybe = (id: string) => r.root.findAll((n) => n.props.testID === id && n.props.accessibilityRole === "button")[0];
const tap = (id: string) => {
  act(() => byId(id).props.onPress());
};
const settle = () => act(() => jest.advanceTimersByTime(400));

describe("the picker shim behaves like the native one", () => {
  it("OK calls onChange with a native 'set' event and the date", () => {
    const onChange = jest.fn();
    mount(<DateTimePicker value={new Date(2026, 10, 3, 7, 45)} mode="date" onChange={onChange} />);
    expect(r.root.findAllByType(Modal)).toHaveLength(1);
    tap("day-2026-11-05");
    tap("date-picker-ok");
    settle();
    const picked = new Date(2026, 10, 5, 7, 45); // the day chosen, the value's time kept
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      { type: "set", nativeEvent: { timestamp: picked.getTime(), utcOffset: -picked.getTimezoneOffset() } },
      picked,
    );
    expect(useDatePicker.getState().request).toBeNull();
    expect(r.root.findAllByType(Modal)).toHaveLength(0);
  });

  it("Cancel and the back button send 'dismissed' with the value it opened with", () => {
    const onChange = jest.fn();
    const value = new Date(2026, 10, 3);
    mount(<DateTimePicker value={value} onChange={onChange} />);
    tap("day-2026-11-05");
    tap("date-picker-cancel");
    settle();
    expect(onChange).toHaveBeenCalledWith({ type: "dismissed", nativeEvent: { timestamp: value.getTime(), utcOffset: -value.getTimezoneOffset() } }, value);

    const onDismiss = jest.fn();
    const onValueChange = jest.fn();
    act(() => DateTimePickerAndroid.open({ value, onValueChange, onDismiss }));
    act(() => r.root.findByType(Modal).props.onRequestClose());
    settle();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("onValueChange, when given, takes the chosen date instead of onChange", () => {
    const onChange = jest.fn();
    const onValueChange = jest.fn();
    mount(null);
    act(() => DateTimePickerAndroid.open({ value: new Date(2026, 10, 3), onChange, onValueChange }));
    tap("date-picker-chip-Yesterday");
    tap("date-picker-ok");
    settle();
    expect(onChange).not.toHaveBeenCalled();
    const y = new Date(2026, 10, 11);
    expect(onValueChange).toHaveBeenCalledWith(expect.objectContaining({ type: "set", nativeEvent: expect.objectContaining({ timestamp: y.getTime() }) }), y);
  });

  it("greys days outside min/max and closes the arrows at the bounds", () => {
    const onChange = jest.fn();
    mount(<DateTimePicker value={new Date(2026, 10, 30)} minimumDate={new Date(2026, 10, 2)} maximumDate={new Date(2026, 10, 12)} onChange={onChange} />);
    // The value was after the maximum: it opens on the maximum.
    expect(byId("day-2026-11-12").props.accessibilityState).toEqual({ selected: true, disabled: false });
    expect(maybe("day-2026-11-13").props.onPress).toBeUndefined();
    expect(maybe("day-2026-11-01").props.accessibilityState.disabled).toBe(true);
    expect(maybe("date-picker-prev").props.onPress).toBeUndefined();
    expect(maybe("date-picker-next").props.onPress).toBeUndefined();
    // Today is allowed, Yesterday too.
    expect(maybe("date-picker-chip-Today")).toBeTruthy();
    expect(maybe("date-picker-chip-Yesterday")).toBeTruthy();
  });

  it("opens the year and month lists from the title", () => {
    const onChange = jest.fn();
    mount(<DateTimePicker value={new Date(2026, 10, 3)} onChange={onChange} />);
    tap("date-picker-title");
    tap("year-2024");
    tap("month-1");
    tap("day-2024-02-29");
    tap("date-picker-ok");
    settle();
    expect(onChange.mock.calls[0][1]).toEqual(new Date(2024, 1, 29));
  });

  it("closes without calling back when the component unmounts or dismiss() is called", () => {
    const onChange = jest.fn();
    mount(<DateTimePicker value={new Date(2026, 10, 3)} onChange={onChange} />);
    act(() =>
      r.update(
        <SafeAreaProvider initialMetrics={METRICS}>
          <DatePickerHost />
        </SafeAreaProvider>,
      ),
    );
    expect(useDatePicker.getState().request).toBeNull();
    act(() => DateTimePickerAndroid.open({ value: new Date(), onChange }));
    act(() => void DateTimePickerAndroid.dismiss("date"));
    expect(useDatePicker.getState().request).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the open sheet when the component re-renders with new callbacks", () => {
    const first = jest.fn();
    const second = jest.fn();
    mount(<DateTimePicker value={new Date(2026, 10, 3)} onChange={first} />);
    const id = useDatePicker.getState().request!.id;
    tap("date-picker-prev");
    act(() =>
      r.update(
        <SafeAreaProvider initialMetrics={METRICS}>
          <DateTimePicker value={new Date(2026, 10, 3, 0, 0, 0, 5)} onChange={second} />
          <DatePickerHost />
        </SafeAreaProvider>,
      ),
    );
    expect(useDatePicker.getState().request!.id).toBe(id);
    tap("day-2026-10-20"); // still on October
    tap("date-picker-ok");
    settle();
    expect(first).not.toHaveBeenCalled();
    expect(second.mock.calls[0][1]).toEqual(new Date(2026, 9, 20));
  });

  it("picks a time in time mode", () => {
    const onChange = jest.fn();
    mount(<DateTimePicker value={new Date(2026, 10, 3, 7, 45)} mode="time" onChange={onChange} />);
    tap("hour-14");
    tap("minute-30");
    tap("date-picker-ok");
    settle();
    expect(onChange.mock.calls[0][0].type).toBe("set");
    expect(onChange.mock.calls[0][1]).toEqual(new Date(2026, 10, 3, 14, 30));
  });
});
