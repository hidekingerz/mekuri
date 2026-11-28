import { describe, expect, it } from "vitest";
import { FILE_DRAG_MIME } from "./constants";
import { decodeDragPaths, dragSource, encodeDragPaths, matchDroppedPaths } from "./fileDrag";

describe("encodeDragPaths / decodeDragPaths", () => {
  it("round-trips a single path", () => {
    expect(decodeDragPaths(encodeDragPaths(["/a/b.zip"]))).toEqual(["/a/b.zip"]);
  });

  it("round-trips multiple paths preserving order", () => {
    const paths = ["/a/1.zip", "/a/2.cbr", "/a/3.pdf"];
    expect(decodeDragPaths(encodeDragPaths(paths))).toEqual(paths);
  });

  it("treats a bare path string as a single-item list", () => {
    expect(decodeDragPaths("/a/b.zip")).toEqual(["/a/b.zip"]);
  });

  it("returns an empty list for empty data", () => {
    expect(decodeDragPaths("")).toEqual([]);
  });

  it("drops non-string entries from malformed JSON arrays", () => {
    expect(decodeDragPaths('["/a/b.zip", 1, null]')).toEqual(["/a/b.zip"]);
  });

  it("returns nothing for a broken or non-array payload", () => {
    expect(decodeDragPaths('["/a/b.zip"')).toEqual([]);
    expect(decodeDragPaths("[1")).toEqual([]);
  });
});

describe("dragSource", () => {
  it("prefers the in-app payload even when files are also listed", () => {
    expect(dragSource([FILE_DRAG_MIME, "Files"])).toBe("app");
  });

  it("treats a plain file drag as coming from outside the app", () => {
    expect(dragSource(["Files"])).toBe("external");
  });

  it("ignores drags that carry neither", () => {
    expect(dragSource(["text/plain"])).toBeNull();
  });
});

describe("matchDroppedPaths", () => {
  it("returns the pasteboard paths when their names match the dropped files", () => {
    expect(matchDroppedPaths(["a.zip", "b.pdf"], ["/x/b.pdf", "/x/a.zip"])).toEqual([
      "/x/b.pdf",
      "/x/a.zip",
    ]);
  });

  it("matches names written in different Unicode normalization forms", () => {
    const nfd = "\u30cf\u3099.zip"; // バ as ハ + combining dakuten
    expect(matchDroppedPaths(["\u30d0.zip"], [`/x/${nfd}`])).toEqual([`/x/${nfd}`]);
  });

  it("rejects a stale pasteboard whose names differ from the drop", () => {
    expect(matchDroppedPaths(["a.zip"], ["/x/other.zip"])).toEqual([]);
  });

  it("rejects a pasteboard with a different number of files", () => {
    expect(matchDroppedPaths(["a.zip"], ["/x/a.zip", "/y/a.zip"])).toEqual([]);
    expect(matchDroppedPaths(["a.zip", "a.zip"], ["/x/a.zip"])).toEqual([]);
  });

  it("returns nothing when no files were dropped", () => {
    expect(matchDroppedPaths([], [])).toEqual([]);
  });
});
