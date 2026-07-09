/**
 * webview（フロント）側に置く Tauri 互換のイベント shim（`@tauri-apps/api/event` 相当）。
 *
 * Tauri 版フロントは窓間 pub/sub に `listen(event, handler)`（受信）/`emit(event, payload)`
 * （送信）を使っていた。Deno Desktop ではこれを次の経路へ置き換える:
 * - `emit` → `invoke("event_emit", { event, payload })` でメインへ送り、メインが全窓へ配信。
 * - 配信はメインが `executeJs` で各 webview の `globalThis.__mekuriDeliverEvent(event, payload)`
 *   を呼ぶ（`desktop/event.ts`）。`listen` はそのフックへハンドラを登録するだけ。
 *
 * `backend/` を一切 import しないブラウザセーフなコードなので、`src/` の
 * `@tauri-apps/api/event` import をこの shim へ差し替えれば Vite ビルドを壊さない。
 */

import { invoke as defaultInvoke, type InvokeArgs } from "./invoke.ts";

/** Tauri の `Event<T>` 相当（`listen` ハンドラが受け取る）。 */
export interface TauriEvent<T = unknown> {
  event: string;
  payload: T;
}

export type EventCallback<T = unknown> = (event: TauriEvent<T>) => void;
export type UnlistenFn = () => void;

/** `emit` が使う invoke 関数型（テストで差し替え可能）。 */
export type EmitInvokeFn = (
  command: string,
  args?: InvokeArgs,
) => Promise<unknown>;

/**
 * delivery hook とハンドラ registry を載せるホスト（既定は webview の `globalThis`）。
 * メインプロセスが `executeJs` で `__mekuriDeliverEvent` を呼ぶことでイベントが届く。
 */
export interface EventHost {
  __mekuriEventHandlers?: Map<string, Set<EventCallback>>;
  __mekuriDeliverEvent?: (event: string, payload: unknown) => void;
}

function defaultHost(): EventHost {
  return globalThis as unknown as EventHost;
}

/**
 * ホストにハンドラ registry と delivery hook を用意する（初回のみ）。delivery hook は
 * 登録済みハンドラへ `{ event, payload }` を配る。配信中の `unlisten` に備えてスナップショット
 * （`[...set]`）を回す。
 */
function ensureRegistry(host: EventHost): Map<string, Set<EventCallback>> {
  const existing = host.__mekuriEventHandlers;
  if (existing) return existing;

  const handlers = new Map<string, Set<EventCallback>>();
  host.__mekuriEventHandlers = handlers;
  host.__mekuriDeliverEvent = (event, payload) => {
    const set = handlers.get(event);
    if (!set) return;
    for (const cb of [...set]) {
      cb({ event, payload });
    }
  };
  return handlers;
}

/**
 * Tauri 互換の `listen`。指定イベントのハンドラを registry へ登録し、購読解除関数に解決する
 * Promise を返す（Tauri の `listen` と同シグネチャ）。実配信はメインからの delivery hook 経由。
 */
export function listen<T = unknown>(
  event: string,
  handler: EventCallback<T>,
  host: EventHost = defaultHost(),
): Promise<UnlistenFn> {
  const handlers = ensureRegistry(host);
  let set = handlers.get(event);
  if (!set) {
    set = new Set<EventCallback>();
    handlers.set(event, set);
  }
  const target = set;
  const cb = handler as EventCallback;
  target.add(cb);
  return Promise.resolve(() => {
    target.delete(cb);
  });
}

/**
 * Tauri 互換の `emit`。`event_emit` コマンドでメインへ送り、メインが全窓へブロードキャストする。
 * payload 省略時は `null`（Tauri は undefined を許容するが JSON 配信に合わせて null 化）。
 */
export function emit(
  event: string,
  payload?: unknown,
  invokeFn: EmitInvokeFn = defaultInvoke,
): Promise<void> {
  return invokeFn("event_emit", { event, payload: payload ?? null }).then(
    () => {},
  );
}
