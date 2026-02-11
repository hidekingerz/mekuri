import { describe, expect, it } from "vitest";
import type { ViewMode } from "./spreadLayout";
import { buildSpreads, spreadIndexForPage } from "./spreadLayout";

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

describe("spreadIndexForPage", () => {
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
