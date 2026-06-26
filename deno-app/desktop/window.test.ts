import { assertEquals, assertRejects } from "@std/assert";
import { type ControllableWindow, handleWindowCommand } from "./window.ts";

function fakeWindow(size: [number, number] = [800, 600]) {
  const calls: string[] = [];
  let title = "";
  let current = size;
  const win: ControllableWindow = {
    setSize(width, height) {
      calls.push(`setSize:${width}x${height}`);
      current = [width, height];
    },
    getSize() {
      calls.push("getSize");
      return current;
    },
    setTitle(value) {
      calls.push(`setTitle:${value}`);
      title = value;
    },
    show() {
      calls.push("show");
    },
    close() {
      calls.push("close");
    },
  };
  return {
    win,
    calls,
    get title() {
      return title;
    },
  };
}

Deno.test("window_set_size forwards width and height to the window", async () => {
  const { win, calls } = fakeWindow();
  const result = await handleWindowCommand(win, "window_set_size", {
    width: 1000,
    height: 700,
  });
  assertEquals(result, null);
  assertEquals(calls, ["setSize:1000x700"]);
});

Deno.test("window_get_size returns the window size as an object", async () => {
  const { win } = fakeWindow([1234, 567]);
  const result = await handleWindowCommand(win, "window_get_size");
  assertEquals(result, { width: 1234, height: 567 });
});

Deno.test("window_set_title forwards the title", async () => {
  const fake = fakeWindow();
  const result = await handleWindowCommand(fake.win, "window_set_title", {
    title: "archive - mekuri",
  });
  assertEquals(result, null);
  assertEquals(fake.title, "archive - mekuri");
});

Deno.test("window_show shows the window", async () => {
  const { win, calls } = fakeWindow();
  const result = await handleWindowCommand(win, "window_show");
  assertEquals(result, null);
  assertEquals(calls, ["show"]);
});

Deno.test("window_close closes the window", async () => {
  const { win, calls } = fakeWindow();
  const result = await handleWindowCommand(win, "window_close");
  assertEquals(result, null);
  assertEquals(calls, ["close"]);
});

Deno.test("window_set_size rejects when width is missing", async () => {
  const { win } = fakeWindow();
  await assertRejects(
    () => handleWindowCommand(win, "window_set_size", { height: 700 }),
    Error,
    "'width' must be a number",
  );
});

Deno.test("window_set_title rejects when title is not a string", async () => {
  const { win } = fakeWindow();
  await assertRejects(
    () => handleWindowCommand(win, "window_set_title", { title: 42 }),
    Error,
    "'title' must be a string",
  );
});

Deno.test("handleWindowCommand rejects an unknown command", async () => {
  const { win } = fakeWindow();
  await assertRejects(
    () => handleWindowCommand(win, "window_explode"),
    Error,
    "Unknown window command: window_explode",
  );
});
