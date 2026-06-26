import { assertEquals } from "@std/assert";
import { ask } from "./dialog.ts";

Deno.test("ask resolves to true when confirm accepts", async () => {
  const result = await ask("delete?", undefined, () => true);
  assertEquals(result, true);
});

Deno.test("ask resolves to false when confirm rejects", async () => {
  const result = await ask(
    "delete?",
    { title: "x", kind: "warning" },
    () => false,
  );
  assertEquals(result, false);
});

Deno.test("ask forwards the message to confirm and ignores options", async () => {
  let received: string | undefined;
  const result = await ask("move to trash", { kind: "warning" }, (msg) => {
    received = msg;
    return true;
  });
  assertEquals(received, "move to trash");
  assertEquals(result, true);
});

Deno.test("ask uses globalThis.confirm by default", async () => {
  const original = (globalThis as { confirm?: (m: string) => boolean }).confirm;
  let received: string | undefined;
  (globalThis as { confirm?: (m: string) => boolean }).confirm = (msg) => {
    received = msg;
    return true;
  };
  try {
    const result = await ask("default path");
    assertEquals(received, "default path");
    assertEquals(result, true);
  } finally {
    (globalThis as { confirm?: (m: string) => boolean }).confirm = original;
  }
});
