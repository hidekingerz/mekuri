/**
 * Spread (two-page) layout calculation for right-to-left (RTL) reading.
 *
 * Rules (spread mode):
 * - First page (index 0) is displayed alone (cover page)
 * - Subsequent pages are displayed in pairs
 * - RTL: right side = earlier page, left side = later page
 * - Last page may be displayed alone if total count is even
 *
 * Rules (single mode):
 * - Each page is displayed alone (one page per view)
 */

export type ViewMode = "spread" | "single";

export type Spread = {
  /** Page index for the right side (null if single-page spread on left) */
  right: number | null;
  /** Page index for the left side (null if single-page spread on right) */
  left: number | null;
};

/**
 * Build the list of spreads for a given total page count and view mode.
 */
export function buildSpreads(totalPages: number, mode: ViewMode = "spread"): Spread[] {
  if (totalPages <= 0) return [];

  if (mode === "single") {
    return Array.from({ length: totalPages }, (_, i) => ({ right: i, left: null }));
  }

  const spreads: Spread[] = [];

  // First page is always single (cover)
  spreads.push({ right: 0, left: null });

  // Pair up remaining pages
  let i = 1;
  while (i < totalPages) {
    if (i + 1 < totalPages) {
      // RTL: right = earlier page, left = later page
      spreads.push({ right: i, left: i + 1 });
      i += 2;
    } else {
      // Last page alone
      spreads.push({ right: i, left: null });
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
