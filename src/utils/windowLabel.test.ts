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

  it("matches the Rust golden vectors (src-tauri/src/window_label.rs)", () => {
    // 値を変える場合は必ず Rust 側のテストも同時に更新すること
    expect(hashCode("test")).toBe("2487m");
    expect(hashCode("/path/to/file.zip")).toBe("pwu1o8");
    expect(hashCode("a.zip")).toBe("1i800k");
    expect(hashCode("b.zip")).toBe("1irslx");
    expect(hashCode("/home/user/comics/vol1.cbz")).toBe("6noich");
    expect(hashCode("/Users/山田/漫画/第1巻.zip")).toBe("bs292c");
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

  it("matches the Rust golden vector (src-tauri/src/window_label.rs)", () => {
    expect(viewerLabel("/home/user/comics/vol1.cbz")).toBe("viewer-6noich");
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
