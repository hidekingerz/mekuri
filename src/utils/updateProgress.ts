export type DownloadProgress = { downloaded: number; total: number | null };

/** `@tauri-apps/plugin-updater` の DownloadEvent と構造互換。utils を Tauri に依存させないための型。 */
export type DownloadEventLike =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export const INITIAL_PROGRESS: DownloadProgress = { downloaded: 0, total: null };

/** ダウンロード進捗をパーセント表示用の整数に変換する。総量が不明・0 以下なら null。 */
export function downloadPercent(progress: DownloadProgress): number | null {
  const { downloaded, total } = progress;
  if (total === null || total <= 0) return null;
  return Math.min(100, Math.floor((downloaded / total) * 100));
}

/** updater プラグインのダウンロードイベントを累積して進捗にする。 */
export function accumulateProgress(
  prev: DownloadProgress,
  event: DownloadEventLike,
): DownloadProgress {
  switch (event.event) {
    case "Started":
      return { downloaded: 0, total: event.data.contentLength ?? null };
    case "Progress":
      return { ...prev, downloaded: prev.downloaded + event.data.chunkLength };
    case "Finished":
      return prev.total === null ? prev : { ...prev, downloaded: prev.total };
  }
}
