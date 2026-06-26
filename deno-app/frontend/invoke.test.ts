import { assertEquals, assertRejects } from "@std/assert";
import {
  type DesktopBindings,
  type FetchFn,
  invoke,
  type InvokeArgs,
} from "./invoke.ts";

/** 呼び出しを記録する mock bindings を作る（窓固有コマンド用＝bindings transport）。 */
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

/** `/__invoke` への fetch を記録し、与えた JSON を返す mock fetch を作る（HTTP transport 用）。 */
function mockFetch(
  responseBody: unknown,
  status = 200,
): {
  fetchFn: FetchFn;
  calls: Array<{ input: string; body: unknown }>;
} {
  const calls: Array<{ input: string; body: unknown }> = [];
  const fetchFn: FetchFn = (input, init) => {
    calls.push({
      input,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    return Promise.resolve(
      new Response(JSON.stringify(responseBody), { status }),
    );
  };
  return { fetchFn, calls };
}

// --- HTTP transport（窓非依存の data/store 系コマンド） ---

Deno.test("invoke posts command/args/windowLabel to /__invoke and returns the value", async () => {
  const { fetchFn, calls } = mockFetch({ ok: true, value: ["a.zip"] });
  const result = await invoke<string[]>(
    "read_directory",
    { path: "/tmp" },
    undefined,
    undefined,
    fetchFn,
    "main",
  );
  assertEquals(result, ["a.zip"]);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].input, "/__invoke");
  assertEquals(calls[0].body, {
    command: "read_directory",
    args: { path: "/tmp" },
    windowLabel: "main",
  });
});

Deno.test("invoke sends null args over HTTP when args are undefined", async () => {
  const { fetchFn, calls } = mockFetch({ ok: true, value: null });
  await invoke("ping", undefined, undefined, undefined, fetchFn, "main");
  assertEquals(calls[0].body, {
    command: "ping",
    args: null,
    windowLabel: "main",
  });
});

Deno.test("invoke routes window_* commands over HTTP with the window label", async () => {
  const { fetchFn, calls } = mockFetch({ ok: true, value: null });
  await invoke(
    "window_set_title",
    { title: "comic" },
    undefined,
    undefined,
    fetchFn,
    "viewer-nrc8jp",
  );
  assertEquals(calls[0].input, "/__invoke");
  assertEquals(calls[0].body, {
    command: "window_set_title",
    args: { title: "comic" },
    windowLabel: "viewer-nrc8jp",
  });
});

Deno.test("invoke returns the HTTP value typed as T", async () => {
  const { fetchFn } = mockFetch({ ok: true, value: { type: "Empty" } });
  const contents = await invoke<{ type: string }>(
    "analyze_archive_contents",
    { archivePath: "/a.zip" },
    undefined,
    undefined,
    fetchFn,
  );
  assertEquals(contents.type, "Empty");
});

Deno.test("invoke throws the error from an ok:false HTTP response", async () => {
  const { fetchFn } = mockFetch(
    { ok: false, error: "File does not exist: /missing" },
    500,
  );
  await assertRejects(
    () =>
      invoke(
        "read_file_base64",
        { path: "/missing" },
        undefined,
        undefined,
        fetchFn,
      ),
    Error,
    "File does not exist",
  );
});

Deno.test("invoke throws on a non-2xx HTTP response", async () => {
  const { fetchFn } = mockFetch({ ok: false, error: "bad request" }, 400);
  await assertRejects(
    () =>
      invoke("read_directory", { path: "/tmp" }, undefined, undefined, fetchFn),
    Error,
    "bad request",
  );
});

// --- bindings transport（未移行の event/menu 系コマンド） ---

Deno.test("invoke routes event_* commands through bindings.invoke", async () => {
  const { bindings, calls } = mockBindings("done");
  const result = await invoke<string>(
    "event_emit",
    { event: "file-trashed" },
    () => bindings,
  );
  assertEquals(result, "done");
  assertEquals(calls, [["event_emit", { event: "file-trashed" }]]);
});

Deno.test("invoke throws when bindings are not available for a menu command", async () => {
  await assertRejects(
    () =>
      invoke("menu_popup", undefined, () => {
        throw new Error("Deno Desktop bindings.invoke is not available");
      }),
    Error,
    "bindings.invoke is not available",
  );
});

Deno.test("invoke retries an event command while the binding is not yet registered", async () => {
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
    "event_emit",
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

Deno.test("invoke does not retry a menu command on a real backend error", async () => {
  // `No callback bound` 以外のエラーは即座に伝播する（リトライしない＝待機ゼロ）。
  let attempts = 0;
  const delays: number[] = [];
  const bindings: DesktopBindings = {
    invoke(_command, _args) {
      attempts++;
      return Promise.reject(new Error("menu error"));
    },
  };
  await assertRejects(
    () =>
      invoke("menu_popup", { x: 1 }, () => bindings, (ms) => {
        delays.push(ms);
        return Promise.resolve();
      }),
    Error,
    "menu error",
  );
  assertEquals(attempts, 1);
  assertEquals(delays.length, 0);
});
