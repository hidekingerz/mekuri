import { describe, expect, it } from "vitest";
import type { ReadingDirection, ViewMode } from "./spreadLayout";
import {
  buildPageGroups,
  buildSpreads,
  computeFitPageCount,
  currentPageFromGroup,
  currentPageFromSpread,
  groupIndexForPage,
  spreadIndexForPage,
} from "./spreadLayout";

describe("buildSpreads", () => {
  it("returns empty array for 0 pages", () => {
    expect(buildSpreads(0)).toEqual([]);
  });

  it("returns single spread for 1 page (cover only)", () => {
    const spreads = buildSpreads(1);
    expect(spreads).toEqual([{ right: 0, left: null }]);
  });

  it("returns 2 spreads for 2 pages (cover + last alone)", () => {
    const spreads = buildSpreads(2);
    expect(spreads).toEqual([
      { right: 0, left: null },
      { right: 1, left: null },
    ]);
  });

  it("returns 2 spreads for 3 pages (cover + one pair)", () => {
    const spreads = buildSpreads(3);
    expect(spreads).toEqual([
      { right: 0, left: null },
      { right: 1, left: 2 },
    ]);
  });

  it("handles 5 pages: cover, pair, pair", () => {
    const spreads = buildSpreads(5);
    expect(spreads).toEqual([
      { right: 0, left: null },
      { right: 1, left: 2 },
      { right: 3, left: 4 },
    ]);
  });

  it("handles 6 pages: cover, pair, pair, last alone", () => {
    const spreads = buildSpreads(6);
    expect(spreads).toEqual([
      { right: 0, left: null },
      { right: 1, left: 2 },
      { right: 3, left: 4 },
      { right: 5, left: null },
    ]);
  });

  it("handles negative input", () => {
    expect(buildSpreads(-1)).toEqual([]);
  });
});

describe("buildSpreads (single mode)", () => {
  const mode: ViewMode = "single";

  it("returns empty array for 0 pages", () => {
    expect(buildSpreads(0, mode)).toEqual([]);
  });

  it("returns 1 single-page spread for 1 page", () => {
    expect(buildSpreads(1, mode)).toEqual([{ right: 0, left: null }]);
  });

  it("returns 3 single-page spreads for 3 pages", () => {
    expect(buildSpreads(3, mode)).toEqual([
      { right: 0, left: null },
      { right: 1, left: null },
      { right: 2, left: null },
    ]);
  });

  it("returns 5 single-page spreads for 5 pages", () => {
    const spreads = buildSpreads(5, mode);
    expect(spreads).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(spreads[i]).toEqual({ right: i, left: null });
    }
  });

  it("handles negative input", () => {
    expect(buildSpreads(-1, mode)).toEqual([]);
  });
});

describe("spreadIndexForPage (spread mode)", () => {
  const spreads = buildSpreads(5);

  it("finds cover page at index 0", () => {
    expect(spreadIndexForPage(spreads, 0)).toBe(0);
  });

  it("finds page 1 (right side of spread 1)", () => {
    expect(spreadIndexForPage(spreads, 1)).toBe(1);
  });

  it("finds page 2 (left side of spread 1)", () => {
    expect(spreadIndexForPage(spreads, 2)).toBe(1);
  });

  it("returns -1 for non-existent page", () => {
    expect(spreadIndexForPage(spreads, 99)).toBe(-1);
  });
});

describe("buildSpreads (LTR spread mode)", () => {
  const direction: ReadingDirection = "ltr";

  it("returns empty array for 0 pages", () => {
    expect(buildSpreads(0, "spread", direction)).toEqual([]);
  });

  it("returns single spread for 1 page (cover on left)", () => {
    const spreads = buildSpreads(1, "spread", direction);
    expect(spreads).toEqual([{ right: null, left: 0 }]);
  });

  it("returns 2 spreads for 2 pages (cover + last alone)", () => {
    const spreads = buildSpreads(2, "spread", direction);
    expect(spreads).toEqual([
      { right: null, left: 0 },
      { right: null, left: 1 },
    ]);
  });

  it("returns 2 spreads for 3 pages (cover + one pair)", () => {
    const spreads = buildSpreads(3, "spread", direction);
    expect(spreads).toEqual([
      { right: null, left: 0 },
      { left: 1, right: 2 },
    ]);
  });

  it("handles 5 pages: cover, pair, pair", () => {
    const spreads = buildSpreads(5, "spread", direction);
    expect(spreads).toEqual([
      { right: null, left: 0 },
      { left: 1, right: 2 },
      { left: 3, right: 4 },
    ]);
  });

  it("handles 6 pages: cover, pair, pair, last alone", () => {
    const spreads = buildSpreads(6, "spread", direction);
    expect(spreads).toEqual([
      { right: null, left: 0 },
      { left: 1, right: 2 },
      { left: 3, right: 4 },
      { right: null, left: 5 },
    ]);
  });

  it("LTR pairs have left=earlier, right=later", () => {
    const spreads = buildSpreads(5, "spread", direction);
    // Pair at index 1: left=1 (earlier), right=2 (later)
    expect(spreads[1].left).toBe(1);
    expect(spreads[1].right).toBe(2);
  });
});

describe("spreadIndexForPage (LTR spread mode)", () => {
  const spreads = buildSpreads(5, "spread", "ltr");

  it("finds cover page at index 0", () => {
    expect(spreadIndexForPage(spreads, 0)).toBe(0);
  });

  it("finds page 1 (left side of spread 1)", () => {
    expect(spreadIndexForPage(spreads, 1)).toBe(1);
  });

  it("finds page 2 (right side of spread 1)", () => {
    expect(spreadIndexForPage(spreads, 2)).toBe(1);
  });

  it("returns -1 for non-existent page", () => {
    expect(spreadIndexForPage(spreads, 99)).toBe(-1);
  });
});

describe("currentPageFromSpread", () => {
  it("returns right for RTL spread", () => {
    expect(currentPageFromSpread({ right: 3, left: 4 }, "rtl")).toBe(3);
  });

  it("returns left for LTR spread", () => {
    expect(currentPageFromSpread({ left: 3, right: 4 }, "ltr")).toBe(3);
  });

  it("falls back when primary side is null (RTL)", () => {
    expect(currentPageFromSpread({ right: null, left: 5 }, "rtl")).toBe(5);
  });

  it("falls back when primary side is null (LTR)", () => {
    expect(currentPageFromSpread({ right: 5, left: null }, "ltr")).toBe(5);
  });
});

describe("spreadIndexForPage (single mode)", () => {
  const spreads = buildSpreads(5, "single");

  it("finds page 0 at index 0", () => {
    expect(spreadIndexForPage(spreads, 0)).toBe(0);
  });

  it("finds page 2 at index 2", () => {
    expect(spreadIndexForPage(spreads, 2)).toBe(2);
  });

  it("finds page 4 at index 4", () => {
    expect(spreadIndexForPage(spreads, 4)).toBe(4);
  });

  it("returns -1 for non-existent page", () => {
    expect(spreadIndexForPage(spreads, 99)).toBe(-1);
  });
});

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
