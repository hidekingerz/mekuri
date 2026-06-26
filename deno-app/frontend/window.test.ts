import { assertEquals } from "@std/assert";
import type { InvokeArgs } from "./invoke.ts";
import { getCurrentWindow, LogicalSize, type ResizeTarget } from "./window.ts";

function recordingInvoke(returns: Record<string, unknown> = {}) {
  const calls: Array<{ command: string; args?: InvokeArgs }> = [];
  const invoke = <T = unknown>(command: string, args?: InvokeArgs) => {
    calls.push({ command, args });
    return Promise.resolve((returns[command] ?? null) as T);
  };
  return { invoke, calls };
}

/** addEventListener/removeEventListener を記録し、手動で発火できる resize ターゲット。 */
function fakeResizeTarget() {
  const listeners = new Set<() => void>();
  const target: ResizeTarget = {
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
  };
  return {
    target,
    trigger() {
      for (const l of listeners) l();
    },
    get count() {
      return listeners.size;
    },
  };
}

Deno.test("setSize invokes window_set_size with a LogicalSize", async () => {
  const { invoke, calls } = recordingInvoke();
  const win = getCurrentWindow({ invoke });
  await win.setSize(new LogicalSize(1000, 700));
  assertEquals(calls, [{
    command: "window_set_size",
    args: { width: 1000, height: 700 },
  }]);
});

Deno.test("getSize invokes window_get_size and returns the size", async () => {
  const { invoke } = recordingInvoke({
    window_get_size: { width: 1280, height: 800 },
  });
  const win = getCurrentWindow({ invoke });
  assertEquals(await win.getSize(), { width: 1280, height: 800 });
});

Deno.test("setTitle invokes window_set_title", async () => {
  const { invoke, calls } = recordingInvoke();
  const win = getCurrentWindow({ invoke });
  await win.setTitle("file - mekuri");
  assertEquals(calls, [{
    command: "window_set_title",
    args: { title: "file - mekuri" },
  }]);
});

Deno.test("show invokes window_show", async () => {
  const { invoke, calls } = recordingInvoke();
  const win = getCurrentWindow({ invoke });
  await win.show();
  assertEquals(calls, [{ command: "window_show", args: undefined }]);
});

Deno.test("onResized reports the OS window size on a DOM resize", async () => {
  const { invoke } = recordingInvoke({
    window_get_size: { width: 640, height: 480 },
  });
  const resize = fakeResizeTarget();
  const win = getCurrentWindow({ invoke, resizeTarget: resize.target });

  const seen: Array<{ width: number; height: number }> = [];
  const unlisten = await win.onResized((event) => {
    seen.push(event.payload);
  });

  assertEquals(resize.count, 1);
  resize.trigger();
  // getSize() の Promise を解決させる。
  await new Promise((r) => setTimeout(r, 0));
  assertEquals(seen, [{ width: 640, height: 480 }]);

  unlisten();
  assertEquals(resize.count, 0);
});
