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
