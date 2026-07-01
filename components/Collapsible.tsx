import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";
import { useColors } from "@/src/hooks/useColors";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Scout-style expandable section: a header row with a chevron that rotates
// 0°→90° on open, and body content indented beneath it.
export function Collapsible({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={s.wrap}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [s.header, pressed && { opacity: 0.7 }]}
      >
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={c.textMuted}
          style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}
        />
        <View style={s.main}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
        </View>
        {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
      </Pressable>
      {open ? <View style={s.content}>{children}</View> : null}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    wrap: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 14,
    },
    main: { flex: 1, minWidth: 0 },
    title: { fontSize: 16, fontWeight: "600", color: c.text },
    meta: { fontSize: 13, color: c.textMuted, marginLeft: 8 },
    content: { marginLeft: 24, paddingBottom: 6 },
  });
