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

/** store コマンドの接頭辞。これに一致するコマンドは `storeFn` へ振り分ける。 */
const STORE_COMMAND_PREFIX = "store_";

/**
 * `invoke` バインディング呼び出しを処理する。
 *
 * webview が `bindings.invoke(command, args)` を呼ぶため、ハンドラの可変長引数は
 * `[command, argsObject?]` の並びで届く。型を検証してから invoke へ委譲する。
 * `store_*` コマンドは（`storeFn` が与えられていれば）ステートフルな store ディスパッチャへ、
 * それ以外はステートレスな `invokeFn` へ振り分ける。戻り値は JSON 値（`unknown`）で、
 * `main.ts` 側で BrowserWindow の戻り値型へキャストする。
 */
export async function handleInvoke(
  rawArgs: readonly unknown[],
  invokeFn: InvokeFn = defaultInvoke,
  storeFn?: StoreFn,
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
  if (storeFn && command.startsWith(STORE_COMMAND_PREFIX)) {
    return await storeFn(command, normalised);
  }
  return await invokeFn(command, normalised);
}
