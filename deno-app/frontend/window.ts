/**
 * webview（フロント）側に置く Tauri 互換のウィンドウ shim（`@tauri-apps/api/window` 相当）。
 *
 * Tauri 版フロントは `getCurrentWindow()` で得た窓の `setSize(LogicalSize)` / `getSize` /
 * `setTitle` / `show` / `onResized` を使っていた。Deno Desktop ではこれらを `invoke("window_*")`
 * 経由で `main.ts` の `handleWindowCommand`（その webview 自身の窓を操作）へ橋渡しする。
 *
 * `backend/` を一切 import しないブラウザセーフなコードなので、`src/` の
 * `@tauri-apps/api/window` import をこの shim へ差し替えれば Vite ビルドを壊さない。
 * resize 検知は webview の DOM `resize` イベントで行い、実サイズは `window_get_size` で取得する
 * （Tauri の `onResized` は OS ウィンドウサイズを返すため、保存・復元の挙動を等価に保つ）。
 */

import { invoke as defaultInvoke, type InvokeArgs } from "./invoke.ts";

/** Tauri の `LogicalSize` 相当。`setSize` へ渡すサイズ値。 */
export class LogicalSize {
  readonly width: number;
  readonly height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

/** OS ウィンドウのサイズ（`window_get_size` の戻り値・`onResized` の payload）。 */
export interface PhysicalSize {
  width: number;
  height: number;
}

/** `onResized` ハンドラが受け取るイベント（Tauri 互換）。 */
export interface ResizedEvent {
  payload: PhysicalSize;
}

export type ResizeHandler = (event: ResizedEvent) => void | Promise<void>;
export type UnlistenFn = () => void;

/** テスト差し替え用の invoke 関数型。 */
export type InvokeFn = <T = unknown>(
  command: string,
  args?: InvokeArgs,
) => Promise<T>;

/** resize を購読する EventTarget の最小インターフェース（既定は webview の `globalThis`）。 */
export interface ResizeTarget {
  addEventListener(type: "resize", listener: () => void): void;
  removeEventListener(type: "resize", listener: () => void): void;
}

/** `getCurrentWindow` の依存（テストで invoke / resizeTarget を注入可能）。 */
export interface WindowDeps {
  invoke?: InvokeFn;
  resizeTarget?: ResizeTarget;
}

/** Tauri の `Window` 相当（`src/` が使うメソッドのみ）。 */
export class AppWindow {
  #invoke: InvokeFn;
  #resizeTarget: ResizeTarget;

  constructor(deps: WindowDeps = {}) {
    this.#invoke = deps.invoke ?? defaultInvoke;
    this.#resizeTarget = deps.resizeTarget ??
      (globalThis as unknown as ResizeTarget);
  }

  async setSize(size: { width: number; height: number }): Promise<void> {
    await this.#invoke("window_set_size", {
      width: size.width,
      height: size.height,
    });
  }

  getSize(): Promise<PhysicalSize> {
    return this.#invoke<PhysicalSize>("window_get_size");
  }

  async setTitle(title: string): Promise<void> {
    await this.#invoke("window_set_title", { title });
  }

  async show(): Promise<void> {
    await this.#invoke("window_show");
  }

  async close(): Promise<void> {
    await this.#invoke("window_close");
  }

  /**
   * ウィンドウのリサイズを購読する。DOM の `resize` イベントを契機に実 OS ウィンドウサイズを
   * `window_get_size` で取得し、Tauri 互換の `{ payload }` でハンドラへ渡す。
   * 戻り値の Promise は購読解除関数に解決する（Tauri の `onResized` と同シグネチャ）。
   */
  onResized(handler: ResizeHandler): Promise<UnlistenFn> {
    const listener = () => {
      void this.getSize().then((payload) => handler({ payload }));
    };
    this.#resizeTarget.addEventListener("resize", listener);
    return Promise.resolve(() => {
      this.#resizeTarget.removeEventListener("resize", listener);
    });
  }
}

/** Tauri 互換の `getCurrentWindow`。この webview に対応する窓ハンドルを返す。 */
export function getCurrentWindow(deps?: WindowDeps): AppWindow {
  return new AppWindow(deps);
}
