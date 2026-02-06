import { describe, expect, it } from "vitest";
import { fileNameFromPath, hashCode, viewerLabel } from "./windowLabel";

describe("hashCode", () => {
  it("returns a string", () => {
    expect(typeof hashCode("test")).toBe("string");
  });

  it("returns the same hash for the same input", () => {
    expect(hashCode("/path/to/file.zip")).toBe(hashCode("/path/to/file.zip"));
  });

  it("returns different hashes for different inputs", () => {
    expect(hashCode("a.zip")).not.toBe(hashCode("b.zip"));
  });

  it("handles empty string", () => {
    expect(hashCode("")).toBe("0");
  });
});

describe("viewerLabel", () => {
  it("starts with 'viewer-'", () => {
    expect(viewerLabel("/path/to/archive.zip")).toMatch(/^viewer-/);
  });

  it("produces same label for same path", () => {
    const path = "/home/user/comics/vol1.cbz";
    expect(viewerLabel(path)).toBe(viewerLabel(path));
  });

  it("produces different labels for different paths", () => {
    expect(viewerLabel("a.zip")).not.toBe(viewerLabel("b.zip"));
  });
});

describe("fileNameFromPath", () => {
  it("extracts file name from Unix path", () => {
    expect(fileNameFromPath("/home/user/comics/vol1.cbz")).toBe("vol1.cbz");
  });

  it("extracts file name from Windows path", () => {
    expect(fileNameFromPath("C:\\Users\\test\\comics\\vol1.cbz")).toBe("vol1.cbz");
  });

  it("returns the string itself if no separator", () => {
    expect(fileNameFromPath("file.zip")).toBe("file.zip");
  });

  it("returns 'Viewer' for empty string", () => {
    expect(fileNameFromPath("")).toBe("Viewer");
  });
});
