import { describe, expect, it } from "vitest";
import { getParentDirectory } from "./directory";

describe("getParentDirectory", () => {
  it("returns parent for Unix path", () => {
    expect(getParentDirectory("/home/user/file.zip")).toBe("/home/user");
  });

  it("returns parent for nested Unix path", () => {
    expect(getParentDirectory("/a/b/c/d")).toBe("/a/b/c");
  });

  it("returns root for file in root directory", () => {
    expect(getParentDirectory("/file.zip")).toBe("");
  });

  it("returns parent for Windows path", () => {
    expect(getParentDirectory("C:\\Users\\user\\file.zip")).toBe("C:\\Users\\user");
  });

  it("handles mixed separators", () => {
    expect(getParentDirectory("C:\\Users/user/file.zip")).toBe("C:\\Users/user");
  });

  it("returns the input when no separator exists", () => {
    expect(getParentDirectory("file.zip")).toBe("file.zip");
  });

  it("returns empty string for empty input", () => {
    expect(getParentDirectory("")).toBe("");
  });
});
