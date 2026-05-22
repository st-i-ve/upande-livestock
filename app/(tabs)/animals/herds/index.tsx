import { router } from "expo-router";
import React from "react";

import { Avatar } from "@/components/Avatar";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { extractFrappeError } from "@/src/services/api";
import { useHerds } from "@/src/hooks/useHerds";

export default function HerdsList() {
  const { data: herds = [], isLoading, isRefetching, error, refetch } = useHerds();

  const totalHead = herds.reduce((acc, h) => acc + (h.cnt || 0), 0);
  const subtitle = herds.length ? `${herds.length} herds · ${totalHead} animals` : "";

  return (
    <Screen
      title="Herds"
      subtitle={subtitle}
      back
      onRefresh={() => refetch()}
      refreshing={isRefetching}
    >
      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorState text={extractFrappeError(error)} onRetry={() => refetch()} />
      ) : herds.length === 0 ? (
        <Empty text="No herds found" />
      ) : (
        herds.map((h) => (
          <Row
            key={h.n}
            left={<Avatar icon="fence" />}
            title={h.n}
            meta={`${h.cat || "—"} · ${h.cnt} head${h.cc ? ` · ${h.cc}` : ""}`}
            chevron
            onPress={() => router.push(`/(tabs)/animals/herds/${encodeURIComponent(h.n)}`)}
          />
        ))
      )}
    </Screen>
  );
}
