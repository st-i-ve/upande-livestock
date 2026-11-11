jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated/src/css/native/proxy", () => ({
  ...jest.requireActual("react-native-reanimated/src/css/native/proxy"),
  setCSSEventHandler: () => {},
}));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

import React from "react";
import { Alert, Modal, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { AppAlertHost } from "@/components/AppAlertHost";
import { backAction, installAppAlert, useAppAlerts } from "@/src/ui/alert";

installAppAlert();

let r!: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers();
  useAppAlerts.setState({ queue: [] });
  act(() => {
    r = TestRenderer.create(<AppAlertHost />);
  });
});
afterEach(() => {
  act(() => r.unmount());
  jest.useRealTimers();
});

const texts = () => r.root.findAllByType(Text).map((t) => [t.props.children].flat().join(""));
const buttons = () =>
  r.root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("app-alert-button-") && typeof n.props.onPress === "function" && n.props.accessibilityRole === "button");
const press = (i: number) => {
  act(() => buttons()[i].props.onPress());
  act(() => jest.advanceTimersByTime(400));
};
const back = () => {
  act(() => r.root.findByType(Modal).props.onRequestClose());
  act(() => jest.advanceTimersByTime(400));
};

describe("Alert.alert is the app's alert", () => {
  it("shows the title, message and the buttons in order, styled by kind", () => {
    const discard = jest.fn();
    act(() =>
      Alert.alert("Discard this record?", "What you entered for Weight will be lost.", [
        { text: "Keep it", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: discard },
      ]),
    );
    expect(r.root.findByProps({ testID: "app-alert" }).props.role).toBe("alertdialog");
    expect(texts()).toEqual(expect.arrayContaining(["Discard this record?", "What you entered for Weight will be lost.", "Keep it", "Discard"]));
    expect(buttons().map((b) => b.props.accessibilityLabel)).toEqual(["Keep it", "Discard"]);
    press(1);
    expect(discard).toHaveBeenCalledTimes(1);
    expect(r.root.findAllByType(Modal)).toHaveLength(0);
  });

  it("gives one OK with no buttons", () => {
    act(() => Alert.alert("Saved"));
    expect(buttons().map((b) => b.props.accessibilityLabel)).toEqual(["OK"]);
    press(0);
    expect(useAppAlerts.getState().queue).toHaveLength(0);
  });

  it("queues alerts and shows them one after another", () => {
    act(() => {
      Alert.alert("First");
      Alert.alert("Second");
    });
    expect(texts()).toContain("First");
    expect(texts()).not.toContain("Second");
    press(0);
    expect(texts()).toContain("Second");
  });

  it("back presses cancel; when cancelable it dismisses and calls onDismiss", () => {
    const cancel = jest.fn();
    act(() => Alert.alert("Leave?", undefined, [{ text: "Stay", style: "cancel", onPress: cancel }, { text: "Leave" }]));
    back();
    expect(cancel).toHaveBeenCalledTimes(1);

    const onDismiss = jest.fn();
    act(() => Alert.alert("Note", "Tap outside to close", [{ text: "OK" }], { cancelable: true, onDismiss }));
    back();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("back does nothing on a non-cancelable alert with no cancel button", () => {
    act(() => Alert.alert("Must choose", undefined, [{ text: "A" }, { text: "B" }]));
    expect(backAction(useAppAlerts.getState().queue[0])).toBeNull();
    back();
    expect(useAppAlerts.getState().queue).toHaveLength(1);
  });
});
