/**
 * webview（フロント）側に置くビューワー窓生成 shim（マイルストーン7）。
 *
 * Tauri 版フロント（`src/App.tsx` の `handleArchiveSelect`）は
 * `@tauri-apps/api/webviewWindow` の `WebviewWindow.getByLabel` / `new WebviewWindow`
 * でビューワー窓を開いていた（同一アーカイブの二重オープン防止つき）。Deno Desktop では
 * その一連の処理（label 算出・二重オープン防止・保存サイズでの生成・focus）を `main.ts` の
 * `open_viewer` バインディング（`desktop/viewer.ts` の純粋ロジックを注入）が内包する。
 *
 * この shim はその webview 側 API（`globalThis.bindings.open_viewer`）を 1 関数で包む。
 * `backend/` を一切 import しないブラウザセーフなコードなので、`src/App.tsx` の
 * `@tauri-apps/api/webviewWindow` import をこれへ差し替えれば Vite ビルドを壊さずに
 * メインプロセスのビューワー窓生成へ橋渡しできる（`frontend/invoke.ts` と同パターン）。
 */

/** Deno Desktop が webview グローバルへ注入する open_viewer バインディングの最小型。 */
export interface ViewerBindings {
  open_viewer(archivePath: string): Promise<unknown>;
}

/** webview グローバルから bindings を解決する関数（テストで差し替え可能）。 */
export type ViewerBindingsResolver = () => ViewerBindings;

/** 既定の解決: `globalThis.bindings`（Deno Desktop が注入）を返す。 */
const defaultResolver: ViewerBindingsResolver = () => {
  const bindings = (globalThis as { bindings?: ViewerBindings }).bindings;
  if (!bindings || typeof bindings.open_viewer !== "function") {
    throw new Error(
      "Deno Desktop bindings.open_viewer is not available (run inside `deno desktop`)",
    );
  }
  return bindings;
};

/**
 * アーカイブのビューワー窓を開く（二重オープン防止つき）。`src/App.tsx` の
 * `handleArchiveSelect` 相当。実際の label 算出・既存窓の focus・新規生成・サイズ復元は
 * メイン側 `open_viewer` バインディングが担う（`desktop/viewer.ts`）。
 *
 * 第2引数 `resolver` はテスト用で、`src/` 側は 1 引数で呼べる。
 */
export async function openViewer(
  archivePath: string,
  resolver: ViewerBindingsResolver = defaultResolver,
): Promise<void> {
  await resolver().open_viewer(archivePath);
}
