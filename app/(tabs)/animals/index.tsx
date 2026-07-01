import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { AnimalRow } from "@/components/AnimalRow";
import { Chip, Chips } from "@/components/Chips";
import { Collapsible } from "@/components/Collapsible";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { Screen } from "@/components/Screen";
import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { extractFrappeError } from "@/src/services/api";
import { useAnimals } from "@/src/hooks/useAnimals";
import type { Animal } from "@/types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "Lactating", label: "Lactating" },
  { id: "Heifer", label: "Heifers" },
  { id: "Calf", label: "Calves" },
  { id: "Pregnant", label: "In-calf" },
];

export default function Animals() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const { data: animals = [], isLoading, isRefetching, error, refetch } = useAnimals();

  const list = useMemo(() => {
    let l = animals;
    if (filter !== "all") l = l.filter((a) => (a.repro || "").includes(filter));
    if (query) {
      const q = query.toLowerCase();
      l = l.filter((a) => a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
    }
    return l;
  }, [animals, filter, query]);

  // Group the filtered list by herd for the collapsible tree.
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

  const subtitle = animals.length ? `${animals.length} animals` : "";
  // Expand all groups while searching/filtering so matches are visible.
  const expanded = !!query || filter !== "all";

  return (
    <Screen
      title="Animals"
      subtitle={subtitle}
      onRefresh={() => refetch()}
      refreshing={isRefetching}
    >
      <View style={s.search}>
        <MaterialCommunityIcons name="magnify" size={18} color={c.textSubtle} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by tag or name"
          placeholderTextColor={c.textSubtle}
          style={s.input}
        />
      </View>
      <Chips>
        {FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </Chips>

      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorState text={extractFrappeError(error)} onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <Empty text="No animals match" />
      ) : (
        groups.map(([herd, herdAnimals]) => (
          <Collapsible
            key={`${herd}-${expanded}`}
            title={herd}
            meta={`${herdAnimals.length} head`}
            defaultOpen={expanded}
          >
            {herdAnimals.map((a) => (
              <AnimalRow
                key={a.id}
                a={a}
                onPress={() => router.push(`/(tabs)/animals/${encodeURIComponent(a.id)}`)}
              />
            ))}
          </Collapsible>
        ))
      )}
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
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
