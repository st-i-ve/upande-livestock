import NetInfo from "@react-native-community/netinfo";
import * as Updates from "expo-updates";
import { useCallback, useState } from "react";

/**
 * Over-the-air update check for the running runtime.
 *
 * An update only ever replaces the JS bundle, and only one built for the same
 * `runtimeVersion` as the installed binary — anything needing new native code
 * (a new config plugin, a new native dependency) still needs a store build.
 * So a "no update" answer here does not mean the app is current in every
 * sense; it means nothing newer exists for this runtime.
 *
 * Three steps, deliberately not collapsed into one: check tells you whether
 * something exists, fetch downloads it, reload restarts into it. Restarting
 * without asking would discard whatever the operator was part-way through
 * typing, and this app is used one-handed at a milking parlour.
 */
export type OtaStage =
  | "idle"
  | "checking"
  | "none"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export type OtaState = {
  stage: OtaStage;
  message: string;
  /** True when the running build cannot receive updates at all. */
  disabled: boolean;
  runtimeVersion: string | null;
  /** Short id of the bundle currently running, or null when it is the one
   *  embedded in the binary. */
  updateId: string | null;
  check: () => Promise<void>;
  download: () => Promise<void>;
  apply: () => Promise<void>;
  reset: () => void;
};

const errText = (e: unknown, fallback: string) => {
  const m = (e as { message?: unknown })?.message;
  return typeof m === "string" && m ? m : fallback;
};

export const useOtaUpdate = (): OtaState => {
  const [stage, setStage] = useState<OtaStage>("idle");
  const [message, setMessage] = useState("");

  // Dev builds and simulators run the bundle off Metro, so there is nothing to
  // update and checkForUpdateAsync throws rather than returning false.
  const disabled = !Updates.isEnabled;

  const runtimeVersion =
    typeof Updates.runtimeVersion === "string" ? Updates.runtimeVersion : null;
  const updateId = typeof Updates.updateId === "string" ? Updates.updateId : null;

  const reset = useCallback(() => {
    setStage("idle");
    setMessage("");
  }, []);

  const check = useCallback(async () => {
    if (disabled) {
      setStage("error");
      setMessage(
        "This build cannot receive updates. Updates work in a release build, not in Expo Go or a dev client.",
      );
      return;
    }
    setStage("checking");
    setMessage("");
    try {
      // Asked before checking so being offline reads as "offline" rather than
      // as a failed fetch, which sends people looking for the wrong problem.
      const net = await NetInfo.fetch();
      if (!net.isConnected || net.isInternetReachable === false) {
        setStage("error");
        setMessage("No connection. Reconnect and try again.");
        return;
      }
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setStage("available");
        setMessage("An update is ready to download.");
      } else {
        setStage("none");
        setMessage("You are on the latest version for this runtime.");
      }
    } catch (e) {
      setStage("error");
      setMessage(errText(e, "Could not check for updates."));
    }
  }, [disabled]);

  const download = useCallback(async () => {
    setStage("downloading");
    setMessage("");
    try {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew) {
        setStage("ready");
        setMessage("Downloaded. Restart to finish.");
      } else {
        // The update vanished or matched what is already installed between the
        // check and the fetch.
        setStage("none");
        setMessage("Nothing new to install.");
      }
    } catch (e) {
      setStage("error");
      setMessage(errText(e, "Could not download the update."));
    }
  }, []);

  const apply = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch (e) {
      setStage("error");
      setMessage(errText(e, "Could not restart into the update."));
    }
  }, []);

  return {
    stage,
    message,
    disabled,
    runtimeVersion,
    updateId,
    check,
    download,
    apply,
    reset,
  };
};
