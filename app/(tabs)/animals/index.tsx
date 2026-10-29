import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation, Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from "react-native";

import { AnimalRow } from "@/components/AnimalRow";
import { BreedingCards } from "@/components/BreedingCards";
import { Chip, Chips } from "@/components/Chips";
import { Collapsible } from "@/components/Collapsible";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { Screen } from "@/components/Screen";
import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { extractFrappeError } from "@/src/services/api";
import { useAnimalGroups } from "@/src/stores/animalGroups";
import { useAnimals } from "@/src/hooks/useAnimals";
import { breedingCards } from "@/src/beef/breeding";
import { useBeefSettings, useHerdFacts, useHerds, type HerdFacts } from "@/src/hooks/useHerds";
import type { Animal } from "@/types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "breeding", label: "Breeding" },
  { id: "heifer", label: "Heifers" },
  { id: "calf", label: "Calves" },
  { id: "incalf", label: "In-calf" },
  { id: "bulls", label: "Bulls" },
];

const monthsOld = (dob: string) => {
  const t = Date.parse(dob);
  return Number.isNaN(t) ? Infinity : (Date.now() - t) / (30.44 * 86_400_000);
};

/** The farm's own definitions: breeding herds from Herds (class Breeding), calf and heifer herds from Livestock Settings, stages from the server. */
function matcher(id: string, facts: HerdFacts, anyCalfHerd: boolean): (a: Animal) => boolean {
  const breeding = new Set(facts.breeding);
  const calfHerds = new Set(facts.calf);
  const heiferHerds = new Set(facts.heifer);
  const inCalfHerds = new Set(facts.inCalf);
  switch (id) {
    case "breeding": return (a) => breeding.has(a.herd);
    case "bulls": return (a) => a.sex === "M" && monthsOld(a.dob) >= 12;
    case "heifer":
      // The farm's heifer herds when set; otherwise unserved females that are
      // old enough not to be calves.
      return heiferHerds.size > 0
        ? (a) => heiferHerds.has(a.herd)
        : (a) => a.stage === "heifer" && !!a.dob && monthsOld(a.dob) >= 6;
    case "calf":
      return anyCalfHerd
        ? (a) => calfHerds.has(a.herd)
        : (a) => !!a.dob && monthsOld(a.dob) < 6;
    case "incalf":
      // Only the farm's in-calf herds (bullying heifers, steamers) when set.
      return inCalfHerds.size > 0
        ? (a) => inCalfHerds.has(a.herd)
        : (a) => a.stage === "confirmed";
    default: return () => true;
  }
}

export default function Animals() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showTop, setShowTop] = useState(false);
  const listRef = useRef<SectionList<Animal>>(null);
  const openMap = useAnimalGroups((st) => st.open);
  const toggleGroup = useAnimalGroups((st) => st.toggle);
  const setAll = useAnimalGroups((st) => st.setAll);
  const { data: animals = [], isLoading, isRefetching, error, refetch } = useAnimals();
  // Search runs in the local SQLite store (tag, name, herd), so it works offline.
  const { data: found = animals } = useAnimals(query);

  const facts = useHerdFacts();
  const { data: herdRows = [] } = useHerds();
  const beef = useBeefSettings();
  // The breeding herds as highlighted cards, shown above the list under Breeding.
  const cards = useMemo(
    () => (filter === "breeding" ? breedingCards(herdRows, animals, beef.breedingBullMinAgeMonths) : []),
    [filter, herdRows, animals, beef.breedingBullMinAgeMonths],
  );
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
    listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true });
    setShowTop(false);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const show = e.nativeEvent.contentOffset.y > 500;
    setShowTop((prev) => (prev === show ? prev : show));
  };

  const subtitle = animals.length ? `${animals.length} animals` : "";
  const state = isLoading ? "loading" : error ? "error" : list.length === 0 ? "empty" : "ok";

  return (
    <Screen title="Animals" subtitle={subtitle || undefined} scroll={false} headerRight={(!searching && herds.length > 0 ? (
          <Pressable onPress={toggleAll} hitSlop={8} style={s.toggleAll} accessibilityRole="button">
            <MaterialCommunityIcons
              name={allOpen ? "unfold-less-horizontal" : "unfold-more-horizontal"}
              size={18}
              color={c.text}
            />
            <Text style={s.toggleText}>{allOpen ? "Collapse all" : "Expand all"}</Text>
          </Pressable>
        ) : null)}>
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
      {filter === "heifer" && facts.heifer.length === 0 ? (
        <Text style={s.hint}>Set heifer herds in Livestock Settings</Text>
      ) : null}
      {filter === "incalf" && facts.inCalf.length === 0 ? (
        <Text style={s.hint}>Set in-calf herds in Livestock Settings</Text>
      ) : null}
      {filter === "breeding" && facts.breeding.length === 0 ? (
        <Text style={s.hint}>No herd is class Breeding yet</Text>
      ) : null}
      {state === "ok" ? (
        <SectionList
          ListHeaderComponent={
            cards.length ? (
              <BreedingCards cards={cards} onOpen={(h) => router.push(`/(tabs)/animals/herds/${encodeURIComponent(h)}`)} />
            ) : null
          }
          ref={listRef}
          sections={sections}
          keyExtractor={(a) => a.id}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={64}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={c.text}
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
        <View>
          {state === "loading" ? (
            <Loader />
          ) : state === "error" ? (
            <ErrorState text={extractFrappeError(error)} onRetry={() => refetch()} />
          ) : (
            <Empty text="No animals match" />
          )}
        </View>
      )}


      {showTop ? (
        <Pressable onPress={backToTop} style={s.fab} accessibilityRole="button" accessibilityLabel="Back to top and collapse all">
          <MaterialCommunityIcons name="chevron-up" size={26} color={c.bg} />
        </Pressable>
      ) : null}
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    hint: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: c.textMuted, marginTop: 6 },
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
