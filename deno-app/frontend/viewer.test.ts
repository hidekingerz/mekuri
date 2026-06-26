import { assertEquals, assertRejects } from "@std/assert";
import { openViewer, type ViewerBindings } from "./viewer.ts";

Deno.test("openViewer forwards the archive path to bindings.open_viewer", async () => {
  const calls: string[] = [];
  const bindings: ViewerBindings = {
    open_viewer: (archivePath) => {
      calls.push(archivePath);
      return Promise.resolve(null);
    },
  };
  await openViewer("/tmp/book.zip", () => bindings);
  assertEquals(calls, ["/tmp/book.zip"]);
});

Deno.test("openViewer rejects when Desktop bindings are unavailable", async () => {
  // 既定リゾルバ（resolver 省略）は `globalThis.bindings` を見る。テスト環境には
  // 注入されていないため、`open_viewer` が無い旨のエラーで reject する。
  await assertRejects(
    () => openViewer("/tmp/book.zip"),
    Error,
    "open_viewer is not available",
  );
});

Deno.test("openViewer propagates errors from the binding", async () => {
  await assertRejects(
    () =>
      openViewer("/tmp/book.zip", () => ({
        open_viewer: () => Promise.reject(new Error("boom")),
      })),
    Error,
    "boom",
  );
});
