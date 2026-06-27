/**
 * frontend の公開 API。`src/api/*.ts` はここから Tauri 互換 `invoke` を取り込む。
 * `@tauri-apps/api/core` の import をこの shim へ差し替えるだけで、コマンド名・
 * 引数はそのまま Deno Desktop の IPC ブリッジ経由でバックエンドへ届く。
 */

export { type FetchFn, invoke, type InvokeArgs } from "./invoke.ts";

export {
  currentWindowLabel,
  hashCode,
  MAIN_WINDOW_LABEL,
  windowLabelFromLocation,
  type WindowLocation,
} from "./windowLabel.ts";

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

export { openViewer, type OpenViewerInvokeFn } from "./viewer.ts";

export {
  ask,
  type AskOptions,
  type ConfirmFn,
  open,
  type OpenInvokeFn,
  type OpenOptions,
} from "./dialog.ts";

export {
  emit,
  type EmitInvokeFn,
  type EventCallback,
  type EventHost,
  listen,
  type TauriEvent,
} from "./event.ts";

export {
  Menu,
  type MenuAction,
  MenuHandle,
  type MenuHost,
  type MenuInvokeFn,
  MenuItem,
  type MenuItemNode,
  type MenuNode,
  type MenuPosition,
  PredefinedMenuItem,
  type SeparatorNode,
} from "./menu.ts";
