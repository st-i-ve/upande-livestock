import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, Text } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { useColors } from "@/src/hooks/useColors";
import { extractFrappeError } from "@/src/services/api";
import { LABEL, useAnimalType } from "@/src/shoats/animalType";
import { useShoatHerds } from "@/src/shoats/hooks";
import { classSummary } from "@/src/shoats/logic";

export default function ShoatHerds() {
  const c = useColors();
  const type = useAnimalType((s) => s.type);
  const { data: herds = [], isLoading, isRefetching, error, refetch } = useShoatHerds();
  const total = herds.reduce((a, h) => a + h.head, 0);
  const noun = type === "goats" ? "herds" : "flocks";

  return (
    <Screen
      title={`${type ? LABEL[type] : "Shoats"} ${noun}`}
      subtitle={herds.length ? `${herds.length} ${noun} · ${total} head` : undefined}
      onRefresh={() => refetch()}
      refreshing={isRefetching}
      headerRight={
        <Pressable
          onPress={() => router.push("/choose")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Switch animal type"
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <MaterialCommunityIcons name="swap-horizontal" size={20} color={c.text} />
          <Text style={{ color: c.text, fontSize: 13 }}>{type ? LABEL[type] : "Type"}</Text>
        </Pressable>
      }
    >
      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorState text={extractFrappeError(error)} onRetry={() => refetch()} />
      ) : herds.length === 0 ? (
        <Empty text={`No ${type === "goats" ? "goat herds" : "sheep flocks"} found`} />
      ) : (
        herds.map((h) => (
          <Row
            key={h.name}
            left={<Avatar icon="sheep" />}
            title={h.label}
            meta={`${h.head} head${h.classes.length ? ` · ${classSummary(h.classes)}` : ""}`}
            chevron
            onPress={() => router.push(`/(shoats)/herds/${encodeURIComponent(h.name)}`)}
          />
        ))
      )}
    </Screen>
  );
}
