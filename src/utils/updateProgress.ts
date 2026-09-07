export type DownloadProgress = { downloaded: number; total: number | null };

/** `@tauri-apps/plugin-updater` の DownloadEvent と構造互換。utils を Tauri に依存させないための型。 */
export type DownloadEventLike =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export const INITIAL_PROGRESS: DownloadProgress = { downloaded: 0, total: null };

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
