/**
 * フロント（webview）側の窓間イベントの入口（マイルストーン7）。
 *
 * Tauri 版は `@tauri-apps/api/event` の `listen`（受信）/`emit`（送信）で窓間 pub/sub を
 * 行っていた。Deno Desktop への移行では、webview 側で `invoke("event_emit")` とメインからの
 * `executeJs` 配信を Tauri 互換シグネチャで包んだ shim（`deno-app/frontend/event.ts`）を使う。
 * 境界をまたぐ import はこの 1 ファイルに局所化する。
 */

export type { EventCallback, TauriEvent } from "../../deno-app/frontend/event.ts";
export { emit, listen } from "../../deno-app/frontend/event.ts";
// main → webview の SSE push（窓間イベント delivery と menu クリック配送）を自窓 label で
// 購読する shim。起動時に 1 度呼び、窓クローズ時に解除関数を呼ぶ。
export { subscribeEvents } from "../../deno-app/frontend/events.ts";
