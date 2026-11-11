import {
  DOT_COLOR,
  DOT_PULSES,
  dotState,
  lastSyncedText,
  syncFraction,
  syncText,
} from "@/src/sync/syncStatus";
import { partsOf, useSyncStore } from "@/src/sync/syncStore";

describe("dotState", () => {
  it("is offline whenever the phone has no network, whatever else is going on", () => {
    expect(dotState({ online: false, live: "live", syncing: true })).toBe("offline");
    expect(dotState({ online: false, live: "offline", syncing: false })).toBe("offline");
  });

  it("is syncing while something syncs, even when live", () => {
    expect(dotState({ online: true, live: "live", syncing: true })).toBe("syncing");
    expect(dotState({ online: true, live: "reconnecting", syncing: true })).toBe("syncing");
  });

  it("is live when online and the live link is up", () => {
    expect(dotState({ online: true, live: "live", syncing: false })).toBe("live");
    // NetInfo not settled yet, but the socket is connected: it is online.
    expect(dotState({ online: null, live: "live", syncing: false })).toBe("live");
  });

  it("is connecting when online but the live link is not up", () => {
    expect(dotState({ online: true, live: "reconnecting", syncing: false })).toBe("connecting");
    expect(dotState({ online: true, live: "offline", syncing: false })).toBe("connecting");
  });

  it("is unknown before NetInfo answers and nothing else is known", () => {
    expect(dotState({ online: null, live: "offline", syncing: false })).toBe("unknown");
  });

  it("glows green when live, amber when syncing, steady otherwise", () => {
    expect(DOT_COLOR.live).toBe("#2ECC71");
    expect(DOT_COLOR.syncing).toBe(DOT_COLOR.connecting);
    expect(DOT_PULSES).toEqual({ live: true, syncing: true, connecting: false, offline: false, unknown: false });
  });
});

describe("syncText", () => {
  it("is empty when nothing syncs", () => {
    expect(syncText([])).toBe("");
  });

  it("says animals are syncing before the farm says how many", () => {
    expect(syncText([{ kind: "animals", done: 0, total: null }])).toBe("Syncing animals…");
  });

  it("counts animals once the size is known", () => {
    expect(syncText([{ kind: "animals", done: 120, total: 480 }])).toBe("Syncing 120 of 480 animals");
    expect(syncText([{ kind: "animals", done: 0, total: 1 }])).toBe("Syncing 0 of 1 animal");
  });

  it("numbers the photo going up", () => {
    expect(syncText([{ kind: "photos", done: 0, total: 1 }])).toBe("Uploading photo");
    expect(syncText([{ kind: "photos", done: 0, total: 2 }])).toBe("Uploading photo 1 of 2");
    expect(syncText([{ kind: "photos", done: 1, total: 2 }])).toBe("Uploading photo 2 of 2");
  });

  it("adds several kinds up as items, animals first", () => {
    expect(
      syncText([
        { kind: "photos", done: 1, total: 2 },
        { kind: "animals", done: 2, total: 5 },
      ]),
    ).toBe("Syncing 3 of 7 items · animals · photos");
    expect(
      syncText([
        { kind: "photos", done: 0, total: 1 },
        { kind: "animals", done: 0, total: null },
      ]),
    ).toBe("Syncing animals · photos");
  });
});

describe("syncFraction", () => {
  it("slides (null) while a size is unknown or nothing is done", () => {
    expect(syncFraction([])).toBeNull();
    expect(syncFraction([{ kind: "animals", done: 0, total: null }])).toBeNull();
    expect(syncFraction([{ kind: "photos", done: 0, total: 1 }])).toBeNull();
    expect(
      syncFraction([
        { kind: "animals", done: 10, total: 20 },
        { kind: "photos", done: 0, total: null },
      ]),
    ).toBeNull();
  });

  it("fills by what is done across every part", () => {
    expect(syncFraction([{ kind: "animals", done: 120, total: 480 }])).toBe(0.25);
    expect(
      syncFraction([
        { kind: "animals", done: 2, total: 5 },
        { kind: "photos", done: 1, total: 3 },
      ]),
    ).toBe(3 / 8);
    expect(syncFraction([{ kind: "animals", done: 9, total: 4 }])).toBe(1);
  });
});

describe("lastSyncedText", () => {
  const now = Date.UTC(2026, 10, 11, 12, 0, 0);
  it("says how long ago", () => {
    expect(lastSyncedText(null, now)).toBe("Animals not synced yet");
    expect(lastSyncedText(now - 10_000, now)).toBe("Animals synced just now");
    expect(lastSyncedText(now - 5 * 60_000, now)).toBe("Animals synced 5 min ago");
    expect(lastSyncedText(now - 3 * 3_600_000, now)).toBe("Animals synced 3 h ago");
  });
});

describe("sync store", () => {
  beforeEach(() => useSyncStore.setState({ parts: {}, animalsSyncedAt: null, animalsError: null }));

  it("follows an animals sync from asking to done", () => {
    const st = useSyncStore.getState();
    st.begin("animals");
    expect(partsOf(useSyncStore.getState().parts)).toEqual([{ kind: "animals", done: 0, total: null }]);
    st.progress("animals", 0, 50);
    st.progress("animals", 25);
    expect(syncText(partsOf(useSyncStore.getState().parts))).toBe("Syncing 25 of 50 animals");
    st.end("animals");
    st.animalsDone(true);
    expect(partsOf(useSyncStore.getState().parts)).toEqual([]);
    expect(useSyncStore.getState().animalsSyncedAt).not.toBeNull();
  });

  it("counts photos as they are added and goes when the last one is up", () => {
    const st = useSyncStore.getState();
    st.add("photos");
    st.add("photos");
    expect(syncText(partsOf(useSyncStore.getState().parts))).toBe("Uploading photo 1 of 2");
    st.tick("photos");
    expect(syncText(partsOf(useSyncStore.getState().parts))).toBe("Uploading photo 2 of 2");
    st.tick("photos");
    expect(partsOf(useSyncStore.getState().parts)).toEqual([]);
  });

  it("keeps the last failure until a sync succeeds", () => {
    const st = useSyncStore.getState();
    st.animalsDone(false, "Network Error");
    expect(useSyncStore.getState().animalsError).toBe("Network Error");
    st.animalsDone(true);
    expect(useSyncStore.getState().animalsError).toBeNull();
  });
});
