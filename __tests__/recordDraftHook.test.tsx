import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { useRecordDraft } from "@/src/hooks/useRecordDraft";
import { useRecordDrafts } from "@/src/record/draft";

// useSegments() is the app's current route; the form's mockParams are its own.
let mockSegments: string[] = [];
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useSegments: () => mockSegments,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => {},
  router: { push: jest.fn(), back: jest.fn() },
}));

function Form({ kg }: { kg: string }) {
  useRecordDraft({ title: "Weight", state: { kg }, restore: () => {} });
  return null;
}

beforeEach(() => useRecordDrafts.setState({ draft: null }));

describe("Continue recording route", () => {
  it.each([
    [["(tabs)", "record", "events", "weight"], {}, "/(tabs)/record/events/weight"],
    [["(tabs)", "record", "events", "[type]"], { type: "vaccination" }, "/(tabs)/record/events/vaccination"],
    [["(tabs)", "animals", "act", "weight"], { animal: "A011/26" }, "/(tabs)/animals/act/weight?animal=A011%2F26"],
  ])("keeps the form's own route %j after a tab switch", (own, p, href) => {
    mockSegments = own;
    mockParams = p;
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<Form kg="312" />);
    });
    expect(useRecordDrafts.getState().draft?.href).toBe(href);

    // The user taps Profile: the form is still mounted (the tab pops after its
    // animation) and re-renders with the app's new mockSegments.
    act(() => useRecordDrafts.getState().markPending("record"));
    mockSegments = ["(tabs)", "profile"];
    act(() => r.update(<Form kg="313" />));

    const d = useRecordDrafts.getState().draft;
    expect(d?.href).toBe(href);
    expect(d?.key).toBe(href);
    expect(d?.state).toEqual({ kg: "313" });
  });
});
