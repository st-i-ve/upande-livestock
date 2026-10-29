import { useLocalSearchParams } from "expo-router";
import React, { type ComponentType } from "react";

import { Banner } from "@/components/Banner";
import { Screen } from "@/components/Screen";
import { Loader } from "@/components/Loader";
import { BackdateProvider } from "@/src/hooks/useBackdate";
import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";

import Calving from "../events/calving";
import Diagnosis from "../events/diagnosis";
import GenericEvent from "../events/[type]";
import Movement from "../events/movement";
import PD from "../events/pd";
import Service from "../events/service";
import Treatment from "../events/treatment";
import Weight from "../events/weight";

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
  movement: Movement,
  service: Service,
  pd: PD,
  calving: Calving,
  diagnosis: Diagnosis,
  treatment: Treatment,
  weight: Weight,
  vaccination: GenericEvent,
  deworming: GenericEvent,
  dehorning: GenericEvent,
  hoof: GenericEvent,
  heat: GenericEvent,
};

export default function Backdate() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const ScreenComponent = SCREENS[type ?? ""];
  const { open, ready } = useBackdatingWindow();

  // The window is the manager's to open (Livestock Settings -> Backdating Open).
  // Closed, there is no backdating form to reach, even by a stale link.
  if (!ready) {
    return (
      <Screen title="Backdate" back>
        <Loader />
      </Screen>
    );
  }
  if (!open) {
    return (
      <Screen title="Backdating is closed" back>
        <Banner tone="warning">
          Backdating is closed. Ask a manager to open it, or record this against today.
        </Banner>
      </Screen>
    );
  }

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
