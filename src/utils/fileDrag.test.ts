import { describe, expect, it } from "vitest";
import { decodeDragPaths, encodeDragPaths } from "./fileDrag";

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
});
