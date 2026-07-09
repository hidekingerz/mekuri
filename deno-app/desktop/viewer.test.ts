import { assertEquals, assertStrictEquals } from "@std/assert";
import {
  fileNameFromPath,
  hashCode,
  openViewer,
  type OpenViewerDeps,
  viewerLabel,
  viewerUrl,
  type ViewerWindowHandle,
  type ViewerWindowOptions,
  viewerWindowOptions,
  viewerWindowTitle,
} from "./viewer.ts";

Deno.test("hashCode is deterministic for the same input", () => {
  assertEquals(
    hashCode("/path/to/archive.zip"),
    hashCode("/path/to/archive.zip"),
  );
});

Deno.test("hashCode differs for different inputs", () => {
  assertEquals(hashCode("a.zip") === hashCode("b.zip"), false);
});

Deno.test("viewerLabel is prefixed and deterministic", () => {
  const path = "/path/to/archive.zip";
  assertEquals(viewerLabel(path).startsWith("viewer-"), true);
  assertEquals(viewerLabel(path), viewerLabel(path));
});

Deno.test("viewerLabel differs by archive path", () => {
  assertEquals(viewerLabel("a.zip") === viewerLabel("b.zip"), false);
});

Deno.test("fileNameFromPath extracts the basename on unix and windows", () => {
  assertEquals(fileNameFromPath("/path/to/archive.zip"), "archive.zip");
  assertEquals(fileNameFromPath("C:\\path\\to\\book.cbz"), "book.cbz");
  assertEquals(fileNameFromPath(""), "Viewer");
});

Deno.test("viewerWindowTitle matches the React '<name> - mekuri' format", () => {
  assertEquals(viewerWindowTitle("/dir/comic.cbz"), "comic.cbz - mekuri");
});

Deno.test("viewerUrl encodes the archive path", () => {
  assertEquals(
    viewerUrl("/a b/孫.zip"),
    `viewer.html?archive=${encodeURIComponent("/a b/孫.zip")}`,
  );
});

Deno.test("viewerWindowOptions uses saved size with derived title", () => {
  const opts = viewerWindowOptions("/dir/comic.cbz", {
    width: 1280,
    height: 1000,
  });
  assertEquals(
    opts,
    {
      title: "comic.cbz - mekuri",
      width: 1280,
      height: 1000,
      resizable: true,
    } satisfies ViewerWindowOptions,
  );
});

Deno.test("openViewer focuses an existing window and does not create a new one", async () => {
  let focused = 0;
  let created = 0;
  const existing: ViewerWindowHandle = { focus: () => focused++ };
  const deps: OpenViewerDeps = {
    findWindow: () => existing,
    createWindow: () => created++,
    loadViewerSettings: () => {
      throw new Error("settings must not be loaded when reusing a window");
    },
  };

  await openViewer("/dir/comic.cbz", deps);

  assertEquals(focused, 1);
  assertEquals(created, 0);
});

Deno.test("openViewer creates a window with derived options and url when none exists", async () => {
  const calls: { label: string; options: ViewerWindowOptions; url: string }[] =
    [];
  const deps: OpenViewerDeps = {
    findWindow: () => undefined,
    createWindow: (label, options, url) => calls.push({ label, options, url }),
    loadViewerSettings: () => Promise.resolve({ width: 800, height: 640 }),
  };

  const path = "/dir/comic.cbz";
  await openViewer(path, deps);

  assertEquals(calls.length, 1);
  assertStrictEquals(calls[0].label, viewerLabel(path));
  assertEquals(calls[0].url, viewerUrl(path));
  assertEquals(
    calls[0].options,
    {
      title: "comic.cbz - mekuri",
      width: 800,
      height: 640,
      resizable: true,
    } satisfies ViewerWindowOptions,
  );
});
