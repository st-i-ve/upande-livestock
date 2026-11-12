import { requireOptionalNativeModule } from "expo";
import React from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/**
 * A backdrop that blurs what is behind a sheet, most where the sheet is and
 * less and less towards the top, instead of a flat black dim.
 *
 * On Android a blur can only blur views inside a BlurTargetView, and must not
 * sit inside it itself: the root layout wraps the app in BlurTargetRoot and
 * draws sheets that use this beside it, not in it. A binary without the blur
 * module (an APK older than this change) gets the soft gradient alone.
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

/** Bands of blur, each a little stronger and shorter than the one under it. */
const STEPS = 10;
const MAX_INTENSITY = 70;

export function ProgressiveBlur({ dark, reach = 0.85 }: { dark: boolean; reach?: number }) {
  const { height } = useWindowDimensions();
  const top = height * (1 - reach);
  const shade = dark ? "#000000" : "#0A0A0A";
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Blur
        ? Array.from({ length: STEPS }, (_, k) => (
            <Blur.BlurView
              key={k}
              blurTarget={blurTarget}
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={(MAX_INTENSITY * (k + 1)) / STEPS}
              tint={dark ? "dark" : "light"}
              style={[s.band, { height: (height - top) * ((STEPS - k) / STEPS) }]}
            />
          ))
        : null}
      {/* A soft shade over it, darkest at the bottom: it smooths the bands' edges, and it is
          the whole backdrop where there is no blur. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={shade} stopOpacity={0} />
            <Stop offset={1 - reach} stopColor={shade} stopOpacity={0} />
            <Stop offset={1} stopColor={shade} stopOpacity={Blur ? (dark ? 0.35 : 0.2) : 0.45} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#shade)" />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({ band: { position: "absolute", left: 0, right: 0, bottom: 0 } });
