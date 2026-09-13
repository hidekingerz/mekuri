import { describe, expect, it } from "vitest";
import {
  groupIndexFromRatio,
  navigationForClick,
  navigationForKey,
  navigationForWheel,
  progressRatio,
  siblingAfterRemoval,
} from "./spreadNavigation";

describe("navigationForKey", () => {
  it("space always goes to the next spread", () => {
    expect(navigationForKey(" ", true)).toBe("next");
    expect(navigationForKey(" ", false)).toBe("next");
  });

  it("arrow keys follow the reading direction", () => {
    expect(navigationForKey("ArrowLeft", true)).toBe("next");
    expect(navigationForKey("ArrowRight", true)).toBe("prev");
    expect(navigationForKey("ArrowLeft", false)).toBe("prev");
    expect(navigationForKey("ArrowRight", false)).toBe("next");
  });

  it("Home and End jump to the first and last spread", () => {
    expect(navigationForKey("Home", true)).toBe("first");
    expect(navigationForKey("End", false)).toBe("last");
  });

  it("ignores unrelated keys", () => {
    expect(navigationForKey("a", true)).toBeNull();
    expect(navigationForKey("Enter", false)).toBeNull();
  });
});

describe("navigationForClick", () => {
  it("clicking the left half turns the page in reading order", () => {
    expect(navigationForClick(true, true)).toBe("next");
    expect(navigationForClick(true, false)).toBe("prev");
  });

  it("clicking the right half turns the page in reading order", () => {
    expect(navigationForClick(false, true)).toBe("prev");
    expect(navigationForClick(false, false)).toBe("next");
  });
});

describe("navigationForWheel", () => {
  it("scrolling down goes next, scrolling up goes prev, no scroll does nothing", () => {
    expect(navigationForWheel(10)).toBe("next");
    expect(navigationForWheel(-3)).toBe("prev");
    expect(navigationForWheel(0)).toBeNull();
  });
});

describe("progressRatio", () => {
  const rect = { left: 100, right: 300, width: 200 };

  it("measures from the left edge in LTR", () => {
    expect(progressRatio(150, rect, false)).toBe(0.25);
  });

  it("measures from the right edge in RTL", () => {
    expect(progressRatio(150, rect, true)).toBe(0.75);
  });
});

describe("groupIndexFromRatio", () => {
  it("rounds the ratio to the nearest group index", () => {
    expect(groupIndexFromRatio(0, 5)).toBe(0);
    expect(groupIndexFromRatio(0.5, 5)).toBe(2);
    expect(groupIndexFromRatio(1, 5)).toBe(4);
  });

  it("clamps out-of-range ratios", () => {
    expect(groupIndexFromRatio(-0.5, 5)).toBe(0);
    expect(groupIndexFromRatio(1.5, 5)).toBe(4);
  });

  it("returns 0 when there are no groups", () => {
    expect(groupIndexFromRatio(0.5, 0)).toBe(0);
  });
});

describe("siblingAfterRemoval", () => {
  const list = ["a", "b", "c"];

  it("prefers the following sibling", () => {
    expect(siblingAfterRemoval(list, 1)).toBe("c");
  });

  it("falls back to the preceding sibling at the end of the list", () => {
    expect(siblingAfterRemoval(list, 2)).toBe("b");
  });

  it("returns null when the item is alone or not in the list", () => {
    expect(siblingAfterRemoval(["only"], 0)).toBeNull();
    expect(siblingAfterRemoval(list, -1)).toBeNull();
  });
});
