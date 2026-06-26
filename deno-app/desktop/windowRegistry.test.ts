import { assertEquals, assertRejects } from "@std/assert";
import { handleWindowCommandByLabel } from "./windowRegistry.ts";
import type { ControllableWindow } from "./window.ts";

/** 呼び出しを記録する fake ウィンドウ。 */
function fakeWindow(): {
  win: ControllableWindow;
  calls: string[];
  size: [number, number];
} {
  const calls: string[] = [];
  let size: [number, number] = [800, 600];
  const win: ControllableWindow = {
    setSize(width, height) {
      calls.push(`setSize(${width},${height})`);
      size = [width, height];
    },
    getSize() {
      return size;
    },
    setTitle(title) {
      calls.push(`setTitle(${title})`);
    },
    show() {
      calls.push("show");
    },
    close() {
      calls.push("close");
    },
  };
  return { win, calls, size };
}

Deno.test("handleWindowCommandByLabel resolves the label and runs the command", async () => {
  const main = fakeWindow();
  const viewer = fakeWindow();
  const resolve = (label: string) =>
    label === "main" ? main.win : label === "viewer-1" ? viewer.win : undefined;

  await handleWindowCommandByLabel(resolve, "viewer-1", "window_set_title", {
    title: "comic",
  });

  assertEquals(viewer.calls, ["setTitle(comic)"]);
  assertEquals(main.calls, []);
});

Deno.test("handleWindowCommandByLabel returns window_get_size from the resolved window", async () => {
  const main = fakeWindow();
  main.win.setSize(1024, 768);
  const result = await handleWindowCommandByLabel(
    () => main.win,
    "main",
    "window_get_size",
  );
  assertEquals(result, { width: 1024, height: 768 });
});

Deno.test("handleWindowCommandByLabel rejects a missing windowLabel", async () => {
  await assertRejects(
    () =>
      handleWindowCommandByLabel(
        () => fakeWindow().win,
        undefined,
        "window_show",
      ),
    Error,
    "windowLabel is required",
  );
});

Deno.test("handleWindowCommandByLabel rejects an empty windowLabel", async () => {
  await assertRejects(
    () => handleWindowCommandByLabel(() => fakeWindow().win, "", "window_show"),
    Error,
    "windowLabel is required",
  );
});

Deno.test("handleWindowCommandByLabel rejects an unknown window label", async () => {
  await assertRejects(
    () => handleWindowCommandByLabel(() => undefined, "ghost", "window_show"),
    Error,
    "no window for label 'ghost'",
  );
});

Deno.test("handleWindowCommandByLabel propagates unknown window commands", async () => {
  await assertRejects(
    () =>
      handleWindowCommandByLabel(() => fakeWindow().win, "main", "window_nope"),
    Error,
    "Unknown window command",
  );
});
