import { assertEquals, assertExists } from "@std/assert";
import {
  EVENTS_PATH,
  formatSse,
  handleEventsRequest,
  PushHub,
  type PushMessage,
} from "./pushHub.ts";

function eventsRequest(query: string): Request {
  return new Request(`http://127.0.0.1${EVENTS_PATH}${query}`);
}

Deno.test("PushHub.broadcast delivers to every subscriber", () => {
  const hub = new PushHub();
  const a: PushMessage[] = [];
  const b: PushMessage[] = [];
  hub.subscribe("main", (m) => a.push(m));
  hub.subscribe("viewer-1", (m) => b.push(m));
  const msg: PushMessage = { channel: "event", data: { event: "x" } };
  hub.broadcast(msg);
  assertEquals(a, [msg]);
  assertEquals(b, [msg]);
});

Deno.test("PushHub.sendTo delivers only to the matching windowLabel", () => {
  const hub = new PushHub();
  const main: PushMessage[] = [];
  const viewer: PushMessage[] = [];
  hub.subscribe("main", (m) => main.push(m));
  hub.subscribe("viewer-1", (m) => viewer.push(m));
  const msg: PushMessage = { channel: "menuClick", data: "toggle-spread" };
  hub.sendTo("viewer-1", msg);
  assertEquals(main, []);
  assertEquals(viewer, [msg]);
});

Deno.test("PushHub.subscribe returns an unsubscribe that stops delivery", () => {
  const hub = new PushHub();
  const received: PushMessage[] = [];
  const unsubscribe = hub.subscribe("main", (m) => received.push(m));
  assertEquals(hub.subscriberCount, 1);
  unsubscribe();
  assertEquals(hub.subscriberCount, 0);
  hub.broadcast({ channel: "event", data: null });
  assertEquals(received, []);
});

Deno.test("formatSse emits a single SSE data frame", () => {
  const msg: PushMessage = {
    channel: "event",
    data: { event: "file-trashed" },
  };
  assertEquals(formatSse(msg), `data: ${JSON.stringify(msg)}\n\n`);
});

Deno.test("handleEventsRequest rejects a missing windowLabel with 400", async () => {
  const hub = new PushHub();
  const res = handleEventsRequest(eventsRequest(""), hub);
  assertEquals(res.status, 400);
  assertEquals((await res.json()).ok, false);
  assertEquals(hub.subscriberCount, 0);
});

Deno.test("handleEventsRequest rejects an empty windowLabel with 400", async () => {
  const hub = new PushHub();
  const res = handleEventsRequest(eventsRequest("?windowLabel="), hub);
  assertEquals(res.status, 400);
  assertEquals((await res.json()).ok, false);
});

Deno.test("handleEventsRequest streams broadcast messages as SSE then unsubscribes on cancel", async () => {
  const hub = new PushHub();
  const res = handleEventsRequest(eventsRequest("?windowLabel=main"), hub);
  assertEquals(res.headers.get("content-type"), "text/event-stream");
  assertEquals(hub.subscriberCount, 1);
  assertExists(res.body);
  const reader = res.body.getReader();

  const msg: PushMessage = {
    channel: "event",
    data: { event: "file-trashed", payload: null },
  };
  hub.broadcast(msg);
  const { value } = await reader.read();
  assertExists(value);
  assertEquals(new TextDecoder().decode(value), formatSse(msg));

  await reader.cancel();
  assertEquals(hub.subscriberCount, 0);
});

Deno.test("handleEventsRequest sendTo only reaches the targeted window stream", async () => {
  const hub = new PushHub();
  const mainRes = handleEventsRequest(eventsRequest("?windowLabel=main"), hub);
  const viewerRes = handleEventsRequest(
    eventsRequest("?windowLabel=viewer-1"),
    hub,
  );
  assertExists(mainRes.body);
  assertExists(viewerRes.body);
  const mainReader = mainRes.body.getReader();
  const viewerReader = viewerRes.body.getReader();

  const msg: PushMessage = { channel: "menuClick", data: "close-window" };
  hub.sendTo("viewer-1", msg);
  const { value } = await viewerReader.read();
  assertExists(value);
  assertEquals(new TextDecoder().decode(value), formatSse(msg));

  await mainReader.cancel();
  await viewerReader.cancel();
  assertEquals(hub.subscriberCount, 0);
});
