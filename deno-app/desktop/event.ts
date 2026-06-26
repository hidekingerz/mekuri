/**
 * `event_*` コマンドのディスパッチ（Tauri の `@tauri-apps/api/event` 相当）の純粋ロジック。
 *
 * Tauri 版フロントは窓間 pub/sub に `emit(event, payload)` / `listen(event, handler)` を
 * 使っていた（ビューワー窓の `emit("file-trashed")` をメイン窓の FileList が `listen` で受け、
 * ファイル一覧を再読込する）。Deno Desktop には窓間イベント機構が無いため、webview→メインの
 * IPC（`bindings.invoke("event_emit", ...)`）でメインへ送り、メインから**全窓**へ
 * `executeJs` で配信する形に置き換える（webview 側の delivery hook は `frontend/event.ts`）。
 *
 * 本ファイルは `BroadcastTarget`（`Deno.BrowserWindow` のサブセット）の集合を受け取り
 * 配信する純粋関数で、`Deno.BrowserWindow` には依存しない（`main.ts` が実窓集合を注入する）
 * ため単体テスト可能。
 */

import type { InvokeArgs } from "../bindings/mod.ts";

/**
 * イベントを配信できる窓の最小インターフェース。`Deno.BrowserWindow` が構造的にこれを満たす。
 * `executeJs(code)` で webview の JS コンテキストへ delivery 用スニペットを実行する。
 */
export interface BroadcastTarget {
  executeJs(code: string): unknown;
}

/**
 * 各 webview の delivery hook（`frontend/event.ts` が `globalThis.__mekuriDeliverEvent` に
 * 設置）を呼ぶ JS スニペットを組み立てる。`event` / `payload` は JSON で埋め込み、フックが
 * 未設置（listen していない窓）でも安全に no-op になるよう存在チェック付き。
 */
export function deliverScript(event: string, payload: unknown): string {
  return `globalThis.__mekuriDeliverEvent&&globalThis.__mekuriDeliverEvent(${
    JSON.stringify(event)
  },${JSON.stringify(payload ?? null)})`;
}

/**
 * `event_*` コマンドを処理する。現状は窓間ブロードキャスト用の `event_emit` のみ対応。
 * `windows()` は配信時点で開いている全窓を返すサンク（`main.ts` がメイン窓＋開いている
 * ビューワー窓を供給する）。各窓へ delivery スニペットを `executeJs` で実行する。
 */
export async function handleEventCommand(
  windows: () => Iterable<BroadcastTarget>,
  command: string,
  args?: InvokeArgs,
): Promise<unknown> {
  if (command !== "event_emit") {
    throw new Error(`Unknown event command: ${command}`);
  }
  const event = args?.event;
  if (typeof event !== "string") {
    throw new Error("event_emit: 'event' must be a string");
  }
  const code = deliverScript(event, args?.payload ?? null);
  for (const win of windows()) {
    await win.executeJs(code);
  }
  return await null;
}
