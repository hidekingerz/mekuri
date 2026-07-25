/**
 * Spread (two-page) layout calculation supporting both RTL and LTR reading.
 *
 * Rules (spread mode):
 * - First page (index 0) is displayed alone (cover page)
 * - Subsequent pages are displayed in pairs
 * - RTL: right side = earlier page, left side = later page
 * - LTR: left side = earlier page, right side = later page
 * - Last page may be displayed alone if total count is even
 *
 * Rules (single mode):
 * - Each page is displayed alone (one page per view)
 */

export type ViewMode = "single" | "spread" | "triple" | "fit";

export type ReadingDirection = "rtl" | "ltr";

export type Spread = {
  /** Page index for the right side (null if single-page spread on left) */
  right: number | null;
  /** Page index for the left side (null if single-page spread on right) */
  left: number | null;
};

/**
 * Build the list of spreads for a given total page count, view mode, and reading direction.
 */
export function buildSpreads(
  totalPages: number,
  mode: ViewMode = "spread",
  direction: ReadingDirection = "rtl",
): Spread[] {
  if (totalPages <= 0) return [];

  if (mode === "single") {
    return Array.from({ length: totalPages }, (_, i) => ({ right: i, left: null }));
  }

  const isRtl = direction === "rtl";
  const spreads: Spread[] = [];

  // First page is always single (cover)
  spreads.push(isRtl ? { right: 0, left: null } : { right: null, left: 0 });

  // Pair up remaining pages
  let i = 1;
  while (i < totalPages) {
    if (i + 1 < totalPages) {
      spreads.push(isRtl ? { right: i, left: i + 1 } : { left: i, right: i + 1 });
      i += 2;
    } else {
      // Last page alone
      spreads.push(isRtl ? { right: i, left: null } : { right: null, left: i });
      i += 1;
    }
  }

  return spreads;
}

/**
 * Get the spread index that contains a given page index.
 */
export function spreadIndexForPage(spreads: Spread[], pageIndex: number): number {
  return spreads.findIndex((s) => s.right === pageIndex || s.left === pageIndex);
}

/**
 * Get the current page index from a spread (first page in reading order).
 */
export function currentPageFromSpread(spread: Spread, direction: ReadingDirection): number {
  if (direction === "rtl") {
    return spread.right ?? spread.left ?? 0;
  }
  return spread.left ?? spread.right ?? 0;
}

/** Pages shown together, as page indices in reading order. RTL/LTR is applied at render time. */
export type PageGroup = number[];

const DEFAULT_FIT_PAGE_COUNT = 2;

/**
 * Build page groups for a view mode.
 * - "single": one page per group
 * - "spread": first page alone (cover), then pairs
 * - "triple": three pages per group, no cover
 * - "fit":   fitPageCount pages per group, no cover
 */
export function buildPageGroups(
  totalPages: number,
  mode: ViewMode = "spread",
  fitPageCount: number = DEFAULT_FIT_PAGE_COUNT,
): PageGroup[] {
  if (totalPages <= 0) return [];

  let groupSize: number;
  let coverAlone = false;
  switch (mode) {
    case "single":
      groupSize = 1;
      break;
    case "spread":
      groupSize = 2;
      coverAlone = true;
      break;
    case "triple":
      groupSize = 3;
      break;
    case "fit":
      groupSize = Math.max(1, Math.floor(fitPageCount));
      break;
  }

  const groups: PageGroup[] = [];
  let i = 0;
  if (coverAlone) {
    groups.push([0]);
    i = 1;
  }
  while (i < totalPages) {
    const group: PageGroup = [];
    for (let k = 0; k < groupSize && i < totalPages; k++, i++) {
      group.push(i);
    }
    groups.push(group);
  }
  return groups;
}

/** Get the group index that contains a given page index (-1 if not found). */
export function groupIndexForPage(groups: PageGroup[], pageIndex: number): number {
  return groups.findIndex((g) => g.includes(pageIndex));
}

/** Get the current page index from a group (first page in reading order). */
export function currentPageFromGroup(group: PageGroup): number {
  return group[0] ?? 0;
}

/**
 * Number of pages that fit side-by-side when each page is rendered at full container height.
 * pageAspect is the page width/height ratio. Always at least 1.
 */
export function computeFitPageCount(
  containerWidth: number,
  containerHeight: number,
  pageAspect: number,
): number {
  if (containerWidth <= 0 || containerHeight <= 0 || pageAspect <= 0) return 1;
  return Math.max(1, Math.floor(containerWidth / (containerHeight * pageAspect)));
}
