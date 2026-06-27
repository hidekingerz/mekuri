/**
 * webview（フロント）側に置くビューワー窓生成 shim（マイルストーン7）。
 *
 * Tauri 版フロント（`src/App.tsx` の `handleArchiveSelect`）は
 * `@tauri-apps/api/webviewWindow` の `WebviewWindow.getByLabel` / `new WebviewWindow`
 * でビューワー窓を開いていた（同一アーカイブの二重オープン防止つき）。Deno Desktop では
 * その一連の処理（label 算出・二重オープン防止・保存サイズでの生成・focus）を `main.ts` の
 * `open_viewer` ハンドラ（`desktop/viewer.ts` の純粋ロジックを注入）が内包する。
 *
 * 呼び出しは invoke の **HTTP transport**（`/__invoke` の `open_viewer` コマンド）で送る。
 * `globalThis.bindings.open_viewer` 直呼びは表示窓に届かず（`win.bind` が採用窓に届かない
 * canary の挙動）窓が開かないため、確実に届く HTTP 経路に乗せている。`backend/` を一切
 * import しないブラウザセーフなコード。
 */

import { invoke } from "./invoke.ts";

/** `open_viewer` を送る invoke 関数（テストで差し替え可能）。既定は HTTP transport の `invoke`。 */
export type OpenViewerInvokeFn = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

/**
 * アーカイブのビューワー窓を開く（二重オープン防止つき）。`src/App.tsx` の
 * `handleArchiveSelect` 相当。実際の label 算出・既存窓の focus・新規生成・サイズ復元は
 * メイン側 `open_viewer`（`desktop/viewer.ts`）が担う。
 *
 * 第2引数 `invokeFn` はテスト用で、`src/` 側は 1 引数で呼べる。
 */
export async function openViewer(
  archivePath: string,
  invokeFn: OpenViewerInvokeFn = invoke,
): Promise<void> {
  await invokeFn("open_viewer", { archivePath });
}
