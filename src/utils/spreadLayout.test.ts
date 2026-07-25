import { describe, expect, it } from "vitest";
import {
  buildPageGroups,
  computeFitPageCount,
  currentPageFromGroup,
  groupIndexForPage,
} from "./spreadLayout";

describe("buildPageGroups (single)", () => {
  it("returns empty array for 0 pages", () => {
    expect(buildPageGroups(0, "single")).toEqual([]);
  });

  it("returns one group per page", () => {
    expect(buildPageGroups(3, "single")).toEqual([[0], [1], [2]]);
  });

  it("handles negative input", () => {
    expect(buildPageGroups(-1, "single")).toEqual([]);
  });
});

describe("buildPageGroups (spread)", () => {
  it("returns empty array for 0 pages", () => {
    expect(buildPageGroups(0, "spread")).toEqual([]);
  });

  it("shows cover alone for 1 page", () => {
    expect(buildPageGroups(1, "spread")).toEqual([[0]]);
  });

  it("shows cover alone then pairs (7 pages)", () => {
    expect(buildPageGroups(7, "spread")).toEqual([[0], [1, 2], [3, 4], [5, 6]]);
  });

  it("last page may be alone (6 pages)", () => {
    expect(buildPageGroups(6, "spread")).toEqual([[0], [1, 2], [3, 4], [5]]);
  });

  it("is the default mode", () => {
    expect(buildPageGroups(3)).toEqual([[0], [1, 2]]);
  });
});

describe("buildPageGroups (triple)", () => {
  it("groups three pages without cover-alone", () => {
    expect(buildPageGroups(7, "triple")).toEqual([[0, 1, 2], [3, 4, 5], [6]]);
  });

  it("handles fewer pages than group size", () => {
    expect(buildPageGroups(2, "triple")).toEqual([[0, 1]]);
  });
});

describe("buildPageGroups (fit)", () => {
  it("groups N pages without cover-alone", () => {
    expect(buildPageGroups(7, "fit", 4)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it("defaults to 2 pages per group when fitPageCount omitted", () => {
    expect(buildPageGroups(4, "fit")).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("puts everything in one group when N exceeds total pages", () => {
    expect(buildPageGroups(3, "fit", 10)).toEqual([[0, 1, 2]]);
  });

  it("treats N below 1 as 1", () => {
    expect(buildPageGroups(3, "fit", 0)).toEqual([[0], [1], [2]]);
  });
});

describe("groupIndexForPage", () => {
  const groups = buildPageGroups(7, "spread"); // [[0], [1,2], [3,4], [5,6]]

  it("finds the cover page", () => {
    expect(groupIndexForPage(groups, 0)).toBe(0);
  });

  it("finds a page inside a pair", () => {
    expect(groupIndexForPage(groups, 4)).toBe(2);
  });

  it("returns -1 for non-existent page", () => {
    expect(groupIndexForPage(groups, 99)).toBe(-1);
  });
});

describe("currentPageFromGroup", () => {
  it("returns the first page in reading order", () => {
    expect(currentPageFromGroup([3, 4, 5])).toBe(3);
  });

  it("returns 0 for an empty group", () => {
    expect(currentPageFromGroup([])).toBe(0);
  });
});

describe("computeFitPageCount", () => {
  // pageAspect = 幅/高さ。A4 縦 ≒ 0.707
  it("returns 1 for a portrait window", () => {
    expect(computeFitPageCount(800, 1200, 0.707)).toBe(1);
  });

  it("returns 4 for an ultrawide window (21:9)", () => {
    // 2560 / (1080 * 0.707) = 3.35... → 3? 21:9 実寸で検証:
    // 3440 / (1440 * 0.707) = 3.379 → 3
    expect(computeFitPageCount(3440, 1440, 0.707)).toBe(3);
    // より横長なら 4
    expect(computeFitPageCount(4096, 1440, 0.707)).toBe(4);
  });

  it("returns at least 1 even when nothing fits", () => {
    expect(computeFitPageCount(100, 1200, 0.707)).toBe(1);
  });

  it("returns 1 for zero or negative sizes", () => {
    expect(computeFitPageCount(0, 1080, 0.707)).toBe(1);
    expect(computeFitPageCount(1920, 0, 0.707)).toBe(1);
    expect(computeFitPageCount(-100, 1080, 0.707)).toBe(1);
  });

  it("returns 1 for zero or negative aspect", () => {
    expect(computeFitPageCount(1920, 1080, 0)).toBe(1);
  });
});
