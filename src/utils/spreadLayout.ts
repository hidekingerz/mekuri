/**
 * PageGroup-based layout calculation for viewing modes.
 *
 * A PageGroup is a list of page indices shown together. Layout depends on view mode:
 * - "single": one page per group
 * - "spread": first page alone (cover), then pairs
 * - "triple": three pages per group, no cover
 * - "fit":   fitPageCount pages per group, no cover
 *
 * RTL/LTR reading direction is applied at render time.
 */

export type ViewMode = "single" | "spread" | "triple" | "fit";

export type ReadingDirection = "rtl" | "ltr";

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
