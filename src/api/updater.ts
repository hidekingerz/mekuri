import { relaunch as processRelaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import {
  accumulateProgress,
  type DownloadProgress,
  INITIAL_PROGRESS,
} from "../utils/updateProgress";
import type { UpdateInfo } from "../utils/updateState";

export type AvailableUpdate = UpdateInfo;

// プラグインの Update は check() の結果に紐づくため、直近の結果をモジュール内に保持する。
let pending: Update | null = null;

/** 最新リリースを確認する。更新が無ければ null。 */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  const update = await check();
  pending = update;
  if (!update) return null;
  return { version: update.version, notes: update.body ?? null };
}

/** 直近の checkForUpdate で見つかった更新をダウンロードしてインストールする。 */
export async function downloadAndInstall(
  onProgress: (progress: DownloadProgress) => void,
): Promise<void> {
  if (!pending) {
    throw new Error("No update has been checked");
  }
  let progress = INITIAL_PROGRESS;
  await pending.downloadAndInstall((event) => {
    progress = accumulateProgress(progress, event);
    onProgress(progress);
  });
}

/** アプリを再起動して新バージョンを立ち上げる。 */
export async function relaunch(): Promise<void> {
  await processRelaunch();
}
