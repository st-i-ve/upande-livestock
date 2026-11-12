import React, { createContext, type RefObject } from "react";
import type { View } from "react-native";
import { create } from "zustand";

/**
 * Where the connection dot sits on the focused tab's screen: the centre of its
 * slot, measured from the top left of the tab's scene (not the window, so the
 * page sliding in during a swipe never moves it). One screen owns it at a time.
 */
export type DotAnchor = { owner: string; x: number; y: number };

type DotAnchorState = {
  anchor: DotAnchor | null;
  claim: (a: DotAnchor) => void;
  release: (owner: string) => void;
};

export const useDotAnchor = create<DotAnchorState>((set, get) => ({
  anchor: null,
  claim: (a) => {
    const cur = get().anchor;
    if (cur && cur.owner === a.owner && cur.x === a.x && cur.y === a.y) return;
    set({ anchor: a });
  },
  // Only the owner can let go, so a page blurring after the next one claimed
  // the dot never hides it.
  release: (owner) => {
    if (get().anchor?.owner === owner) set({ anchor: null });
  },
}));

/** The tab scene's root view (TabSwipe), which slots measure themselves against. */
export const DotSceneContext = createContext<RefObject<React.ComponentRef<typeof View> | null> | null>(null);
