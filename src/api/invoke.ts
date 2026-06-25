/**
 * フロント（webview）側の IPC 入口（マイルストーン3）。
 *
 * Tauri 版は `@tauri-apps/api/core` の `invoke(command, args)` で Rust コマンドを
 * 呼んでいた。Deno Desktop への移行では、webview 側で `globalThis.bindings.invoke`
 * を Tauri 互換シグネチャで包んだ shim（`deno-app/frontend/invoke.ts`）を使う。
 *
 * `src/api/*.ts` はこのモジュールから `invoke` を import することで、コマンド名・
 * 引数を変えずにバックエンド（`deno-app/bindings` → `backend/`）へ橋渡しできる。
 * 境界をまたぐ import はこの 1 ファイルに局所化する（他の api は `./invoke` を見る）。
 */

export type {
  BindingsResolver,
  DesktopBindings,
  InvokeArgs,
} from "../../deno-app/frontend/invoke.ts";
export { invoke } from "../../deno-app/frontend/invoke.ts";
