import { assertEquals, assertRejects } from "@std/assert";
import {
  type BroadcastTarget,
  deliverScript,
  handleEventCommand,
} from "./event.ts";

function fakeWindows(sink: string[][]): {
  windows: () => BroadcastTarget[];
  add: () => void;
} {
  const targets: BroadcastTarget[] = [];
  const add = () => {
    const calls: string[] = [];
    sink.push(calls);
    targets.push({
      executeJs: (code) => {
        calls.push(code);
        return undefined;
      },
    });
  };
  return { windows: () => targets, add };
}

Deno.test("deliverScript embeds the event and payload as JSON", () => {
  assertEquals(
    deliverScript("file-trashed", null),
    'globalThis.__mekuriDeliverEvent&&globalThis.__mekuriDeliverEvent("file-trashed",null)',
  );
  assertEquals(
    deliverScript("ping", { n: 1 }),
    'globalThis.__mekuriDeliverEvent&&globalThis.__mekuriDeliverEvent("ping",{"n":1})',
  );
});

Deno.test("handleEventCommand broadcasts event_emit to every window", async () => {
  const sink: string[][] = [];
  const { windows, add } = fakeWindows(sink);
  add();
  add();

  const result = await handleEventCommand(windows, "event_emit", {
    event: "file-trashed",
  });

  assertEquals(result, null);
  const expected = deliverScript("file-trashed", null);
  assertEquals(sink, [[expected], [expected]]);
});

Deno.test("handleEventCommand forwards a provided payload", async () => {
  const sink: string[][] = [];
  const { windows, add } = fakeWindows(sink);
  add();

  await handleEventCommand(windows, "event_emit", {
    event: "ping",
    payload: { n: 2 },
  });

  assertEquals(sink, [[deliverScript("ping", { n: 2 })]]);
});

Deno.test("handleEventCommand re-reads the live window set at emit time", async () => {
  const sink: string[][] = [];
  const { windows, add } = fakeWindows(sink);
  add();
  // A window opened after the binding was created must still receive events.
  add();

  await handleEventCommand(windows, "event_emit", { event: "x" });

  assertEquals(sink.length, 2);
  assertEquals(sink[0].length, 1);
  assertEquals(sink[1].length, 1);
});

Deno.test("handleEventCommand rejects an unknown event command", async () => {
  await assertRejects(
    () => handleEventCommand(() => [], "event_unknown", {}),
    Error,
    "Unknown event command",
  );
});

Deno.test("handleEventCommand rejects when event name is not a string", async () => {
  await assertRejects(
    () => handleEventCommand(() => [], "event_emit", { event: 42 }),
    Error,
    "'event' must be a string",
  );
});
