/**
 * ビューワー窓の生成と同一アーカイブ二重オープン防止の純粋ロジック（Desktop API 非依存）。
 *
 * Tauri 版（`src/App.tsx` の `handleArchiveSelect`）では、アーカイブ選択時に
 * パスから決定的な window label を作り、同 label の窓が既にあれば `setFocus` で
 * 前面化し（＝二重オープン防止）、無ければ `viewer.html?archive=...` を保存済み
 * ビューワーサイズで開いていた。ここではその導出とオーケストレーションを
 * `Deno.BrowserWindow` 非依存の純粋関数として実装し、単体テスト可能にする。
 * 実際の窓生成・focus・登録は `main.ts` が注入する（`backend`/`commands` 分離方針）。
 *
 * 注意: canary の `BrowserWindowOptions` には `minWidth`/`minHeight`/`visible` が無いため、
 * Tauri 版のビューワー最小サイズ（600x400）制約はここでは表現できない（未対応）。
 */

/** `src/utils/windowLabel.ts` の `hashCode` 相当（決定的ハッシュ）。 */
export function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/** アーカイブパスからビューワー窓の一意 label を作る（`src/utils/windowLabel.ts` 相当）。 */
export function viewerLabel(archivePath: string): string {
  return `viewer-${hashCode(archivePath)}`;
}

/** パスからファイル名を取り出す（クロスプラットフォーム、`src/utils/windowLabel.ts` 相当）。 */
export function fileNameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() || "Viewer";
}

/** ビューワー窓のタイトル（`src/App.tsx` の `${fileName} - mekuri` と一致）。 */
export function viewerWindowTitle(archivePath: string): string {
  return `${fileNameFromPath(archivePath)} - mekuri`;
}

/** ビューワー窓が開く相対 URL（`src/App.tsx` と一致。origin は `main.ts` が前置する）。 */
export function viewerUrl(archivePath: string): string {
  return `viewer.html?archive=${encodeURIComponent(archivePath)}`;
}

/**
 * `Deno.BrowserWindow` に渡すビューワー窓オプション（利用する部分集合・Desktop lib 非依存）。
 */
export interface ViewerWindowOptions {
  title: string;
  width: number;
  height: number;
  resizable: boolean;
}

/**
 * 保存済みビューワー設定（width/height）から、ビューワー窓のオプションを導出する。
 */
export function viewerWindowOptions(
  archivePath: string,
  settings: { width: number; height: number },
): ViewerWindowOptions {
  return {
    title: viewerWindowTitle(archivePath),
    width: settings.width,
    height: settings.height,
    resizable: true,
  };
}

/** focus 可能な窓ハンドル（`main.ts` が `Deno.BrowserWindow` をラップして渡す）。 */
export interface ViewerWindowHandle {
  focus: () => void;
}

/** `openViewer` が窓の探索・生成・設定取得を行うための注入依存。 */
export interface OpenViewerDeps {
  /** label に対応する開いている窓を返す。無ければ undefined（閉じた窓も undefined 扱い）。 */
  findWindow: (label: string) => ViewerWindowHandle | undefined;
  /** 窓を生成し navigate して label で登録する（生成した窓を返す必要はない）。 */
  createWindow: (
    label: string,
    options: ViewerWindowOptions,
    url: string,
  ) => void;
  /** 保存済みビューワー設定（width/height）を取得する。 */
  loadViewerSettings: () =>
    | { width: number; height: number }
    | Promise<{ width: number; height: number }>;
}

/**
 * アーカイブのビューワー窓を開く（二重オープン防止つき）。
 *
 * 既に同 label の窓があれば focus して終了（新規生成しない）。無ければ保存済み
 * サイズでオプションを導出し、`createWindow` で生成・登録する。`src/App.tsx` の
 * `handleArchiveSelect` と同じ振る舞い。
 */
export async function openViewer(
  archivePath: string,
  deps: OpenViewerDeps,
): Promise<void> {
  const label = viewerLabel(archivePath);

  const existing = deps.findWindow(label);
  if (existing) {
    existing.focus();
    return;
  }

  const settings = await deps.loadViewerSettings();
  const options = viewerWindowOptions(archivePath, settings);
  deps.createWindow(label, options, viewerUrl(archivePath));
}
