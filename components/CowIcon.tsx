import React from "react";
import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";

import { LOGO_COW } from "@/src/art/paths";

/**
 * The Livestock logo's cow (the traced standing cow, side on, facing right),
 * solid in one colour for the tab bar. Her canvas is 473 x 318, hooves on its
 * bottom edge; the grass is left out at icon size.
 */
export function CowIcon({ size = 24, color = "#000" }: { size?: number; color?: ColorValue }) {
  return (
    <Svg width={size} height={size * (318 / 473)} viewBox="0 0 473 318">
      <Path d={LOGO_COW.tail} fill={color} />
      <Path d={LOGO_COW.body} fill={color} />
    </Svg>
  );
}
