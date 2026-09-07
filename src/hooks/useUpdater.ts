import { useCallback, useEffect, useReducer, useRef } from "react";
import { checkForUpdate, downloadAndInstall, relaunch } from "../api/updater";
import { errorToString } from "../utils/errorToString";
import { INITIAL_UPDATE_STATE, type UpdateState, updateReducer } from "../utils/updateState";

const AUTO_CHECK_DELAY_MS = 3000;
const UP_TO_DATE_DISMISS_MS = 3000;

export type UpdaterControls = {
  state: UpdateState;
  checkNow: () => void;
  install: () => void;
  restart: () => void;
  retry: () => void;
  dismiss: () => void;
};

/**
 * アプリ内アップデートの状態と操作。メインウィンドウでのみ使う。
 * マウント 3 秒後に自動確認を 1 回行う (失敗しても何も表示しない)。
 */
export function useUpdater(): UpdaterControls {
  const [state, dispatch] = useReducer(updateReducer, INITIAL_UPDATE_STATE);
  // 非同期処理の途中で最新の状態を参照するために ref に写す
  const stateRef = useRef(state);
  stateRef.current = state;

  const runCheck = useCallback(async (manual: boolean) => {
    const current = stateRef.current.status;
    if (current === "checking" || current === "downloading" || current === "ready") return;
    dispatch({ type: "CHECK_STARTED", manual });
    try {
      const update = await checkForUpdate();
      if (update) {
        dispatch({ type: "CHECK_FOUND", update });
      } else {
        dispatch({ type: "CHECK_NONE" });
      }
    } catch (err) {
      dispatch({ type: "CHECK_FAILED", message: errorToString(err) });
    }
  }, []);

  // 起動時の自動確認。StrictMode の二重実行はクリーンアップでタイマーを消すことで 1 回に抑える。
  useEffect(() => {
    const timer = setTimeout(() => {
      if (stateRef.current.status !== "idle") return;
      void runCheck(false);
    }, AUTO_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [runCheck]);

  // 「最新です」は数秒で消す
  useEffect(() => {
    if (state.status !== "upToDate") return;
    const timer = setTimeout(() => dispatch({ type: "DISMISS" }), UP_TO_DATE_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [state.status]);

  const checkNow = useCallback(() => {
    void runCheck(true);
  }, [runCheck]);

  const install = useCallback(() => {
    if (stateRef.current.status !== "available") return;
    dispatch({ type: "DOWNLOAD_STARTED" });
    void (async () => {
      try {
        await downloadAndInstall((p) => {
          dispatch({ type: "DOWNLOAD_PROGRESS", downloaded: p.downloaded, total: p.total });
        });
        dispatch({ type: "DOWNLOAD_FINISHED" });
      } catch (err) {
        dispatch({ type: "DOWNLOAD_FAILED", message: errorToString(err) });
      }
    })();
  }, []);

  const restart = useCallback(() => {
    if (stateRef.current.status !== "ready") return;
    void relaunch().catch((err) => {
      dispatch({ type: "RELAUNCH_FAILED", message: errorToString(err) });
    });
  }, []);

  const retry = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== "error") return;
    if (current.retry === "check") {
      void runCheck(true);
    } else if (current.retry === "install") {
      dispatch({ type: "RETRY_INSTALL" });
    }
  }, [runCheck]);

  const dismiss = useCallback(() => dispatch({ type: "DISMISS" }), []);

  return { state, checkNow, install, restart, retry, dismiss };
}
