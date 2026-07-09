import { assertEquals, assertRejects } from "@std/assert";
import { openViewer } from "./viewer.ts";

Deno.test("openViewer sends open_viewer with the archive path via invoke", async () => {
  const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
  await openViewer("/tmp/book.zip", (command, args) => {
    calls.push({ command, args });
    return Promise.resolve(null);
  });
  assertEquals(calls, [
    { command: "open_viewer", args: { archivePath: "/tmp/book.zip" } },
  ]);
});

Deno.test("openViewer propagates errors from invoke", async () => {
  await assertRejects(
    () => openViewer("/tmp/book.zip", () => Promise.reject(new Error("boom"))),
    Error,
    "boom",
  );
});
