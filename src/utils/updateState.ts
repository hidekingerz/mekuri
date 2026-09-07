export type UpdateInfo = { version: string; notes: string | null };

export type UpdateState =
  | { status: "idle" }
  | { status: "checking"; manual: boolean }
  | { status: "upToDate" }
  | { status: "available"; update: UpdateInfo }
  | { status: "downloading"; update: UpdateInfo; downloaded: number; total: number | null }
  | { status: "ready"; update: UpdateInfo }
  | { status: "error"; message: string; retry: "check" | "install" | null; update?: UpdateInfo };

export type UpdateEvent =
  | { type: "CHECK_STARTED"; manual: boolean }
  | { type: "CHECK_FOUND"; update: UpdateInfo }
  | { type: "CHECK_NONE" }
  | { type: "CHECK_FAILED"; message: string }
  | { type: "DOWNLOAD_STARTED" }
  | { type: "DOWNLOAD_PROGRESS"; downloaded: number; total: number | null }
  | { type: "DOWNLOAD_FINISHED" }
  | { type: "DOWNLOAD_FAILED"; message: string }
  | { type: "RETRY_INSTALL" }
  | { type: "RELAUNCH_FAILED"; message: string }
  | { type: "DISMISS" };

export const INITIAL_UPDATE_STATE: UpdateState = { status: "idle" };

const IDLE: UpdateState = { status: "idle" };

/**
 * アップデート UI の状態遷移。副作用は持たず、無効な遷移は state をそのまま返す。
 * 自動確認 (manual: false) の失敗と「最新です」は何も表示せず idle に戻る。
 */
export function updateReducer(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.type) {
    case "CHECK_STARTED":
      if (state.status === "downloading" || state.status === "ready") return state;
      return { status: "checking", manual: event.manual };

    case "CHECK_FOUND":
      if (state.status !== "checking") return state;
      return { status: "available", update: event.update };

    case "CHECK_NONE":
      if (state.status !== "checking") return state;
      return state.manual ? { status: "upToDate" } : IDLE;

    case "CHECK_FAILED":
      if (state.status !== "checking") return state;
      return state.manual ? { status: "error", message: event.message, retry: "check" } : IDLE;

    case "DOWNLOAD_STARTED":
      if (state.status !== "available") return state;
      return { status: "downloading", update: state.update, downloaded: 0, total: null };

    case "DOWNLOAD_PROGRESS":
      if (state.status !== "downloading") return state;
      return { ...state, downloaded: event.downloaded, total: event.total };

    case "DOWNLOAD_FINISHED":
      if (state.status !== "downloading") return state;
      return { status: "ready", update: state.update };

    case "DOWNLOAD_FAILED":
      if (state.status !== "downloading") return state;
      return { status: "error", message: event.message, retry: "install", update: state.update };

    case "RETRY_INSTALL":
      if (state.status !== "error" || state.retry !== "install" || !state.update) return state;
      return { status: "available", update: state.update };

    case "RELAUNCH_FAILED":
      if (state.status !== "ready") return state;
      return { status: "error", message: event.message, retry: null };

    case "DISMISS":
      if (state.status === "available" || state.status === "upToDate" || state.status === "error") {
        return IDLE;
      }
      return state;
  }
}
