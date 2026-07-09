/**
 * main → webview の **push チャネル**（Server-Sent Events）の純粋ロジック（M8b）。
 *
 * 背景: Deno Desktop の `win.executeJs(code)`／`win.bind` は、起動時に framework が
 * 自動オープン・自動遷移させる「表示窓」に届かない（計測で確定＝白画面の真因、
 * [m7:denidian-http-pivot]）。これは webview → main 方向だけでなく **main → webview**
 * 方向の配送も同じく不達にする。窓間イベント delivery（`handleEventCommand`）と
 * コンテキストメニューのクリック結果配送（menu）はこの main → webview の push を
 * 必要とするため、`executeJs` push の代わりに **`Deno.serve` 上の SSE エンドポイントを
 * webview が購読する**形へ移す。HTTP/SSE は窓に依存しないため確実に届く。
 *
 * 本ファイルは購読者を管理する pub/sub ハブ（`PushHub`）と SSE エンドポイントを処理する
 * 純粋関数（`handleEventsRequest`）で、`Deno.BrowserWindow` には依存しない（単体テスト可能）。
 * `Deno.serve` への配線（どの hub を渡すか）と、event/menu からの送信は `main.ts` が担う。
 */

/** SSE 購読エンドポイントのパス。`main.ts` の `Deno.serve` と `frontend` で共有する。 */
export const EVENTS_PATH = "/__events";

/** 窓間イベント（`event_emit` のブロードキャスト）を運ぶチャネル名。 */
export const EVENT_CHANNEL = "event";

/** コンテキストメニューのクリック結果（特定窓宛て）を運ぶチャネル名。 */
export const MENU_CLICK_CHANNEL = "menuClick";

/** push チャネルで main → webview へ流すメッセージ。`channel` で配送先 hook を選ぶ。 */
export interface PushMessage {
  channel: string;
  data: unknown;
}

/** 購読者へ 1 メッセージを届けるシンク（SSE では stream controller へ enqueue する）。 */
export type PushSink = (message: PushMessage) => void;

interface Subscriber {
  windowLabel: string;
  sink: PushSink;
}

/**
 * main → webview の push を購読者（窓ごと）へ配送する pub/sub ハブ。
 * `subscribe` で窓を登録し（解除関数を返す）、`broadcast` で全窓へ、`sendTo` で特定窓へ送る。
 */
export class PushHub {
  #subscribers = new Set<Subscriber>();

  /** 窓を購読登録し、解除関数を返す（SSE stream の cancel 時に呼ぶ）。 */
  subscribe(windowLabel: string, sink: PushSink): () => void {
    const subscriber: Subscriber = { windowLabel, sink };
    this.#subscribers.add(subscriber);
    return () => {
      this.#subscribers.delete(subscriber);
    };
  }

  /** 全購読窓へメッセージを送る（窓間イベント用）。 */
  broadcast(message: PushMessage): void {
    for (const subscriber of [...this.#subscribers]) {
      subscriber.sink(message);
    }
  }

  /** 指定 label の窓へのみメッセージを送る（menu クリック結果用）。 */
  sendTo(windowLabel: string, message: PushMessage): void {
    for (const subscriber of [...this.#subscribers]) {
      if (subscriber.windowLabel === windowLabel) {
        subscriber.sink(message);
      }
    }
  }

  /** 現在の購読窓数（テスト・診断用）。 */
  get subscriberCount(): number {
    return this.#subscribers.size;
  }
}

/** `PushMessage` を SSE のイベント行（`data: <json>\n\n`）へ整形する。 */
export function formatSse(message: PushMessage): string {
  return `data: ${JSON.stringify(message)}\n\n`;
}

/**
 * `GET /__events?windowLabel=<label>` を処理し、SSE ストリームを返す純粋関数。
 *
 * webview は自窓 label（`frontend/windowLabel.ts` の `currentWindowLabel()`）を載せて購読する。
 * `windowLabel` が欠落・空なら 400。購読は `hub.subscribe` で登録し、stream の `cancel`
 * （webview 切断・窓クローズ時）で解除する。`/__invoke`（webview → main）と対になる経路。
 */
export function handleEventsRequest(req: Request, hub: PushHub): Response {
  const url = new URL(req.url);
  const windowLabel = url.searchParams.get("windowLabel");
  if (!windowLabel) {
    return Response.json(
      { ok: false, error: "events request: windowLabel query is required" },
      { status: 400 },
    );
  }
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      unsubscribe = hub.subscribe(windowLabel, (message) => {
        controller.enqueue(encoder.encode(formatSse(message)));
      });
    },
    cancel() {
      unsubscribe();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}
