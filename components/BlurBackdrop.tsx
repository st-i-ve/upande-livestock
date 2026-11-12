import { requireOptionalNativeModule } from "expo";
import React from "react";
import { Platform, StyleSheet, UIManager, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/**
 * Frosted glass for sheets: the page behind them frosting gradually towards
 * the sheet instead of a flat black dim, and the sheet a translucent pane.
 *
 * On Android a blur can only blur views inside a BlurTargetView, and must not
 * sit inside it itself: the root layout wraps the app in BlurTargetRoot and
 * draws sheets that use this beside it, not in it. A binary without the blur
 * module (an APK older than this change) gets a plain dim and solid sheet.
 */
const HAS_BLUR = Platform.OS !== "web" && requireOptionalNativeModule("ExpoBlur") != null;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- only once its native side is known to exist
const Blur: typeof import("expo-blur") | null = HAS_BLUR ? require("expo-blur") : null;
const HAS_MASK = Platform.OS !== "web" && UIManager.hasViewManagerConfig?.("RNCMaskedView") === true;
type MaskedProps = { style?: StyleProp<ViewStyle>; maskElement: React.ReactElement; children: React.ReactNode };
// Its class types predate React 19's JSX types, so it is typed by its props here.
const Masked: React.ComponentType<MaskedProps> | null = HAS_MASK
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- only once its native side is known to exist
    require("@react-native-masked-view/masked-view").default
  : null;

/** The app's content, the view the backdrop blurs. */
export const blurTarget = React.createRef<React.ComponentRef<typeof View>>();

export function BlurTargetRoot({ children, backgroundColor }: { children: React.ReactNode; backgroundColor: string }) {
  if (!Blur) return <View style={{ flex: 1, backgroundColor }}>{children}</View>;
  return (
    <Blur.BlurTargetView ref={blurTarget} style={{ flex: 1, backgroundColor }}>
      {children}
    </Blur.BlurTargetView>
  );
}

/** Bands of blur, for a binary that has the blur but not the masked view. */
const STEPS = 16;
const MAX_INTENSITY = 60;
/** The mask's stops: an eased ramp (smoothstep), so the frost has no visible start or edge. */
const RAMP = 14;

/**
 * Eased gradient stops from clear (top) to full (bottom) over the lower
 * `reach` of the screen: [offset, opacity], ease-in-out, as
 * react-native-easing-gradient does for the gist this follows.
 */
export function easedStops(reach: number, steps = RAMP): [number, number][] {
  const out: [number, number][] = [[0, 0]];
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    out.push([1 - reach + reach * x, x * x * (3 - 2 * x)]);
  }
  return out;
}

function Ramp({ id, color, max, reach }: { id: string; color: string; max: number; reach: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {easedStops(reach).map(([offset, a], i) => (
            <Stop key={i} offset={offset} stopColor={color} stopOpacity={a * max} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Frosted glass behind a sheet, as a gradient: the page is clear at the top
 * and frosts smoothly towards the sheet at the bottom. One full-strength blur
 * of the page, shown through an eased gradient mask (a masked gradient blur,
 * as steve228uk's GradientMaskedBlurHeader), under a light veil that thickens
 * the same way: white in light mode, smoky in dark. Without the masked view,
 * fine bands of blur instead; without the blur, the veil alone, darker.
 */
export function FrostedBackdrop({ dark, reach = 0.9 }: { dark: boolean; reach?: number }) {
  const { height } = useWindowDimensions();
  const tint = dark ? "dark" : "light";
  const veil = Blur ? (dark ? "#0B0B0B" : "#FFFFFF") : "#000000";
  const veilMax = Blur ? (dark ? 0.4 : 0.3) : 0.45;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Blur && Masked ? (
        <Masked
          style={StyleSheet.absoluteFill}
          maskElement={<Ramp id="mask" color="#000000" max={1} reach={reach} />}
        >
          <Blur.BlurView
            blurTarget={blurTarget}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={100}
            tint={tint}
            style={StyleSheet.absoluteFill}
          />
        </Masked>
      ) : Blur ? (
        Array.from({ length: STEPS }, (_, k) => (
          <Blur.BlurView
            key={k}
            blurTarget={blurTarget}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={(MAX_INTENSITY * (k + 1)) / STEPS}
            style={[s.band, { height: height * reach * ((STEPS - k) / STEPS) }]}
          />
        ))
      ) : null}
      <Ramp id="veil" color={veil} max={veilMax} reach={reach} />
    </View>
  );
}

/**
 * A pane of frosted glass for the sheet itself: what is behind it blurred
 * more strongly, a frosted white (or smoky, in dark mode) fill over it and a thin
 * bright edge. Without the blur module, the plain page colour.
 */
export function GlassPanel({
  dark,
  solid,
  style,
  children,
}: {
  dark: boolean;
  /** The page colour, used where there is no blur. */
  solid: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        style,
        s.panel,
        Blur
          ? { borderColor: dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.7)" }
          : { backgroundColor: solid },
      ]}
    >
      {Blur ? (
        <>
          <Blur.BlurView
            blurTarget={blurTarget}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={90}
            tint={dark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: dark ? "rgba(22,22,22,0.62)" : "rgba(255,255,255,0.66)" }]}
          />
        </>
      ) : null}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  panel: { overflow: "hidden" },
  band: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
