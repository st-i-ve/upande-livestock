import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/**
 * Live network reachability. `null` while NetInfo is still figuring it out,
 * `true` if the device thinks it has internet, `false` otherwise.
 */
export const useNetworkStatus = (): boolean | null => {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    const apply = (state: NetInfoState) => {
      // `isInternetReachable` is the strict check; fall back to isConnected
      // when reachable hasn't resolved yet (Android sometimes leaves it null).
      const reachable = state.isInternetReachable;
      setOnline(reachable !== null ? reachable : !!state.isConnected);
    };
    NetInfo.fetch().then(apply);
    return NetInfo.addEventListener(apply);
  }, []);
  return online;
};
