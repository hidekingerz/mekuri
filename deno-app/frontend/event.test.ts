import { assertEquals } from "@std/assert";
import { emit, type EventHost, listen } from "./event.ts";

Deno.test("listen registers a handler invoked by the delivery hook", async () => {
  const host: EventHost = {};
  const received: Array<{ event: string; payload: unknown }> = [];
  await listen("file-trashed", (e) => received.push(e), host);

  host.__mekuriDeliverEvent?.("file-trashed", null);

  assertEquals(received, [{ event: "file-trashed", payload: null }]);
});

Deno.test("listen passes the payload through to the handler", async () => {
  const host: EventHost = {};
  let payload: unknown = "unset";
  await listen<{ n: number }>("ping", (e) => {
    payload = e.payload;
  }, host);

  host.__mekuriDeliverEvent?.("ping", { n: 7 });

  assertEquals(payload, { n: 7 });
});

Deno.test("unlisten removes the handler so it is no longer called", async () => {
  const host: EventHost = {};
  let count = 0;
  const unlisten = await listen("evt", () => count++, host);

  host.__mekuriDeliverEvent?.("evt", null);
  unlisten();
  host.__mekuriDeliverEvent?.("evt", null);

  assertEquals(count, 1);
});

Deno.test("delivery dispatches only to handlers of the matching event", async () => {
  const host: EventHost = {};
  let a = 0;
  let b = 0;
  await listen("a", () => a++, host);
  await listen("b", () => b++, host);

  host.__mekuriDeliverEvent?.("a", null);

  assertEquals(a, 1);
  assertEquals(b, 0);
});

Deno.test("multiple handlers for the same event are all called", async () => {
  const host: EventHost = {};
  let total = 0;
  await listen("x", () => (total += 1), host);
  await listen("x", () => (total += 10), host);

  host.__mekuriDeliverEvent?.("x", null);

  assertEquals(total, 11);
});

Deno.test("emit invokes event_emit with the event and payload", async () => {
  const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
  await emit("file-trashed", undefined, (command, args) => {
    calls.push({ command, args });
    return Promise.resolve(null);
  });

  assertEquals(calls, [{
    command: "event_emit",
    args: { event: "file-trashed", payload: null },
  }]);
});

Deno.test("emit forwards a provided payload", async () => {
  const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
  await emit("ping", { n: 3 }, (command, args) => {
    calls.push({ command, args });
    return Promise.resolve(null);
  });

  assertEquals(calls, [{
    command: "event_emit",
    args: { event: "ping", payload: { n: 3 } },
  }]);
});
