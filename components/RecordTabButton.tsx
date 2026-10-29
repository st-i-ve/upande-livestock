import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarButtonProps } from "expo-router/js-tabs";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useColors } from "@/src/hooks/useColors";

const CIRCLE_DIAMETER = 50;
const CIRCLE_LIFT = 10;

type Props = Pick<BottomTabBarButtonProps, "onPress" | "onLongPress" | "accessibilityState">;

/** The raised round "+" in the middle of the tab bar, shared by the cattle and shoat tabs. */
export function RecordTabButton(props: Props) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const selected = props.accessibilityState?.selected;
  return (
    <Pressable
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      accessibilityRole="button"
      accessibilityLabel="Log a livestock event"
      accessibilityState={{ selected }}
      android_ripple={null}
      style={s.recordCell}
    >
      <View style={s.recordCircle}>
        <MaterialCommunityIcons name="plus" size={26} color={c.bg} />
      </View>
    </Pressable>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    recordCell: { flex: 1, alignItems: "center", justifyContent: "center" },
    recordCircle: {
      position: "absolute",
      top: -CIRCLE_LIFT,
      width: CIRCLE_DIAMETER,
      height: CIRCLE_DIAMETER,
      borderRadius: CIRCLE_DIAMETER / 2,
      backgroundColor: c.text,
      alignItems: "center",
      justifyContent: "center",
    },
  });
