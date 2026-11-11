import React, { useEffect, useRef, useState } from "react";
import TestRenderer, { act } from "react-test-renderer";

import type { RetroDraft } from "@/src/breeding/birthWindow";
import { useRecordDraft } from "@/src/hooks/useRecordDraft";
import { calvingFilled, retroOnReset, type CalvingDraft, type HeldRetro } from "@/src/record/calvingDraft";
import { useRecordDrafts } from "@/src/record/draft";

jest.mock("expo-router", () => ({
  useSegments: () => ["(tabs)", "record", "events", "calving"],
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => {},
  router: { push: jest.fn(), back: jest.fn() },
}));

const blank: CalvingDraft = {
  dam: null,
  outcome: "Live Birth",
  abortionCause: "Unknown",
  coatNote: "",
  calves: [
    { key: 1, sex: "Female", burnName: "", birthWt: "", coat: "", health: "Healthy", herdPick: "", isStillborn: false, photo: null },
  ],
  day: "",
  retro: null,
  herdTouched: false,
  strawUom: "",
};

const retro: RetroDraft = {
  serviceDate: "2026-01-20",
  serviceType: "A.I.",
  straw: "SEMEN-ANGUS",
  strawWarehouse: "Stores - M",
  sire: "BULL 7",
  withDiagnosis: true,
  diagnosisDate: "2026-03-15",
  herd: "Cows 1",
};

describe("calvingFilled", () => {
  it("an untouched form is empty", () => expect(calvingFilled(blank)).toBe(false));
  it.each<[string, Partial<CalvingDraft>]>([
    ["a dam", { dam: { id: "A011/26" } }],
    ["an abortion", { outcome: "Abortion" }],
    ["a cause", { abortionCause: "Traumatic" }],
    ["notes", { coatNote: "found in the paddock" }],
    ["twins", { calves: [blank.calves[0], { ...blank.calves[0], key: 2 }] }],
    ["a calf name", { calves: [{ ...blank.calves[0], burnName: "BLOSSOM" }] }],
    ["a bull calf", { calves: [{ ...blank.calves[0], sex: "Male" }] }],
    ["a weak calf", { calves: [{ ...blank.calves[0], health: "Weak" }] }],
  ])("%s is input", (_, patch) => expect(calvingFilled({ ...blank, ...patch })).toBe(true));
});

describe("retroOnReset", () => {
  const held: HeldRetro = { dam: "A1", day: "2026-11-01", retro, herdTouched: true };
  it("gives the held retro path back for its own dam and day, once", () => {
    expect(retroOnReset(held, "A1", "2026-11-01")).toEqual({ retro, herdTouched: true, held: null });
  });
  it("keeps it while no dam is picked yet (the first render)", () => {
    expect(retroOnReset(held, null, "2026-11-11")).toEqual({ retro: null, herdTouched: false, held });
  });
  it("keeps it while her day has not caught up", () => {
    expect(retroOnReset(held, "A1", "2026-11-11").held).toBe(held);
  });
  it("another dam starts over", () => {
    expect(retroOnReset(held, "B2", "2026-11-01")).toEqual({ retro: null, herdTouched: false, held: null });
  });
  it("nothing held: a reset", () => {
    expect(retroOnReset(null, "A1", "2026-11-01")).toEqual({ retro: null, herdTouched: false, held: null });
  });
});

/** The Calving form's dam / retro wiring, in miniature: a dam change resets the retro path. */
let api: { pick: (id: string) => void; setRetro: (r: RetroDraft) => void; state: () => unknown };
function Calving({ day }: { day: string }) {
  const [dam, setDam] = useState<{ id: string } | null>(null);
  const [retroState, setRetro] = useState<RetroDraft | null>(null);
  const [herdTouched, setHerdTouched] = useState(false);
  const held = useRef<HeldRetro | null>(null);
  const draft = { ...blank, dam, day, retro: retroState, herdTouched };
  useRecordDraft({
    title: "Calving",
    state: draft,
    filled: calvingFilled(draft),
    restore: (d) => {
      held.current = d.dam ? { dam: d.dam.id, day: d.day, retro: d.retro, herdTouched: d.herdTouched } : null;
      setDam(d.dam);
    },
  });
  useEffect(() => {
    const r = retroOnReset(held.current, dam?.id ?? null, day);
    held.current = r.held;
    setRetro(r.retro);
    setHerdTouched(r.herdTouched);
  }, [dam, day]);
  api = { pick: (id) => setDam({ id }), setRetro, state: () => ({ dam, retro: retroState, herdTouched }) };
  return null;
}

describe("Continue recording a calving on the retro path", () => {
  beforeEach(() => useRecordDrafts.setState({ draft: null }));

  it("brings back the dam and the whole retro path", () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<Calving day="2026-11-01" />);
    });
    act(() => api.pick("A011/26"));
    act(() => api.setRetro(retro));
    expect(useRecordDrafts.getState().draft?.state).toMatchObject({ dam: { id: "A011/26" }, retro });

    // Left by a tab switch: the tab pops and the form unmounts; the draft stays.
    act(() => useRecordDrafts.getState().markPending("record"));
    act(() => r.unmount());
    expect(useRecordDrafts.getState().draft?.pending).toBe(true);

    // Continue recording: a fresh form, filled in, retro path and all.
    act(() => {
      r = TestRenderer.create(<Calving day="2026-11-01" />);
    });
    expect(api.state()).toEqual({ dam: { id: "A011/26" }, retro, herdTouched: false });
    expect(useRecordDrafts.getState().draft).toMatchObject({ pending: false, state: { retro } });

    // Picking another dam afterwards still starts the retro path over.
    act(() => api.pick("B2"));
    expect(api.state()).toEqual({ dam: { id: "B2" }, retro: null, herdTouched: false });
  });

  it("an emptied form leaves nothing to continue", () => {
    act(() => {
      TestRenderer.create(<Calving day="2026-11-01" />);
    });
    expect(useRecordDrafts.getState().draft).toBeNull();
  });
});
