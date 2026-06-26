/**
 * frontend の公開 API。`src/api/*.ts` はここから Tauri 互換 `invoke` を取り込む。
 * `@tauri-apps/api/core` の import をこの shim へ差し替えるだけで、コマンド名・
 * 引数はそのまま Deno Desktop の IPC ブリッジ経由でバックエンドへ届く。
 */

export {
  type BindingsResolver,
  type DesktopBindings,
  invoke,
  type InvokeArgs,
} from "./invoke.ts";

export {
  load,
  type StoreInvoke,
  type StoreLoadOptions,
  WebviewStore,
} from "./store.ts";

export {
  AppWindow,
  getCurrentWindow,
  LogicalSize,
  type PhysicalSize,
  type ResizedEvent,
  type ResizeHandler,
  type ResizeTarget,
  type UnlistenFn,
  type WindowDeps,
} from "./window.ts";
