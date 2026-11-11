jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated/src/css/native/proxy", () => ({
  ...jest.requireActual("react-native-reanimated/src/css/native/proxy"),
  setCSSEventHandler: () => {},
}));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

import React from "react";
import { Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { PillButton } from "@/components/PillButton";
import { PillSegmented } from "@/components/PillSegmented";

const options = (["system", "light", "dark"] as const).map((id) => ({
  id,
  label: `${id} theme`,
  render: (on: boolean) => <Text>{on ? `[${id}]` : id}</Text>,
}));

describe("PillSegmented", () => {
  it("marks the chosen option and reports a tap", () => {
    const onChange = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<PillSegmented value="light" onChange={onChange} options={options} />);
    });
    const radios = r.root.findAll((n) => n.props.accessibilityRole === "radio" && typeof n.props.onPress === "function");
    expect(radios).toHaveLength(3);
    expect(radios.map((n) => n.props.accessibilityState.checked)).toEqual([false, true, false]);
    expect(r.root.findAllByType(Text).map((t) => t.props.children)).toEqual(["system", "[light]", "dark"]);
    act(() => radios[2].props.onPress());
    expect(onChange).toHaveBeenCalledWith("dark");
  });
});

describe("PillButton", () => {
  it("is a fully rounded button that fires onPress", () => {
    const onPress = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<PillButton label="Done" onPress={onPress} />);
    });
    const btn = r.root.find((n) => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function");
    act(() => btn.props.onPress());
    expect(onPress).toHaveBeenCalled();
  });
});
