/**
 * フロント（webview）側のビューワー窓生成の入口（マイルストーン7）。
 *
 * Tauri 版は `@tauri-apps/api/webviewWindow` の `WebviewWindow` でビューワー窓を生成し、
 * 同一アーカイブの二重オープンを防いでいた。Deno Desktop への移行では、その一連の処理を
 * メイン側 `open_viewer` バインディングへ集約し、webview 側はそれを包んだ shim
 * （`deno-app/frontend/viewer.ts`）を使う。境界をまたぐ import はこの 1 ファイルに局所化する。
 */

export { openViewer } from "../../deno-app/frontend/viewer.ts";
