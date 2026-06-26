/**
 * desktop 層の公開 API（Desktop API 非依存の純粋ロジックのみ）。
 * `main.ts` はここから取り込み、`Deno.BrowserWindow` への配線だけを担う。
 * 新しいモジュールを追加したらここから re-export し、`deno check desktop/mod.ts`
 * で型検査される状態を保つ。
 */

export {
  type EventFn,
  handleInvoke,
  type InvokeFn,
  type MenuFn,
  type StoreFn,
  type WindowFn,
} from "./bridge.ts";
export { errorForwarderScript } from "./errorForwarder.ts";
export {
  handleInvokeRequest,
  INVOKE_PATH,
  type InvokeDispatch,
} from "./httpInvoke.ts";
export {
  type BroadcastTarget,
  deliverScript,
  handleEventCommand,
} from "./event.ts";
export {
  type ContextMenuWindow,
  extractMenuClickId,
  handleMenuCommand,
  menuClickScript,
  type NativeMenuItem,
  type SerializedMenuItem,
  toNativeMenuItems,
} from "./menu.ts";
export { type ControllableWindow, handleWindowCommand } from "./window.ts";
export {
  MAIN_WINDOW_TITLE,
  type MainWindowOptions,
  mainWindowOptions,
} from "./windowConfig.ts";
export {
  fileNameFromPath,
  hashCode,
  openViewer,
  type OpenViewerDeps,
  viewerLabel,
  viewerUrl,
  type ViewerWindowHandle,
  type ViewerWindowOptions,
  viewerWindowOptions,
  viewerWindowTitle,
} from "./viewer.ts";
