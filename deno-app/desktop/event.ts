/**
 * `event_*` コマンドのディスパッチ（Tauri の `@tauri-apps/api/event` 相当）の純粋ロジック。
 *
 * Tauri 版フロントは窓間 pub/sub に `emit(event, payload)` / `listen(event, handler)` を
 * 使っていた（ビューワー窓の `emit("file-trashed")` をメイン窓の FileList が `listen` で受け、
 * ファイル一覧を再読込する）。Deno Desktop には窓間イベント機構が無いため、webview→メインの
 * IPC（`fetch("/__invoke")` の `event_emit`）でメインへ送り、メインから**全窓**へ配信する。
 *
 * 配信経路は当初 `executeJs` push だったが、framework の採用した表示窓に届かない
 * （[m7:denidian-http-pivot]）ため、`Deno.serve` 上の SSE push チャネル（`PushHub`）への
 * ブロードキャストへ移行した。webview 側は `/__events` を購読して `__mekuriDeliverEvent`
 * へ配送する（購読 shim は `frontend`）。
 *
 * 本ファイルは `PushHub` の `broadcast` だけに依存する純粋関数で、`Deno.BrowserWindow` には
 * 依存しない（`main.ts` が実 hub を注入する）ため単体テスト可能。
 */

import type { InvokeArgs } from "../bindings/mod.ts";
import { EVENT_CHANNEL, type PushMessage } from "./pushHub.ts";

/**
 * 窓間イベントを全購読窓へ配信できる最小インターフェース（`PushHub` が構造的に満たす）。
 * テストでは記録用のフェイク hub を注入できる。
 */
export interface EventBroadcaster {
  broadcast(message: PushMessage): void;
}

/**
 * `event_*` コマンドを処理する。現状は窓間ブロードキャスト用の `event_emit` のみ対応。
 * `event` 名と `payload` を `EVENT_CHANNEL` 上のメッセージとして `hub.broadcast` で全購読窓へ
 * 送る（webview 側 SSE 購読 shim が `__mekuriDeliverEvent(event, payload)` へ配送する）。
 */
export async function handleEventCommand(
  hub: EventBroadcaster,
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
  hub.broadcast({
    channel: EVENT_CHANNEL,
    data: { event, payload: args?.payload ?? null },
  });
  return await null;
}
