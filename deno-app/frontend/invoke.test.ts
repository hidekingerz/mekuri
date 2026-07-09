import { assertEquals, assertRejects } from "@std/assert";
import { type FetchFn, invoke } from "./invoke.ts";

/** `/__invoke` への fetch を記録し、与えた JSON を返す mock fetch を作る（HTTP transport）。 */
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

Deno.test("invoke posts command/args/windowLabel to /__invoke and returns the value", async () => {
  const { fetchFn, calls } = mockFetch({ ok: true, value: ["a.zip"] });
  const result = await invoke<string[]>(
    "read_directory",
    { path: "/tmp" },
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
  await invoke("ping", undefined, fetchFn, "main");
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

Deno.test("invoke routes event_* commands over HTTP", async () => {
  const { fetchFn, calls } = mockFetch({ ok: true, value: null });
  await invoke(
    "event_emit",
    { event: "file-trashed", payload: null },
    fetchFn,
    "main",
  );
  assertEquals(calls[0].input, "/__invoke");
  assertEquals(calls[0].body, {
    command: "event_emit",
    args: { event: "file-trashed", payload: null },
    windowLabel: "main",
  });
});

Deno.test("invoke routes menu_* commands over HTTP with the window label", async () => {
  const { fetchFn, calls } = mockFetch({ ok: true, value: null });
  await invoke(
    "menu_popup",
    { x: 1, y: 2, items: [] },
    fetchFn,
    "viewer-nrc8jp",
  );
  assertEquals(calls[0].input, "/__invoke");
  assertEquals(calls[0].body, {
    command: "menu_popup",
    args: { x: 1, y: 2, items: [] },
    windowLabel: "viewer-nrc8jp",
  });
});

Deno.test("invoke returns the HTTP value typed as T", async () => {
  const { fetchFn } = mockFetch({ ok: true, value: { type: "Empty" } });
  const contents = await invoke<{ type: string }>(
    "analyze_archive_contents",
    { archivePath: "/a.zip" },
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
        fetchFn,
      ),
    Error,
    "File does not exist",
  );
});

Deno.test("invoke throws on a non-2xx HTTP response", async () => {
  const { fetchFn } = mockFetch({ ok: false, error: "bad request" }, 400);
  await assertRejects(
    () => invoke("read_directory", { path: "/tmp" }, fetchFn),
    Error,
    "bad request",
  );
});
