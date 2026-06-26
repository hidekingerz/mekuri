/**
 * webview ↔ Deno メイン間の invoke ブリッジ（Tauri の IPC 相当）の純粋ロジック。
 *
 * Deno Desktop では webview から `bindings.invoke(command, args)` を呼ぶと、メイン
 * プロセス側で `win.bind("invoke", handler)` に登録したハンドラが `(command, args)`
 * を受け取る。ここではそのハンドラの中身（引数検証＋ `bindings/` の invoke への
 * ディスパッチ）を Desktop API 非依存の純粋関数として実装し、単体テスト可能にする。
 * `Deno.BrowserWindow` には `main.ts` 側でのみ依存する。
 */

import { invoke as defaultInvoke, type InvokeArgs } from "../bindings/mod.ts";

/** invoke 互換のディスパッチ関数（既定は `bindings/` の invoke、テストで差し替え可能）。 */
export type InvokeFn = (
  command: string,
  args?: InvokeArgs,
) => Promise<unknown>;

/**
 * store コマンド（`store_*`）のディスパッチ関数。アプリ層が開いた `Store` インスタンスへ
 * バインドした `handleStoreCommand` を渡す（`bindings/store.ts`）。省略時は store コマンドも
 * 通常の invoke へ委譲される（`store_*` は `bindings/invoke.ts` 未対応のため Unknown command）。
 */
export type StoreFn = (
  command: string,
  args?: InvokeArgs,
) => Promise<unknown>;

/**
 * window コマンド（`window_*`）のディスパッチ関数。アプリ層が各ウィンドウ自身を束縛した
 * `handleWindowCommand` を渡す（`desktop/window.ts`）。省略時は window コマンドも通常の
 * invoke へ委譲される（`bindings/invoke.ts` 未対応のため Unknown command）。
 */
export type WindowFn = (
  command: string,
  args?: InvokeArgs,
) => Promise<unknown>;

/**
 * event コマンド（`event_*`）のディスパッチ関数。アプリ層が開いている全窓を束縛した
 * `handleEventCommand` を渡す（`desktop/event.ts`）。省略時は event コマンドも通常の
 * invoke へ委譲される（`bindings/invoke.ts` 未対応のため Unknown command）。
 */
export type EventFn = (
  command: string,
  args?: InvokeArgs,
) => Promise<unknown>;

/** store コマンドの接頭辞。これに一致するコマンドは `storeFn` へ振り分ける。 */
const STORE_COMMAND_PREFIX = "store_";

/** window コマンドの接頭辞。これに一致するコマンドは `windowFn` へ振り分ける。 */
const WINDOW_COMMAND_PREFIX = "window_";

/** event コマンドの接頭辞。これに一致するコマンドは `eventFn` へ振り分ける。 */
const EVENT_COMMAND_PREFIX = "event_";

/**
 * `invoke` バインディング呼び出しを処理する。
 *
 * webview が `bindings.invoke(command, args)` を呼ぶため、ハンドラの可変長引数は
 * `[command, argsObject?]` の並びで届く。型を検証してから invoke へ委譲する。
 * `window_*` コマンドは（`windowFn` が与えられていれば）その窓を操作する window ディスパッチャへ、
 * `store_*` コマンドは（`storeFn` が与えられていれば）ステートフルな store ディスパッチャへ、
 * `event_*` コマンドは（`eventFn` が与えられていれば）全窓へ配信する event ディスパッチャへ、
 * それ以外はステートレスな `invokeFn` へ振り分ける。戻り値は JSON 値（`unknown`）で、
 * `main.ts` 側で BrowserWindow の戻り値型へキャストする。
 */
export async function handleInvoke(
  rawArgs: readonly unknown[],
  invokeFn: InvokeFn = defaultInvoke,
  storeFn?: StoreFn,
  windowFn?: WindowFn,
  eventFn?: EventFn,
): Promise<unknown> {
  const command = rawArgs[0];
  if (typeof command !== "string") {
    throw new Error("invoke binding: command must be a string");
  }
  const args = rawArgs[1];
  if (args !== undefined && args !== null && typeof args !== "object") {
    throw new Error("invoke binding: args must be an object");
  }
  const normalised = (args ?? undefined) as InvokeArgs | undefined;
  if (windowFn && command.startsWith(WINDOW_COMMAND_PREFIX)) {
    return await windowFn(command, normalised);
  }
  if (storeFn && command.startsWith(STORE_COMMAND_PREFIX)) {
    return await storeFn(command, normalised);
  }
  if (eventFn && command.startsWith(EVENT_COMMAND_PREFIX)) {
    return await eventFn(command, normalised);
  }
  return await invokeFn(command, normalised);
}
