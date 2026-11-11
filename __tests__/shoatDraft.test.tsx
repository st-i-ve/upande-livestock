import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";

import { useRecordDrafts } from "@/src/record/draft";
import { useShoatDraft } from "@/src/shoats/useShoatDraft";

jest.mock("expo-router", () => ({
  useSegments: () => ["(shoats)", "record", "weigh"],
  useLocalSearchParams: () => ({ herd: "SHEEP-1" }),
  useFocusEffect: () => {},
  router: { push: jest.fn(), back: jest.fn() },
}));

let api: { type: (v: string) => void; klass: (v: string) => void; save: () => void; state: () => unknown };
function Weigh() {
  const [name, setName] = useState("SHEEP-1");
  const [picked, setPicked] = useState("");
  const [weighed, setWeighed] = useState("");
  const [klass, setKlass] = useState("");
  const draft = useShoatDraft({
    title: "Weigh sample",
    herd: { name, setName },
    day: { picked, setPicked },
    entry: { weighed, klass },
    filled: !!(weighed || klass),
    restore: (e) => {
      setWeighed(e.weighed);
      setKlass(e.klass);
    },
  });
  api = {
    type: setWeighed,
    klass: setKlass,
    save: () => {
      setWeighed("");
      draft.saved();
    },
    state: () => ({ name, picked, weighed }),
  };
  return null;
}

describe("Continue recording on a shoat screen", () => {
  beforeEach(() => useRecordDrafts.setState({ draft: null }));

  it("returns to the shoats route, herd and entry put back", () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<Weigh />);
    });
    // The herd it was opened for is not input.
    expect(useRecordDrafts.getState().draft).toBeNull();
    act(() => api.type("12"));
    expect(useRecordDrafts.getState().draft).toMatchObject({
      href: "/(shoats)/record/weigh?herd=SHEEP-1",
      title: "Weigh sample",
      state: { herd: "SHEEP-1", day: "", entry: { weighed: "12" } },
    });
    act(() => useRecordDrafts.getState().markPending("record"));
    act(() => r.unmount());
    act(() => {
      r = TestRenderer.create(<Weigh />);
    });
    expect(api.state()).toEqual({ name: "SHEEP-1", picked: "", weighed: "12" });
  });

  it("a save leaves nothing to continue, though fields kept for the next entry stay", () => {
    act(() => {
      TestRenderer.create(<Weigh />);
    });
    act(() => api.klass("Ewes"));
    act(() => api.type("12"));
    expect(useRecordDrafts.getState().draft).not.toBeNull();
    act(() => api.save());
    expect(useRecordDrafts.getState().draft).toBeNull();
    // The next entry is input again.
    act(() => api.type("9"));
    expect(useRecordDrafts.getState().draft?.state).toMatchObject({ entry: { weighed: "9", klass: "Ewes" } });
  });
});
