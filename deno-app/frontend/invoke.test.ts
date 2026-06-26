import { assertEquals, assertRejects } from "@std/assert";
import { type DesktopBindings, invoke, type InvokeArgs } from "./invoke.ts";

/** 呼び出しを記録する mock bindings を作る。 */
function mockBindings(
  result: unknown,
): {
  bindings: DesktopBindings;
  calls: Array<[string, InvokeArgs | undefined]>;
} {
  const calls: Array<[string, InvokeArgs | undefined]> = [];
  const bindings: DesktopBindings = {
    invoke(command, args) {
      calls.push([command, args]);
      return Promise.resolve(result);
    },
  };
  return { bindings, calls };
}

Deno.test("invoke forwards command and args to bindings.invoke", async () => {
  const { bindings, calls } = mockBindings(["a.zip"]);
  const result = await invoke<string[]>(
    "read_directory",
    { path: "/tmp" },
    () => bindings,
  );
  assertEquals(result, ["a.zip"]);
  assertEquals(calls, [["read_directory", { path: "/tmp" }]]);
});

Deno.test("invoke passes undefined args through", async () => {
  const { bindings, calls } = mockBindings(null);
  await invoke("ping", undefined, () => bindings);
  assertEquals(calls, [["ping", undefined]]);
});

Deno.test("invoke returns the binding result typed as T", async () => {
  const { bindings } = mockBindings({ type: "Empty" });
  const contents = await invoke<{ type: string }>(
    "analyze_archive_contents",
    { archivePath: "/a.zip" },
    () => bindings,
  );
  assertEquals(contents.type, "Empty");
});

Deno.test("invoke throws when bindings are not available", async () => {
  await assertRejects(
    () =>
      invoke("read_directory", { path: "/tmp" }, () => {
        throw new Error("Deno Desktop bindings.invoke is not available");
      }),
    Error,
    "bindings.invoke is not available",
  );
});

Deno.test("default resolver throws when globalThis.bindings is missing", async () => {
  // globalThis.bindings is undefined under `deno test`, so the default resolver rejects.
  await assertRejects(
    () => invoke("read_directory", { path: "/tmp" }),
    Error,
    "bindings.invoke is not available",
  );
});

Deno.test("invoke retries while the binding is not yet registered, then succeeds", async () => {
  // 起動直後は main 側 bind が未登録で `No callback bound` を返す。bind 完了後に成功するはず。
  let attempts = 0;
  const delays: number[] = [];
  const bindings: DesktopBindings = {
    invoke(_command, _args) {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error("No callback bound for: invoke"));
      }
      return Promise.resolve("ready");
    },
  };
  const result = await invoke<string>(
    "window_show",
    undefined,
    () => bindings,
    (ms) => {
      delays.push(ms);
      return Promise.resolve();
    },
  );
  assertEquals(result, "ready");
  assertEquals(attempts, 3);
  // 2 回 reject したので待機は 2 回（最後の成功前まで）。
  assertEquals(delays.length, 2);
});

Deno.test("invoke does not retry on a real backend error", async () => {
  // `No callback bound` 以外のエラーは即座に伝播する（リトライしない＝待機ゼロ）。
  let attempts = 0;
  const delays: number[] = [];
  const bindings: DesktopBindings = {
    invoke(_command, _args) {
      attempts++;
      return Promise.reject(new Error("File does not exist: /missing"));
    },
  };
  await assertRejects(
    () =>
      invoke("read_file_base64", { path: "/missing" }, () => bindings, (ms) => {
        delays.push(ms);
        return Promise.resolve();
      }),
    Error,
    "File does not exist",
  );
  assertEquals(attempts, 1);
  assertEquals(delays.length, 0);
});
