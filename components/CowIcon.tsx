import React from "react";
import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";

// Side-on dairy cow silhouette, facing right: solid, no cartoon features.
// Paths come from the web app's "realistic cow silhouette" mark
// (scripts/build_livestock_logo.py in the backend repo), tail thickened so it
// survives at tab-icon size.
const BODY =
  "M78 72 C140 62 230 66 300 64 C330 63 352 64 370 66 C380 64 388 60 392 56 " +
  "C396 80 402 110 408 132 C396 136 388 150 382 166 C376 184 370 198 366 212 " +
  "L362 316 C362 324 354 328 346 326 L342 230 C338 220 332 218 326 222 " +
  "L322 318 C322 326 314 330 306 326 L304 222 " +
  "C280 230 230 234 180 228 C166 226 156 230 150 244 C142 262 140 282 142 298 " +
  "L146 318 C146 326 138 330 130 326 L124 300 C118 282 114 266 112 248 " +
  "C106 262 104 282 106 298 L110 318 C110 326 102 330 94 326 L88 298 " +
  "C80 270 76 240 70 210 C62 170 60 122 66 92 C68 82 72 76 78 72 Z";
const HEAD =
  "M392 56 L384 42 L404 52 C410 50 416 52 418 58 C432 76 450 104 462 126 " +
  "C468 138 462 150 448 150 C434 150 420 140 408 132 C398 126 388 110 384 92 " +
  "C382 76 386 64 392 56 Z";
const TAIL = "M70 84 C52 122 48 182 52 238 C53 254 56 264 60 272";
const SWITCH = "M60 262 C51 271 51 292 60 299 C69 292 69 271 60 262 Z";

export function CowIcon({ size = 24, color = "#000" }: { size?: number; color?: ColorValue }) {
  // The cow is wide; the box is cropped to her (about 430 x 300).
  return (
    <Svg width={size} height={size * (300 / 430)} viewBox="44 34 430 300">
      <Path d={TAIL} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" />
      <Path d={SWITCH} fill={color} />
      <Path d={BODY} fill={color} />
      <Path d={HEAD} fill={color} />
    </Svg>
  );
}
