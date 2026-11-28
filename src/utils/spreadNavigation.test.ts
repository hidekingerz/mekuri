import { describe, expect, it } from "vitest";
import {
  adjacentSibling,
  groupIndexFromRatio,
  navigationForClick,
  navigationForKey,
  navigationForWheel,
  progressRatio,
  siblingByPath,
  siblingDirectionForKey,
  siblingDirectionForMouseButton,
} from "./spreadNavigation";

describe("navigationForKey", () => {
  const key = (k: string) => ({ key: k });

  it("space always goes to the next spread", () => {
    expect(navigationForKey(key(" "), true)).toBe("next");
    expect(navigationForKey(key(" "), false)).toBe("next");
  });

  it("arrow keys follow the reading direction", () => {
    expect(navigationForKey(key("ArrowLeft"), true)).toBe("next");
    expect(navigationForKey(key("ArrowRight"), true)).toBe("prev");
    expect(navigationForKey(key("ArrowLeft"), false)).toBe("prev");
    expect(navigationForKey(key("ArrowRight"), false)).toBe("next");
  });

  it("Home and End jump to the first and last spread in either reading direction", () => {
    for (const isRtl of [true, false]) {
      expect(navigationForKey(key("Home"), isRtl)).toBe("first");
      expect(navigationForKey(key("End"), isRtl)).toBe("last");
    }
  });

  it("ignores unrelated keys", () => {
    expect(navigationForKey(key("a"), true)).toBeNull();
    expect(navigationForKey(key("Enter"), false)).toBeNull();
  });

  it.each([
    "shiftKey",
    "altKey",
    "ctrlKey",
    "metaKey",
  ] as const)("does not turn the page while %s is held", (modifier) => {
    for (const k of [" ", "ArrowLeft", "ArrowRight", "Home", "End"]) {
      expect(navigationForKey({ key: k, [modifier]: true }, true)).toBeNull();
      expect(navigationForKey({ key: k, [modifier]: true }, false)).toBeNull();
    }
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
    expect(navigationForWheel({ deltaY: 10 })).toBe("next");
    expect(navigationForWheel({ deltaY: -3 })).toBe("prev");
    expect(navigationForWheel({ deltaY: 0 })).toBeNull();
  });

  it.each([
    "shiftKey",
    "altKey",
    "ctrlKey",
    "metaKey",
  ] as const)("does not turn the page while %s is held", (modifier) => {
    expect(navigationForWheel({ deltaY: 10, [modifier]: true })).toBeNull();
    expect(navigationForWheel({ deltaY: -10, [modifier]: true })).toBeNull();
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
  it("picks the nearest group when the position falls between two groups", () => {
    // 5 グループ: 0.3 → 1.2 番目 → 1、0.4 → 1.6 番目 → 2
    expect(groupIndexFromRatio(0.3, 5)).toBe(1);
    expect(groupIndexFromRatio(0.4, 5)).toBe(2);
  });

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

describe("adjacentSibling", () => {
  const list = ["a", "b", "c"];

  it("returns the following item for next", () => {
    expect(adjacentSibling(list, 0, "next")).toBe("b");
  });

  it("returns the preceding item for prev", () => {
    expect(adjacentSibling(list, 2, "prev")).toBe("b");
  });

  it("returns null at the ends of the list", () => {
    expect(adjacentSibling(list, 2, "next")).toBeNull();
    expect(adjacentSibling(list, 0, "prev")).toBeNull();
  });

  it("returns null when the current item is not in the list", () => {
    expect(adjacentSibling(list, -1, "next")).toBeNull();
    expect(adjacentSibling(list, -1, "prev")).toBeNull();
    expect(adjacentSibling(list, list.length, "prev")).toBeNull();
    expect(adjacentSibling(list, list.length + 1, "prev")).toBeNull();
  });
});

describe("siblingDirectionForMouseButton", () => {
  it("maps the mouse back button to the previous file", () => {
    expect(siblingDirectionForMouseButton(3)).toBe("prev");
  });

  it("maps the mouse forward button to the next file", () => {
    expect(siblingDirectionForMouseButton(4)).toBe("next");
  });

  it("ignores the primary, middle, and secondary buttons", () => {
    expect(siblingDirectionForMouseButton(0)).toBeNull();
    expect(siblingDirectionForMouseButton(1)).toBeNull();
    expect(siblingDirectionForMouseButton(2)).toBeNull();
  });
});

describe("siblingDirectionForKey", () => {
  it("follows the file list order: Alt+↓ is the next file, Alt+↑ the previous", () => {
    expect(siblingDirectionForKey({ key: "ArrowDown", altKey: true })).toBe("next");
    expect(siblingDirectionForKey({ key: "ArrowUp", altKey: true })).toBe("prev");
  });

  it("ignores arrows without Alt and other keys", () => {
    expect(siblingDirectionForKey({ key: "ArrowDown", altKey: false })).toBeNull();
    expect(siblingDirectionForKey({ key: "ArrowLeft", altKey: true })).toBeNull();
  });
});

describe("siblingByPath", () => {
  const files = ["/lib/v1.zip", "/lib/v2.zip", "/lib/v10.zip"];

  it("returns the neighbors of a file that is in the list", () => {
    expect(siblingByPath(files, "/lib/v2.zip", "next")).toBe("/lib/v10.zip");
    expect(siblingByPath(files, "/lib/v2.zip", "prev")).toBe("/lib/v1.zip");
    expect(siblingByPath(files, "/lib/v1.zip", "prev")).toBeNull();
    expect(siblingByPath(files, "/lib/v10.zip", "next")).toBeNull();
  });

  it("uses the place the name would take when the file is no longer in the list", () => {
    // v3.zip は消されたが、並び順では v2 と v10 のあいだ
    expect(siblingByPath(files, "/lib/v3.zip", "next")).toBe("/lib/v10.zip");
    expect(siblingByPath(files, "/lib/v3.zip", "prev")).toBe("/lib/v2.zip");
  });

  it("handles a missing file that would come first or last", () => {
    expect(siblingByPath(files, "/lib/a.zip", "prev")).toBeNull();
    expect(siblingByPath(files, "/lib/a.zip", "next")).toBe("/lib/v1.zip");
    expect(siblingByPath(files, "/lib/w.zip", "next")).toBeNull();
    expect(siblingByPath(files, "/lib/w.zip", "prev")).toBe("/lib/v10.zip");
  });

  it("returns nothing when there are no other files", () => {
    expect(siblingByPath([], "/lib/v1.zip", "next")).toBeNull();
    expect(siblingByPath(["/lib/v1.zip"], "/lib/v1.zip", "prev")).toBeNull();
  });
});
