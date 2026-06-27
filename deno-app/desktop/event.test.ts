import { assertEquals, assertRejects } from "@std/assert";
import { type EventBroadcaster, handleEventCommand } from "./event.ts";
import { EVENT_CHANNEL, PushHub, type PushMessage } from "./pushHub.ts";

function recordingHub(): { hub: EventBroadcaster; messages: PushMessage[] } {
  const messages: PushMessage[] = [];
  return { hub: { broadcast: (m) => messages.push(m) }, messages };
}

Deno.test("handleEventCommand broadcasts event_emit on the event channel", async () => {
  const { hub, messages } = recordingHub();

  const result = await handleEventCommand(hub, "event_emit", {
    event: "file-trashed",
  });

  assertEquals(result, null);
  assertEquals(messages, [
    { channel: EVENT_CHANNEL, data: { event: "file-trashed", payload: null } },
  ]);
});

Deno.test("handleEventCommand forwards a provided payload", async () => {
  const { hub, messages } = recordingHub();

  await handleEventCommand(hub, "event_emit", {
    event: "ping",
    payload: { n: 2 },
  });

  assertEquals(messages, [
    { channel: EVENT_CHANNEL, data: { event: "ping", payload: { n: 2 } } },
  ]);
});

Deno.test("handleEventCommand reaches every subscribed window via the hub", async () => {
  const hub = new PushHub();
  const received: PushMessage[][] = [[], []];
  hub.subscribe("main", (m) => received[0].push(m));
  hub.subscribe("viewer-1", (m) => received[1].push(m));

  await handleEventCommand(hub, "event_emit", { event: "x" });

  assertEquals(received[0].length, 1);
  assertEquals(received[1].length, 1);
});

Deno.test("handleEventCommand rejects an unknown event command", async () => {
  const { hub } = recordingHub();
  await assertRejects(
    () => handleEventCommand(hub, "event_unknown", {}),
    Error,
    "Unknown event command",
  );
});

Deno.test("handleEventCommand rejects when event name is not a string", async () => {
  const { hub } = recordingHub();
  await assertRejects(
    () => handleEventCommand(hub, "event_emit", { event: 42 }),
    Error,
    "'event' must be a string",
  );
});
