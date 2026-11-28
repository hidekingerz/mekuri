import { describe, expect, it } from "vitest";
import type { FileSort } from "./fileSort";
import {
  adjacentSibling,
  currentEntry,
  groupIndexFromRatio,
  navigationForClick,
  navigationForKey,
  navigationForWheel,
  progressRatio,
  siblingDirectionForKey,
  siblingDirectionForMouseButton,
  siblingPath,
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

describe("siblingPath", () => {
  const file = (name: string, modified_ms: number | null = null, size: number | null = null) => ({
    path: `/lib/${name}`,
    name,
    modified_ms,
    size,
  });
  const byName: FileSort = { key: "name", direction: "asc" };
  const files = [file("v1.zip"), file("v2.zip"), file("v10.zip")];

  it("returns the neighbors of a file that is in the list", () => {
    expect(siblingPath(files, byName, file("v2.zip"), "next")).toBe("/lib/v10.zip");
    expect(siblingPath(files, byName, file("v2.zip"), "prev")).toBe("/lib/v1.zip");
    expect(siblingPath(files, byName, file("v1.zip"), "prev")).toBeNull();
    expect(siblingPath(files, byName, file("v10.zip"), "next")).toBeNull();
  });

  it("follows the order of the list it is given, whatever the sort", () => {
    // 更新日時の新しい順に並べた一覧。名前の順とは違う
    const newestFirst: FileSort = { key: "modified", direction: "desc" };
    const sorted = [file("v2.zip", 300), file("v10.zip", 200), file("v1.zip", 100)];
    expect(siblingPath(sorted, newestFirst, sorted[0], "next")).toBe("/lib/v10.zip");
    expect(siblingPath(sorted, newestFirst, sorted[1], "next")).toBe("/lib/v1.zip");
    expect(siblingPath(sorted, newestFirst, sorted[1], "prev")).toBe("/lib/v2.zip");
    expect(siblingPath(sorted, newestFirst, sorted[2], "next")).toBeNull();
  });

  it("uses the place the name would take when the file is no longer in the list", () => {
    // v3.zip は消されたが、並び順では v2 と v10 のあいだ
    expect(siblingPath(files, byName, file("v3.zip"), "next")).toBe("/lib/v10.zip");
    expect(siblingPath(files, byName, file("v3.zip"), "prev")).toBe("/lib/v2.zip");
  });

  it("uses the place the file had in a descending name order", () => {
    const descending: FileSort = { key: "name", direction: "desc" };
    const reversed = [...files].reverse();
    expect(siblingPath(reversed, descending, file("v3.zip"), "next")).toBe("/lib/v2.zip");
    expect(siblingPath(reversed, descending, file("v3.zip"), "prev")).toBe("/lib/v10.zip");
  });

  it("uses the place the last known date would take when the list is sorted by date", () => {
    const newestFirst: FileSort = { key: "modified", direction: "desc" };
    const sorted = [file("v2.zip", 300), file("v1.zip", 100)];
    // 消された v10.zip は、最後に見えたとき更新日時が 200 だった
    expect(siblingPath(sorted, newestFirst, file("v10.zip", 200), "next")).toBe("/lib/v1.zip");
    expect(siblingPath(sorted, newestFirst, file("v10.zip", 200), "prev")).toBe("/lib/v2.zip");
  });

  it("handles a missing file that would come first or last", () => {
    expect(siblingPath(files, byName, file("a.zip"), "prev")).toBeNull();
    expect(siblingPath(files, byName, file("a.zip"), "next")).toBe("/lib/v1.zip");
    expect(siblingPath(files, byName, file("w.zip"), "next")).toBeNull();
    expect(siblingPath(files, byName, file("w.zip"), "prev")).toBe("/lib/v10.zip");
  });

  it("returns nothing when there are no other files", () => {
    expect(siblingPath([], byName, file("v1.zip"), "next")).toBeNull();
    expect(siblingPath([file("v1.zip")], byName, file("v1.zip"), "prev")).toBeNull();
  });
});

describe("currentEntry", () => {
  const listed = { path: "/lib/v2.zip", name: "v2.zip", modified_ms: 300, size: 20 };

  it("takes the entry from the list when the file is there", () => {
    const stale = { ...listed, modified_ms: 1 };
    expect(currentEntry([listed], "/lib/v2.zip", stale)).toBe(listed);
  });

  it("falls back to what was last seen for the same file once it left the list", () => {
    expect(currentEntry([], "/lib/v2.zip", listed)).toBe(listed);
  });

  it("does not reuse what was last seen for another file", () => {
    expect(currentEntry([], "/lib/v9.zip", listed)).toEqual({
      path: "/lib/v9.zip",
      name: "v9.zip",
      modified_ms: null,
      size: null,
    });
  });

  it("treats a file never seen in the list as one without a date or size", () => {
    expect(currentEntry([], "C:\\lib\\v9.zip", null)).toEqual({
      path: "C:\\lib\\v9.zip",
      name: "v9.zip",
      modified_ms: null,
      size: null,
    });
  });
});
