import { router } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { useAuthStore } from "@/src/auth/authStore";
import { applyHerdMoves, computePendingHerdMoves } from "@/src/frappe/herdTransitions";
import { useAnimals } from "@/src/hooks/useAnimals";
import { useHerds } from "@/src/hooks/useHerds";
import { useLivestockSettings } from "@/src/hooks/useLivestockSettings";
import { extractFrappeError } from "@/src/services/api";

export default function HerdsList() {
  const { data: herds = [], isLoading, isRefetching, error, refetch } = useHerds();
  const { data: animals = [] } = useAnimals();
  const { data: settings } = useLivestockSettings();
  const operator = useAuthStore((s) => s.employeeName);

  const [running, setRunning] = useState(false);

  const totalHead = herds.reduce((acc, h) => acc + (h.cnt || 0), 0);
  const subtitle = herds.length ? `${herds.length} herds · ${totalHead} animals` : "";

  const handleAgeTransitions = async () => {
    if (!operator) {
      Alert.alert("Sign-in required", "We need your employee ID to record the Movement events. Sign out and back in.");
      return;
    }
    let moves;
    try {
      moves = await computePendingHerdMoves();
    } catch (e: any) {
      Alert.alert("Could not read the ladder", e?.message || "Try again in a moment.");
      return;
    }
    if (moves.length === 0) {
      Alert.alert("No moves needed", "Every animal is on the rung the ladder puts it on.");
      return;
    }
    // Overdue first: forty animals ready to move must not bury the one that is
    // three months late.
    moves.sort((a, b) => Number(b.overdue) - Number(a.overdue));
    const preview = moves
      .slice(0, 10)
      .map((m) => `• ${m.label} (${m.fromHerd || "—"}) → ${m.toHerd}${m.overdue ? " — overdue" : ""}`)
      .join("\n");
    const more = moves.length > 10 ? `\n…and ${moves.length - 10} more.` : "";

    Alert.alert(
      `Move ${moves.length} animal${moves.length === 1 ? "" : "s"}?`,
      `${preview}${more}\n\nThis submits one Movement event per animal.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Apply",
          style: "default",
          onPress: async () => {
            setRunning(true);
            try {
              const results = await applyHerdMoves(moves, operator);
              const ok = results.filter((r) => r.ok).length;
              const failed = results.length - ok;
              Alert.alert(
                "Ladder moves complete",
                `${ok} moved${failed ? ` · ${failed} failed` : ""}.`,
              );
              refetch();
            } finally {
              setRunning(false);
            }
          },
        },
      ],
    );
  };

  // The ladder is a table, not three fields. One configured rung is enough for
  // the button to have something to do.
  const hasBucketsConfigured = (settings?.growth_ladder?.length ?? 0) > 0;

  return (
    <Screen
      title="Herds"
      subtitle={subtitle}
      back
      onRefresh={() => refetch()}
      refreshing={isRefetching}
    >
      {hasBucketsConfigured ? (
        <Button
          label={running ? "Running…" : "Run age transitions"}
          variant="outline"
          icon="arrow-left-right"
          disabled={running}
          loading={running}
          onPress={handleAgeTransitions}
        />
      ) : (
        <Banner tone="info">
          Configure weaning / weaner / bulling-heifer herds in Livestock Settings to enable
          automated age-bucket transitions.
        </Banner>
      )}

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
