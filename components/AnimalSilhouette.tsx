import React from "react";
import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";

import { SILHOUETTE_PATHS } from "@/src/art/paths";
import { pickSilhouette, silhouetteClass, type Silhouette, type SilhouetteSubject } from "@/src/silhouettes";

/**
 * One traced silhouette, fitted inside its box (a cow side on is wide, a calf
 * facing us is tall, so the drawing keeps its own proportions and is centred).
 */
export function SilhouetteArt({
  pose,
  color,
  width = "100%",
  height = "100%",
  kind,
}: {
  pose: Silhouette;
  color: ColorValue;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  kind?: string;
}) {
  const art = SILHOUETTE_PATHS[pose];
  return (
    <Svg
      width={width}
      height={height}
      viewBox={art.viewBox.join(" ")}
      preserveAspectRatio="xMidYMid meet"
      testID={`silhouette-${pose}`}
      accessibilityLabel={kind ? `${kind} silhouette` : undefined}
    >
      <Path d={art.d} fill={color} />
    </Svg>
  );
}

/** The silhouette an animal with no photo wears: class by species, age, sex and stage; pose by number. */
export function AnimalSilhouette({
  animal,
  color,
  inset = 0.16,
}: {
  animal: SilhouetteSubject;
  color: ColorValue;
  /** Margin on each side, as a share of the box, so the drawing sits in a frame. */
  inset?: number;
}) {
  const pose = pickSilhouette(animal);
  const size = `${Math.round((1 - inset * 2) * 100)}%` as const;
  return <SilhouetteArt pose={pose} color={color} width={size} height={size} kind={silhouetteClass(animal)} />;
}
