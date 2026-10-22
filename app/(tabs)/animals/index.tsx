import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation, Platform, Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimalRow } from "@/components/AnimalRow";
import { Chip, Chips } from "@/components/Chips";
import { Collapsible } from "@/components/Collapsible";
import { CowIcon } from "@/components/CowIcon";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { extractFrappeError } from "@/src/services/api";
import { useScheme } from "@/src/theme/themeStore";
import { useAnimalGroups } from "@/src/stores/animalGroups";
import { useAnimals } from "@/src/hooks/useAnimals";
import { useHerdFacts, type HerdFacts } from "@/src/hooks/useHerds";
import type { Animal } from "@/types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "lactating", label: "Lactating" },
  { id: "heifer", label: "Heifers" },
  { id: "calf", label: "Calves" },
  { id: "incalf", label: "In-calf" },
];

/** `#rgb`, `#rrggbb` or `rgb(...)` with an alpha. */
// Header opacity down its height: 1 until GLASS_START, then
// alpha(t) = 1 - (1 - GLASS_MIN) * (e^(k·u) - 1) / (e^k - 1), u = progress through
// the fade — flat at first, dropping fastest at the very bottom edge.
const GLASS_START = 0.55;
const GLASS_MIN = 0.62;
const GLASS_K = 3.5;
const GLASS_STOPS: [number, number][] = [0, GLASS_START, 0.7, 0.8, 0.88, 0.94, 1].map((t) => {
  const u = Math.max(0, (t - GLASS_START) / (1 - GLASS_START));
  const a = 1 - (1 - GLASS_MIN) * (Math.exp(GLASS_K * u) - 1) / (Math.exp(GLASS_K) - 1);
  return [t, Math.round(a * 1000) / 1000];
});

function withAlpha(color: string, a: number): string {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const rgb = color.match(/rgba?\(([^)]+)\)/);
  if (rgb) return `rgba(${rgb[1].split(",").slice(0, 3).join(",")},${a})`;
  return color;
}

const monthsOld = (dob: string) => {
  const t = Date.parse(dob);
  return Number.isNaN(t) ? Infinity : (Date.now() - t) / (30.44 * 86_400_000);
};

/** The farm's own definitions: milking herds from Livestock Settings, calf-rearing herds from Herds, stages from the server. */
function matcher(id: string, facts: HerdFacts, anyCalfHerd: boolean): (a: Animal) => boolean {
  const milking = new Set(facts.milking);
  const calfHerds = new Set(facts.calf);
  switch (id) {
    case "lactating": return (a) => milking.has(a.herd);
    case "heifer": return (a) => a.stage === "heifer";
    case "calf":
      return anyCalfHerd
        ? (a) => calfHerds.has(a.herd)
        : (a) => !!a.dob && monthsOld(a.dob) < 6;
    case "incalf": return (a) => a.stage === "confirmed" || a.stage === "dry";
    default: return () => true;
  }
}

