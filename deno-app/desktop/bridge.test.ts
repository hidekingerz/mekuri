import { assertEquals, assertRejects } from "@std/assert";
import { handleInvoke, type InvokeFn, type StoreFn } from "./bridge.ts";

Deno.test("handleInvoke dispatches command and args to the invoke fn", async () => {
  const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
  const fake: InvokeFn = (command, args) => {
    calls.push({ command, args });
    return Promise.resolve(["ok"]);
  };

  const result = await handleInvoke(
    ["read_directory", { path: "/tmp" }],
    fake,
  );

  assertEquals(result, ["ok"]);
  assertEquals(calls, [{ command: "read_directory", args: { path: "/tmp" } }]);
});

Deno.test("handleInvoke passes undefined args when only a command is given", async () => {
  let received: unknown = "unset";
  const fake: InvokeFn = (_command, args) => {
    received = args;
    return Promise.resolve(null);
  };

  await handleInvoke(["some_command"], fake);

  assertEquals(received, undefined);
});

Deno.test("handleInvoke normalises a null args argument to undefined", async () => {
  let received: unknown = "unset";
  const fake: InvokeFn = (_command, args) => {
    received = args;
    return Promise.resolve(null);
  };

  await handleInvoke(["some_command", null], fake);

  assertEquals(received, undefined);
});

Deno.test("handleInvoke rejects when command is not a string", async () => {
  await assertRejects(
    () => handleInvoke([123, {}], () => Promise.resolve(null)),
    Error,
    "command must be a string",
  );
});

Deno.test("handleInvoke rejects when args is not an object", async () => {
  await assertRejects(
    () => handleInvoke(["cmd", "not-an-object"], () => Promise.resolve(null)),
    Error,
    "args must be an object",
  );
});

Deno.test("handleInvoke routes store_* commands to the store fn", async () => {
  const invokeCalls: string[] = [];
  const fakeInvoke: InvokeFn = (command) => {
    invokeCalls.push(command);
    return Promise.resolve(null);
  };
  const storeCalls: Array<{ command: string; args?: Record<string, unknown> }> =
    [];
  const fakeStore: StoreFn = (command, args) => {
    storeCalls.push({ command, args });
    return Promise.resolve("stored");
  };

  const result = await handleInvoke(
    ["store_get", { key: "favorites" }],
    fakeInvoke,
    fakeStore,
  );

  assertEquals(result, "stored");
  assertEquals(storeCalls, [{
    command: "store_get",
    args: { key: "favorites" },
  }]);
  assertEquals(invokeCalls, []);
});

Deno.test("handleInvoke routes non-store commands to the invoke fn when a store fn is present", async () => {
  const invokeCalls: string[] = [];
  const fakeInvoke: InvokeFn = (command) => {
    invokeCalls.push(command);
    return Promise.resolve(["ok"]);
  };
  const storeCalls: string[] = [];
  const fakeStore: StoreFn = (command) => {
    storeCalls.push(command);
    return Promise.resolve(null);
  };

  const result = await handleInvoke(
    ["read_directory", { path: "/tmp" }],
    fakeInvoke,
    fakeStore,
  );

  assertEquals(result, ["ok"]);
  assertEquals(invokeCalls, ["read_directory"]);
  assertEquals(storeCalls, []);
});

Deno.test("handleInvoke falls back to invoke for store_* when no store fn is given", async () => {
  const calls: string[] = [];
  const fakeInvoke: InvokeFn = (command) => {
    calls.push(command);
    return Promise.resolve(null);
  };

  await handleInvoke(["store_get", { key: "x" }], fakeInvoke);

  assertEquals(calls, ["store_get"]);
});

Deno.test("handleInvoke wires through to the real bindings invoke", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(`${dir}/a.zip`, "");
    const entries = await handleInvoke(["read_directory", {
      path: dir,
    }]) as Array<{ name: string }>;
    assertEquals(entries.map((e) => e.name), ["a.zip"]);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
