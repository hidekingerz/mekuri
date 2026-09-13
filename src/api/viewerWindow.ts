import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { VIEWER_MIN_HEIGHT, VIEWER_MIN_WIDTH } from "../utils/constants";
import { fileNameFromPath, viewerLabel } from "../utils/windowLabel";
import { getViewerSettings } from "./settings";

/** アーカイブ/PDF のビューワーウィンドウを開く。同じファイルが既に開いていればフォーカスする。 */
export async function openViewerWindow(archivePath: string): Promise<void> {
  const label = viewerLabel(archivePath);

  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const viewerSettings = await getViewerSettings();
  const webview = new WebviewWindow(label, {
    url: `viewer.html?archive=${encodeURIComponent(archivePath)}`,
    title: `${fileNameFromPath(archivePath)} - mekuri`,
    width: viewerSettings.width,
    height: viewerSettings.height,
    minWidth: VIEWER_MIN_WIDTH,
    minHeight: VIEWER_MIN_HEIGHT,
    visible: true,
    // Tauri のネイティブ drag-drop 横取りを無効化しないと、
    // webview 内の HTML5 D&D（ファイル移動）が発火しない
    dragDropEnabled: false,
  });
  webview.once("tauri://error", (e) => {
    console.error("Failed to create viewer window:", e);
  });
}
