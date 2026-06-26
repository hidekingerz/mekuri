import { assertEquals } from "@std/assert";
import { handleInvokeRequest, INVOKE_PATH } from "./httpInvoke.ts";

/** `POST /__invoke` 相当の Request を作る。 */
function invokeRequest(body: string): Request {
  return new Request(`http://127.0.0.1${INVOKE_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

Deno.test("handleInvokeRequest dispatches command/args and returns the value", async () => {
  const calls: Array<[string, unknown]> = [];
  const res = await handleInvokeRequest(
    invokeRequest(
      JSON.stringify({ command: "read_directory", args: { path: "/tmp" } }),
    ),
    (command, args) => {
      calls.push([command, args]);
      return Promise.resolve(["a.zip"]);
    },
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true, value: ["a.zip"] });
  assertEquals(calls, [["read_directory", { path: "/tmp" }]]);
});

Deno.test("handleInvokeRequest normalises missing args to undefined", async () => {
  const calls: Array<[string, unknown]> = [];
  await handleInvokeRequest(
    invokeRequest(JSON.stringify({ command: "ping" })),
    (command, args) => {
      calls.push([command, args]);
      return Promise.resolve(null);
    },
  );
  assertEquals(calls, [["ping", undefined]]);
});

Deno.test("handleInvokeRequest returns null value for undefined results", async () => {
  const res = await handleInvokeRequest(
    invokeRequest(
      JSON.stringify({ command: "trash_file", args: { path: "/x" } }),
    ),
    () => Promise.resolve(undefined),
  );
  assertEquals(await res.json(), { ok: true, value: null });
});

Deno.test("handleInvokeRequest rejects invalid JSON body with 400", async () => {
  const res = await handleInvokeRequest(invokeRequest("not json"), () => {
    throw new Error("should not dispatch");
  });
  assertEquals(res.status, 400);
  assertEquals((await res.json()).ok, false);
});

Deno.test("handleInvokeRequest rejects a non-string command with 400", async () => {
  const res = await handleInvokeRequest(
    invokeRequest(JSON.stringify({ command: 42 })),
    () => {
      throw new Error("should not dispatch");
    },
  );
  assertEquals(res.status, 400);
});

Deno.test("handleInvokeRequest rejects non-object args with 400", async () => {
  const res = await handleInvokeRequest(
    invokeRequest(JSON.stringify({ command: "read_directory", args: "oops" })),
    () => {
      throw new Error("should not dispatch");
    },
  );
  assertEquals(res.status, 400);
});

Deno.test("handleInvokeRequest reports dispatch errors as 500 with the message", async () => {
  const res = await handleInvokeRequest(
    invokeRequest(
      JSON.stringify({
        command: "read_file_base64",
        args: { path: "/missing" },
      }),
    ),
    () => Promise.reject(new Error("File does not exist: /missing")),
  );
  assertEquals(res.status, 500);
  assertEquals(await res.json(), {
    ok: false,
    error: "File does not exist: /missing",
  });
});
