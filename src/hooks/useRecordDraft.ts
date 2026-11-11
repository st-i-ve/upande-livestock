import { router, useFocusEffect, useLocalSearchParams, useSegments } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Alert } from "react-native";

import { draftHref, hasInput, useRecordDrafts } from "@/src/record/draft";

/**
 * Keeps a record form's input when the user leaves it by switching tabs, and
 * puts it back when they return through "Continue recording".
 *
 *   useRecordDraft({ title: "Weight", state: { selected, entries }, restore: (s) => { ... } })
 *
 * `state` is what to keep (plain values, the screen's own useState values);
 * `restore` sets them back. `filled` says whether there is anything worth
 * keeping; left out, any non-blank value in `state` counts, except the animal a
 * quick action opened the form for (`preset`). The key is the screen's route
 * and params, so the same form for another animal is another record.
 *
 * Opening a different record while one is pending asks whether to discard it.
 */
export function useRecordDraft<S extends Record<string, unknown>>({
  title,
  state,
  restore,
  filled,
  preset,
}: {
  title: string;
  state: S;
  restore: (s: S) => void;
  filled?: boolean;
  preset?: string | null;
}): { clear: () => void } {
  const segments = useSegments() as string[];
  const params = useLocalSearchParams() as Record<string, string | string[] | undefined>;
  const key = draftHref(segments, params);

  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  // Skip one sync after a restore: that render still holds the empty form.
  const skipSync = useRef(false);
  // Waiting for the answer about another pending record: write nothing meanwhile.
  const blocked = useRef(false);

  useLayoutEffect(() => {
    const store = useRecordDrafts.getState();
    const d = store.draft;
    skipSync.current = false;
    blocked.current = false;
    if (!d || !d.pending) return;
    if (d.key === key) {
      restoreRef.current(d.state as S);
      store.resume(key);
      skipSync.current = true;
      return;
    }
    blocked.current = true;
    Alert.alert(
      "Unfinished record",
      `You left a ${d.title} record unsaved. Discard it and start this one?`,
      [
        {
          text: `Back to ${d.title}`,
          onPress: () => {
            router.back();
            router.push(d.href as never);
          },
        },
        {
          text: "Discard it",
          style: "destructive",
          onPress: () => {
            useRecordDrafts.getState().clear(d.key);
            blocked.current = false;
          },
        },
      ],
      { cancelable: false },
    );
  }, [key]);

  const has = filled ?? hasInput(state, preset);

  // Mirror the form into the store on every render (a cheap object swap).
  useEffect(() => {
    if (blocked.current) return;
    if (skipSync.current) {
      skipSync.current = false;
      return;
    }
    const store = useRecordDrafts.getState();
    if (has) store.save({ key, href: key, title, state });
    else store.dropLive(key);
  });

  // Back on screen without having been unmounted (the tab did not pop): live again.
  useFocusEffect(
    useCallback(() => {
      useRecordDrafts.getState().resume(key);
    }, [key]),
  );

  // Gone without a tab switch (back, saved, the Record tab's own menu): nothing to keep.
  useEffect(() => () => useRecordDrafts.getState().dropLive(key), [key]);

  return { clear: useCallback(() => useRecordDrafts.getState().clear(key), [key]) };
}
