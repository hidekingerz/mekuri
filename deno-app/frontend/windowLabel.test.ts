import { assertEquals } from "@std/assert";
import {
  hashCode,
  MAIN_WINDOW_LABEL,
  windowLabelFromLocation,
} from "./windowLabel.ts";
import { viewerLabel } from "../desktop/viewer.ts";

Deno.test("windowLabelFromLocation returns the main label without an archive query", () => {
  assertEquals(windowLabelFromLocation({ search: "" }), MAIN_WINDOW_LABEL);
  assertEquals(
    windowLabelFromLocation({ search: "?foo=bar" }),
    MAIN_WINDOW_LABEL,
  );
});

Deno.test("windowLabelFromLocation derives the viewer label from the archive query", () => {
  assertEquals(
    windowLabelFromLocation({ search: "?archive=%2Fa.zip" }),
    "viewer-nrc8jp",
  );
});

Deno.test("windowLabelFromLocation matches desktop viewerLabel for the same archive path", () => {
  // frontend の hashCode は desktop/viewer.ts と同一でなければならない（registry キー一致）。
  for (const path of ["/a.zip", "/Users/me/comics/vol1.cbz", "/tmp/x.rar"]) {
    const search = `?archive=${encodeURIComponent(path)}`;
    assertEquals(windowLabelFromLocation({ search }), viewerLabel(path));
  }
});

Deno.test("hashCode matches the desktop implementation embedded in viewerLabel", () => {
  assertEquals(`viewer-${hashCode("/a.zip")}`, viewerLabel("/a.zip"));
});
