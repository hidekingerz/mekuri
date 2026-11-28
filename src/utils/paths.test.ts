import { describe, expect, it } from "vitest";
import { baseName, isInside, isSameOrInside, joinPath, parentPath, segmentsBelow } from "./paths";

describe("parentPath", () => {
  it("returns the folder that holds the path, for either separator", () => {
    expect(parentPath("/m/manga/a1.zip")).toBe("/m/manga");
    expect(parentPath("C:\\manga\\作者A\\a1.zip")).toBe("C:\\manga\\作者A");
    expect(parentPath("C:\\manga/mixed\\a1.zip")).toBe("C:\\manga/mixed");
  });

  it("has no parent for a root or a bare name", () => {
    expect(parentPath("/a1.zip")).toBeNull();
    expect(parentPath("a1.zip")).toBeNull();
    expect(parentPath("")).toBeNull();
  });
});

describe("baseName", () => {
  it("returns the last name of the path, for either separator", () => {
    expect(baseName("/m/manga/a1.zip")).toBe("a1.zip");
    expect(baseName("C:\\manga\\作者A")).toBe("作者A");
    expect(baseName("a1.zip")).toBe("a1.zip");
  });
});

describe("isInside", () => {
  it("accepts paths below the folder, for either separator", () => {
    expect(isInside("/m/manga", "/m/manga/作者A")).toBe(true);
    expect(isInside("/m/manga", "/m/manga/作者A/完結")).toBe(true);
    expect(isInside("C:\\manga", "C:\\manga\\作者A")).toBe(true);
  });

  it("rejects the folder itself and folders that only share the start of the name", () => {
    expect(isInside("/m/manga", "/m/manga")).toBe(false);
    expect(isInside("/m/manga", "/m/manga2/x")).toBe(false);
    expect(isInside("C:\\manga", "C:\\manga2\\x")).toBe(false);
    expect(isInside("/m/manga", "/m")).toBe(false);
  });
});

describe("isSameOrInside", () => {
  it("also accepts the folder itself", () => {
    expect(isSameOrInside("/m/manga", "/m/manga")).toBe(true);
    expect(isSameOrInside("/m/manga", "/m/manga/作者A")).toBe(true);
    expect(isSameOrInside("/m/manga", "/m/manga2")).toBe(false);
  });
});

describe("segmentsBelow", () => {
  it("lists the names from the folder down to the path", () => {
    expect(segmentsBelow("/m/manga", "/m/manga/作者A/完結")).toEqual(["作者A", "完結"]);
    expect(segmentsBelow("C:\\manga", "C:\\manga\\作者A\\完結")).toEqual(["作者A", "完結"]);
    expect(segmentsBelow("/m/manga", "/m/manga")).toEqual([]);
  });

  it("returns null for a path outside the folder", () => {
    expect(segmentsBelow("/m/manga", "/m/manga2/x")).toBeNull();
    expect(segmentsBelow("/m/manga", "/m")).toBeNull();
  });
});

describe("joinPath", () => {
  it("joins with the separator the folder already uses", () => {
    expect(joinPath("/m/manga", "作者A")).toBe("/m/manga/作者A");
    expect(joinPath("C:\\manga", "作者A")).toBe("C:\\manga\\作者A");
  });
});
