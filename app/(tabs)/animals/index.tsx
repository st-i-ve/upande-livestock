import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { AnimalRow } from "@/components/AnimalRow";
import { Chip, Chips } from "@/components/Chips";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { Screen } from "@/components/Screen";
import { COLORS, RADIUS } from "@/constants/theme";
import { extractFrappeError } from "@/src/services/api";
import { useAnimals } from "@/src/hooks/useAnimals";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "Lactating", label: "Lactating" },
  { id: "Heifer", label: "Heifers" },
  { id: "Calf", label: "Calves" },
  { id: "Pregnant", label: "In-calf" },
];

export default function Animals() {
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

  const subtitle = animals.length ? `${animals.length} animals` : "";

  return (
    <Screen
      title="Animals"
      subtitle={subtitle}
      onRefresh={() => refetch()}
      refreshing={isRefetching}
    >
      <View style={s.search}>
        <MaterialCommunityIcons name="magnify" size={16} color={COLORS.textSubtle} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by tag or name"
          placeholderTextColor={COLORS.textSubtle}
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
        list.map((a) => (
          <AnimalRow key={a.id} a={a} onPress={() => router.push(`/(tabs)/animals/${encodeURIComponent(a.id)}`)} />
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginBottom: 10,
  },
  input: { flex: 1, fontSize: 13, color: COLORS.text, padding: 0 },
});
