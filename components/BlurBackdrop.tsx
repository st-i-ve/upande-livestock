import { requireOptionalNativeModule } from "expo";
import React from "react";
import { Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
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

/** Fine steps of blur, so their edges do not show: each a little stronger and shorter. */
const STEPS = 16;
const MAX_INTENSITY = 60;

/**
 * Frosted glass behind a sheet, as a gradient: the page is clear at the top
 * and frosts more and more towards the sheet at the bottom. Fine bands of
 * blur, each a touch stronger than the one under it, under a frosted white veil
 * (white in light mode, smoky in dark) that thickens the same way and
 * smooths the bands' edges. Without the blur module, the veil alone, darker.
 */
export function FrostedBackdrop({ dark, reach = 0.9 }: { dark: boolean; reach?: number }) {
  const { height } = useWindowDimensions();
  const span = height * reach;
  const veil = Blur ? (dark ? "#0B0B0B" : "#FFFFFF") : "#000000";
  const veilMax = Blur ? (dark ? 0.45 : 0.35) : 0.45;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Blur
        ? Array.from({ length: STEPS }, (_, k) => (
            <Blur.BlurView
              key={k}
              blurTarget={blurTarget}
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={(MAX_INTENSITY * (k + 1)) / STEPS}
              style={[s.band, { height: span * ((STEPS - k) / STEPS) }]}
            />
          ))
        : null}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={veil} stopOpacity={0} />
            <Stop offset={1 - reach} stopColor={veil} stopOpacity={0} />
            <Stop offset={1 - reach / 2} stopColor={veil} stopOpacity={veilMax * 0.45} />
            <Stop offset={1} stopColor={veil} stopOpacity={veilMax} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#veil)" />
      </Svg>
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
