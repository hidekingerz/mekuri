import { describe, expect, it } from "vitest";
import { clampTreeColumnWidth } from "./columnLayout";

describe("clampTreeColumnWidth", () => {
  // container 1000, sidebar 180, min column 150 → tree may be 150..670
  it("keeps a width that fits", () => {
    expect(clampTreeColumnWidth(472, 1000, 180, 150)).toBe(472);
  });

  it("shrinks the tree so the file column keeps its minimum width", () => {
    expect(clampTreeColumnWidth(472, 640, 180, 150)).toBe(310);
  });

  it("never goes below the minimum column width", () => {
    expect(clampTreeColumnWidth(472, 300, 180, 150)).toBe(150);
    expect(clampTreeColumnWidth(10, 1000, 180, 150)).toBe(150);
  });

  it("ignores a container that is not measured yet", () => {
    expect(clampTreeColumnWidth(472, 0, 180, 150)).toBe(472);
  });
});
