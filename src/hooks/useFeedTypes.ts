import { useEffect, useState } from "react";

import type { FeedTypes } from "@/src/feed/feedTypes";
import { useBootstrap } from "@/src/hooks/useHerds";
import { feedTypesNow, loadFeedTypes, rememberFeedTypes } from "@/src/services/feedTypes";

/**
 * The feeding modes this farm shows on the phone (the bootstrap bundle's
 * `feed_types`). The last answer is kept on the phone, so menus stay filtered
 * offline.
 */
export function useFeedTypes(): FeedTypes {
  const { data } = useBootstrap();
  const [kept, setKept] = useState<FeedTypes>(feedTypesNow);
  useEffect(() => {
    let live = true;
    loadFeedTypes().then((ft) => live && setKept(ft));
    return () => {
      live = false;
    };
  }, []);
  const fresh = data?.feedTypes;
  const freshKey = fresh ? JSON.stringify(fresh) : null;
  useEffect(() => {
    if (fresh) rememberFeedTypes(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshKey]);
  return fresh ?? kept;
}
