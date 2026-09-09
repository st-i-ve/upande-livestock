import { useLocalSearchParams } from "expo-router";
import React, { type ComponentType } from "react";

import { Banner } from "@/components/Banner";
import { Screen } from "@/components/Screen";
import { BackdateProvider } from "@/src/hooks/useBackdate";

import Calving from "../events/calving";
import Diagnosis from "../events/diagnosis";
import Dryoff from "../events/dryoff";
import GenericEvent from "../events/[type]";
import Movement from "../events/movement";
import PD from "../events/pd";
import Service from "../events/service";

/**
 * Not a form of its own. This route maps `type` to the SAME screen component
 * the live route renders (`record/events/<type>`), wrapped in
 * `BackdateProvider` so that screen renders its backdate banner, its date
 * picker, and threads the picked date into its own submit instead of
 * `todayISO()`. Keys match each screen's own live route slug — the generic
 * `record/events/[type]` screen's `useLocalSearchParams` reads the same
 * `type` param this route does, so its internal `SPECS` lookup (`weight`,
 * `vaccination`, ...) resolves correctly with no extra plumbing.
 */
const SCREENS: Record<string, ComponentType> = {
  dryoff: Dryoff,
  movement: Movement,
  service: Service,
  pd: PD,
  calving: Calving,
  diagnosis: Diagnosis,
  weight: GenericEvent,
  vaccination: GenericEvent,
  deworming: GenericEvent,
  dehorning: GenericEvent,
  hoof: GenericEvent,
  heat: GenericEvent,
};

export default function Backdate() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const ScreenComponent = SCREENS[type ?? ""];

  if (!ScreenComponent) {
    return (
      <Screen title="Unknown event" back>
        <Banner tone="warning">No backdating form configured for &quot;{type}&quot;.</Banner>
      </Screen>
    );
  }

  return (
    <BackdateProvider>
      <ScreenComponent />
    </BackdateProvider>
  );
}