export default function Animals() {
  const c = useColors();
  const dark = useScheme() === "dark";
  const s = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [headerH, setHeaderH] = useState(220);
  const [showTop, setShowTop] = useState(false);
  const listRef = useRef<SectionList<Animal>>(null);
  const openMap = useAnimalGroups((st) => st.open);
  const toggleGroup = useAnimalGroups((st) => st.toggle);
  const setAll = useAnimalGroups((st) => st.setAll);
  const { data: animals = [], isLoading, isRefetching, error, refetch } = useAnimals();
  // Search runs in the local SQLite store (tag, name, herd), so it works offline.
  const { data: found = animals } = useAnimals(query);

  const facts = useHerdFacts();
  const matchers = useMemo(() => {
    const any = facts.calf.length > 0;
    return Object.fromEntries(FILTERS.map((f) => [f.id, matcher(f.id, facts, any)]));
  }, [facts]);
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of FILTERS) out[f.id] = f.id === "all" ? animals.length : animals.filter(matchers[f.id]).length;
    return out;
  }, [animals, matchers]);

  const list = useMemo(() => (filter === "all" ? found : found.filter(matchers[filter])), [found, filter, matchers]);

  // Group the filtered list by herd.
  const groups = useMemo(() => {
    const map = new Map<string, Animal[]>();
    for (const a of list) {
      const key = a.herd || "Unassigned";
      const arr = map.get(key);
      if (arr) arr.push(a);
      else map.set(key, [a]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);

  const searching = query.trim().length > 0;
  const isOpen = useCallback((herd: string) => searching || !!openMap[herd], [searching, openMap]);
  const herds = useMemo(() => groups.map(([h]) => h), [groups]);
  const allOpen = herds.length > 0 && herds.every((h) => isOpen(h));

  // Collapsed groups contribute no rows, so ~400 animals stay cheap.
  const sections = useMemo(
    () =>
      groups.map(([herd, items]) => ({
        herd,
        count: items.length,
        data: isOpen(herd) ? items : [],
      })),
    [groups, isOpen],
  );

  const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  const toggleAll = () => {
    animate();
    setAll(herds, !allOpen);
  };
  const backToTop = () => {
    animate();
    setAll(herds, false);
    listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, viewOffset: headerH, animated: true });
    setShowTop(false);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const show = e.nativeEvent.contentOffset.y > 500;
    setShowTop((prev) => (prev === show ? prev : show));
  };

  const subtitle = animals.length ? `${animals.length} animals` : "";
  const state = isLoading ? "loading" : error ? "error" : list.length === 0 ? "empty" : "ok";

  return (
    <View style={s.screen}>
      {state === "ok" ? (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(a) => a.id}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={64}
          contentContainerStyle={{ paddingTop: headerH, paddingHorizontal: 14, paddingBottom: 24 }}
          scrollIndicatorInsets={{ top: headerH }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={c.text}
              progressViewOffset={headerH}
            />
          }
          renderSectionHeader={({ section }) => (
            <Collapsible
              title={section.herd}
              meta={`${section.count} head`}
              open={isOpen(section.herd)}
              onToggle={() => toggleGroup(section.herd)}
            />
          )}
          renderItem={({ item }) => (
            <View style={s.rowIndent}>
              <AnimalRow
                a={item}
                onPress={() => router.push(`/(tabs)/animals/${encodeURIComponent(item.id)}`)}
              />
            </View>
          )}
        />
      ) : (
        <View style={{ paddingTop: headerH, paddingHorizontal: 14 }}>
          {state === "loading" ? (
            <Loader />
          ) : state === "error" ? (
            <ErrorState text={extractFrappeError(error)} onRetry={() => refetch()} />
          ) : (
            <Empty text="No animals match" />
          )}
        </View>
      )}

      <BlurView
        intensity={50}
        tint={dark ? "dark" : "light"}
        experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
        style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)" }]}
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          setHeaderH((prev) => (prev === h ? prev : h));
        }}
      >
        {/* Glass: solid for most of the header, then an inverse-exponential fall-off
            in the last stretch, so only the bottom edge is frosted. */}
        <LinearGradient
          pointerEvents="none"
          colors={GLASS_STOPS.map(([, a]) => withAlpha(c.bg, a)) as unknown as readonly [string, string, ...string[]]}
          locations={GLASS_STOPS.map(([t]) => t) as unknown as readonly [number, number, ...number[]]}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.titleRow}>
          <CowIcon size={30} color={c.text} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.title} numberOfLines={1}>Animals</Text>
            {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          {!searching && herds.length > 0 ? (
            <Pressable onPress={toggleAll} hitSlop={8} style={s.toggleAll} accessibilityRole="button">
              <MaterialCommunityIcons
                name={allOpen ? "unfold-less-horizontal" : "unfold-more-horizontal"}
                size={18}
                color={c.text}
              />
              <Text style={s.toggleText}>{allOpen ? "Collapse all" : "Expand all"}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={s.search}>
          <MaterialCommunityIcons name="magnify" size={18} color={c.textSubtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by tag, name or herd"
            placeholderTextColor={c.textSubtle}
            style={s.input}
          />
        </View>
        <Chips>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={`${f.label} ${counts[f.id] ?? 0}`} active={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </Chips>
      </BlurView>

      {showTop ? (
        <Pressable onPress={backToTop} style={s.fab} accessibilityRole="button" accessibilityLabel="Back to top and collapse all">
          <MaterialCommunityIcons name="chevron-up" size={26} color={c.bg} />
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    header: {
      position: "absolute", top: 0, left: 0, right: 0,
      paddingHorizontal: 14, paddingBottom: 8, overflow: "hidden",
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
    title: { fontSize: 22, fontFamily: FONT_FAMILY.semibold, color: c.text },
    subtitle: { fontSize: 13, fontFamily: FONT_FAMILY.regular, color: c.textMuted, marginTop: 1 },
    toggleAll: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    toggleText: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: c.text },
    rowIndent: { marginLeft: 24 },
    fab: {
      position: "absolute", right: 16, bottom: 16, width: 48, height: 48, borderRadius: 24,
      backgroundColor: c.text, alignItems: "center", justifyContent: "center",
      elevation: 6, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      marginBottom: 10,
    },
    input: { flex: 1, fontSize: 16, color: c.text, padding: 0 },
  });
