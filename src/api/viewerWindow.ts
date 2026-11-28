import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { currentMonitor } from "@tauri-apps/api/window";
import { VIEWER_MIN_HEIGHT, VIEWER_MIN_WIDTH } from "../utils/constants";
import { cascadePositions } from "../utils/windowCascade";
import { appTitle, fileNameFromPath, viewerLabel } from "../utils/windowLabel";
import { getViewerSettings } from "./settings";

type WindowPosition = { x: number; y: number };

/**
 * アーカイブ/PDF のビューワーウィンドウを開く。同じファイルが既に開いていればフォーカスする。
 * position を渡すとその位置（論理ピクセル）に開く。
 */
export async function openViewerWindow(
  archivePath: string,
  position?: WindowPosition,
): Promise<void> {
  const label = viewerLabel(archivePath);

  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const viewerSettings = await getViewerSettings();
  const webview = new WebviewWindow(label, {
    url: `viewer.html?archive=${encodeURIComponent(archivePath)}`,
    title: appTitle(fileNameFromPath(archivePath)),
    width: viewerSettings.width,
    height: viewerSettings.height,
    ...position,
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

/**
 * 複数のファイルをまとめて開く。2 件以上のときは、重なって隠れないよう
 * ウィンドウを少しずつ右下へずらして並べる。
 */
export async function openViewerWindows(archivePaths: string[]): Promise<void> {
  const positions = archivePaths.length > 1 ? await viewerCascade(archivePaths.length) : null;
  for (const [i, path] of archivePaths.entries()) {
    await openViewerWindow(path, positions?.[i]);
  }
}

/** いまの画面の作業領域に、ビューワーを count 枚ずらして並べる位置。画面が分からなければ null。 */
async function viewerCascade(count: number): Promise<WindowPosition[] | null> {
  try {
    const monitor = await currentMonitor();
    if (!monitor) return null;
    const { width, height } = await getViewerSettings();
    const { position, size } = monitor.workArea;
    const scale = monitor.scaleFactor;
    return cascadePositions(
      count,
      {
        x: position.x / scale,
        y: position.y / scale,
        width: size.width / scale,
        height: size.height / scale,
      },
      { width, height },
    );
  } catch (err) {
    console.error("Failed to read the current monitor:", err);
    return null;
  }
}
