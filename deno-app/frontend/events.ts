/**
 * webview（フロント）側に置く main → webview push の購読 shim。
 *
 * main は `Deno.serve` の `GET /__events?windowLabel=<label>` を SSE で配信し
 * （`desktop/pushHub.ts`）、窓間イベント（{@link EVENT_CHANNEL}）と menu クリック結果
 * （{@link MENU_CLICK_CHANNEL}）をこのチャネルで流す。本 shim は自窓 label で購読し、
 * 受信メッセージを channel で振り分けて `event.ts` / `menu.ts` が `globalThis` に用意した
 * フックへ渡す:
 *  - {@link EVENT_CHANNEL} → `__mekuriDeliverEvent(event, payload)`
 *  - {@link MENU_CLICK_CHANNEL} → `__mekuriMenuClick(id)`
 *
 * これにより `win.executeJs`/`win.bind` による main → webview push（採用窓に届かない）を
 * 全廃し、ビューワーの右クリックメニューと窓間イベントが実機で動作する。
 *
 * `backend/`・`desktop/` を一切 import しないブラウザセーフなコード（`src/` から呼べる）。
 * チャネル定数とパスは `desktop/pushHub.ts` と一致させること（値の一致は
 * `events.test.ts` で固定）。
 */

import { currentWindowLabel } from "./windowLabel.ts";

/** SSE 購読エンドポイントのパス（`desktop/pushHub.ts` の `EVENTS_PATH` と一致）。 */
export const EVENTS_PATH = "/__events";

/** 窓間イベントのチャネル名（`desktop/pushHub.ts` の `EVENT_CHANNEL` と一致）。 */
export const EVENT_CHANNEL = "event";

/** menu クリック結果のチャネル名（`desktop/pushHub.ts` の `MENU_CLICK_CHANNEL` と一致）。 */
export const MENU_CLICK_CHANNEL = "menuClick";

/**
 * 受信メッセージを配る先のフックを持つホスト（既定は webview の `globalThis`）。
 * `event.ts` の `listen`/`menu.ts` の `popup` が初回呼び出しで各フックを設置する。
 */
export interface PushDeliveryHost {
  __mekuriDeliverEvent?: (event: string, payload: unknown) => void;
  __mekuriMenuClick?: (id: string) => void;
}

/** `EventSource` の最小インターフェース（テストで差し替え可能）。 */
export interface EventSourceLike {
  onmessage: ((ev: { data: string }) => void) | null;
  close(): void;
}

/** 購読 URL から `EventSource` 相当を生成するファクトリ（テストで差し替え可能）。 */
export type EventSourceFactory = (url: string) => EventSourceLike;

function defaultFactory(url: string): EventSourceLike {
  return new EventSource(url) as unknown as EventSourceLike;
}

function defaultHost(): PushDeliveryHost {
  return globalThis as unknown as PushDeliveryHost;
}

/**
 * SSE で受信した 1 メッセージ（`PushMessage` の JSON 文字列）を channel で振り分け、
 * 対応するホストフックへ渡す（純粋・テスト可能）。不正な JSON・未知 channel・
 * 欠落フィールドは黙って無視する（壊れた配信で購読が落ちないように）。
 */
export function dispatchPushMessage(
  raw: string,
  host: PushDeliveryHost = defaultHost(),
): void {
  let message: { channel?: unknown; data?: unknown };
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  if (!message || typeof message.channel !== "string") return;

  if (message.channel === EVENT_CHANNEL) {
    const data = message.data as { event?: unknown; payload?: unknown };
    if (data && typeof data.event === "string") {
      host.__mekuriDeliverEvent?.(data.event, data.payload);
    }
    return;
  }

  if (message.channel === MENU_CLICK_CHANNEL) {
    const data = message.data as { id?: unknown };
    if (data && typeof data.id === "string") {
      host.__mekuriMenuClick?.(data.id);
    }
  }
}

/**
 * 自窓 label で `GET /__events` を購読し、受信を {@link dispatchPushMessage} で振り分ける。
 * 購読解除関数（`EventSource` を閉じる）を返す。起動時に 1 度呼び、窓クローズ時に解除する。
 */
export function subscribeEvents(
  windowLabel: string = currentWindowLabel(),
  factory: EventSourceFactory = defaultFactory,
  host: PushDeliveryHost = defaultHost(),
): () => void {
  const url = `${EVENTS_PATH}?windowLabel=${encodeURIComponent(windowLabel)}`;
  const source = factory(url);
  source.onmessage = (ev) => dispatchPushMessage(ev.data, host);
  return () => source.close();
}
