import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import AnimalFeed from "@/components/feed/AnimalFeedScreen";
import FeedDay from "@/components/feed/FeedDayScreen";
import { Banner } from "@/components/Banner";
import { Chip, Chips } from "@/components/Chips";
import { Loader } from "@/components/Loader";
import { Screen } from "@/components/Screen";
import { useAuthStore } from "@/src/auth/authStore";
import { FEEDING_TABS, feedingScreenTabs, pickFeedingTab, type FeedingTab } from "@/src/feed/feedingTabs";
import { useFeedTypes } from "@/src/hooks/useFeedTypes";
import { storage } from "@/src/services/storage";

const KEY = "feeding_tab";

/**
 * Feeding: System, Manual configuration and Day sheet on one screen, as on the
 * desk. Only the tabs the farm switched on (Feed types) and the user's role
 * may use are shown. The last tab used is remembered; `?tab=` opens one.
 */
export default function Feeding() {
  const { tab: asked } = useLocalSearchParams<{ tab?: string }>();
  const feedTypes = useFeedTypes();
  const can = useAuthStore((st) => st.can);
  const shown = useMemo(() => feedingScreenTabs(feedTypes, can), [feedTypes, can]);
  const [remembered, setRemembered] = useState<string | null | undefined>(undefined);
  const [chosen, setChosen] = useState<FeedingTab | null>(null);

  useEffect(() => {
    let live = true;
    storage.getItem(KEY).then((v) => live && setRemembered(v ?? null), () => live && setRemembered(null));
    return () => {
      live = false;
    };
  }, []);

  const tab = chosen && shown.includes(chosen) ? chosen : pickFeedingTab(shown, asked, remembered);
  const choose = (t: FeedingTab) => {
    setChosen(t);
    storage.setItem(KEY, t);
  };

  const s = styles;
  if (remembered === undefined && !asked) {
    return (
      <Screen title="Feeding" back>
        <Loader />
      </Screen>
    );
  }
  if (!tab) {
    return (
      <Screen title="Feeding" back>
        <Banner tone="warning">
          No way of feeding is available to you on the phone. Ask a manager to turn one on in Livestock Settings, under Feeding, Feed types.
        </Banner>
      </Screen>
    );
  }

  const bar =
    shown.length > 1 ? (
      <View style={s.bar}>
        <Chips>
          {FEEDING_TABS.filter((t) => shown.includes(t.key)).map((t) => (
            <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => choose(t.key)} />
          ))}
        </Chips>
      </View>
    ) : null;

  return tab === "day_sheet" ? (
    <FeedDay bar={bar} />
  ) : (
    <AnimalFeed mode={tab} onMode={choose} bar={bar} />
  );
}

const styles = StyleSheet.create({ bar: { marginBottom: 8 } });
