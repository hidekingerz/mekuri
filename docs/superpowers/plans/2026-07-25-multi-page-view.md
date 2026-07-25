# 表示モード拡張（single/spread/triple/fit）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ビューワーの表示モードを 4 つ（単ページ / 見開き / 3ページ見開き / ウィンドウサイズ追従見開き）に拡張する（Issue #30）。

**Architecture:** `spreadLayout.ts` の `Spread = {right, left}` モデルを「読み順のページ index 配列 `PageGroup`」に一般化し、全モードを 1 グループの枚数の違いとして統一する。RTL/LTR はレンダリング時の並び反転のみで表現する。fit モードは ResizeObserver + ページ縦横比から枚数 N を導出する。Rust（src-tauri）側の変更はない。

**Tech Stack:** React 19 + TypeScript + Vite / Vitest / Biome / Tauri v2（`@tauri-apps/api/menu` の CheckMenuItem）

**Spec:** `docs/superpowers/specs/2026-07-25-multi-page-view-design.md`

## Global Constraints

- ブランチ: `feat/multi-page-view`（`main` ベース）。`main` へ直接コミットしない
- デフォルトの表示モードは `"spread"`、既定読み方向は PDF=LTR / アーカイブ=RTL（変更しない）
- 新モード（triple/fit）では表紙の単独表示をしない。spread は現行どおり表紙単独 + 2枚組
- `viewerSettings.viewMode` に `"triple"` / `"fit"` をそのまま保存（移行処理なし）
- コミットメッセージは英語
- 各タスクの品質ゲート: `pnpm test` / `npx tsc --noEmit` / `pnpm lint` が全て成功すること
- コミット前に `pnpm format` を実行すること

---

### Task 1: spreadLayout に PageGroup ベースの新 API を追加

既存の `buildSpreads` 系 API は SpreadViewer が使用中のため**このタスクでは残し**、新 API を追加する（旧 API の削除は Task 4）。

**Files:**
- Modify: `src/utils/spreadLayout.ts`
- Test: `src/utils/spreadLayout.test.ts`（既存の describe はそのまま残し、新 API の describe を追加）

**Interfaces:**
- Consumes: なし（純関数のみ）
- Produces（Task 3 が使用）:
  - `type ViewMode = "single" | "spread" | "triple" | "fit"`（既存型の拡張）
  - `type PageGroup = number[]`
  - `buildPageGroups(totalPages: number, mode?: ViewMode, fitPageCount?: number): PageGroup[]`
  - `groupIndexForPage(groups: PageGroup[], pageIndex: number): number`
  - `currentPageFromGroup(group: PageGroup): number`
  - `computeFitPageCount(containerWidth: number, containerHeight: number, pageAspect: number): number`

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/spreadLayout.test.ts` の末尾に以下の describe ブロックを追加する（既存の import 行に新 API を加える）:

```ts
// import 行を以下に変更
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
```

```ts
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
    expect(buildPageGroups(7, "fit", 4)).toEqual([[0, 1, 2, 3], [4, 5, 6]]);
  });

  it("defaults to 2 pages per group when fitPageCount omitted", () => {
    expect(buildPageGroups(4, "fit")).toEqual([[0, 1], [2, 3]]);
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm test`
Expected: FAIL — `buildPageGroups` などが export されていない旨のエラー

- [ ] **Step 3: 新 API を実装**

`src/utils/spreadLayout.ts` に以下を加える。`ViewMode` を 4 値に拡張し（既存 `buildSpreads` は `mode === "single"` しか見ていないので影響なし）、ファイル末尾に新 API を追加する:

```ts
// 既存の型を置き換え
export type ViewMode = "single" | "spread" | "triple" | "fit";
```

```ts
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm test`
Expected: PASS（既存の buildSpreads 系テスト含め全件）

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: フォーマット・リント・コミット**

```bash
pnpm format && pnpm lint
git add src/utils/spreadLayout.ts src/utils/spreadLayout.test.ts
git commit -m "Add PageGroup-based layout API for multi-page view modes"
```

---

### Task 2: アイコン追加と PageImage の onLoad 対応

**Files:**
- Modify: `src/components/Icons/Icons.tsx`（`TriplePageIcon` / `FitWindowIcon` を追加）
- Modify: `src/components/SpreadViewer/PageImage.tsx`（`onLoad` プロパティを追加）

**Interfaces:**
- Consumes: なし
- Produces（Task 3 が使用）:
  - `TriplePageIcon({ size?: number, className?: string })`
  - `FitWindowIcon({ size?: number, className?: string })`
  - `PageImage({ src, alt, onLoad? })` — `onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void`

- [ ] **Step 1: アイコンを実装**

`src/components/Icons/Icons.tsx` の `SinglePageIcon` の直後に追加（既存アイコンと同じ `IconProps` 型を使用）:

```tsx
export function TriplePageIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="1" y="2" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="6" y="2" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="11" y="2" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function FitWindowIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="1" y="3" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M6 6L4 8L6 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 6L12 8L10 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: PageImage に onLoad を追加**

`src/components/SpreadViewer/PageImage.tsx` 全体を以下に置き換え:

```tsx
type PageImageProps = {
  src: string | null;
  alt: string;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
};

export function PageImage({ src, alt, onLoad }: PageImageProps) {
  if (!src) {
    return <div className="page-image page-image--empty" />;
  }

  return <img className="page-image" src={src} alt={alt} draggable={false} onLoad={onLoad} />;
}
```

- [ ] **Step 3: 検証**

Run: `npx tsc --noEmit`
Expected: エラーなし

Run: `pnpm test`
Expected: PASS

- [ ] **Step 4: フォーマット・リント・コミット**

```bash
pnpm format && pnpm lint
git add src/components/Icons/Icons.tsx src/components/SpreadViewer/PageImage.tsx
git commit -m "Add triple-page and fit-window icons, PageImage onLoad prop"
```

---

### Task 3: SpreadViewer を PageGroup ベースに書き換え、右クリックメニューを 4 モード化

`SpreadViewerHandle` のインターフェースが変わる（`toggleViewMode` → `setViewMode`）ため、SpreadViewer と ViewerApp のメニューは同一タスクで変更する。

**Files:**
- Modify: `src/components/SpreadViewer/SpreadViewer.tsx`（全面書き換え）
- Modify: `src/ViewerApp.tsx`（コンテキストメニュー部分のみ）
- Modify: `src/styles/viewer.css`（`__half` → `__cell`、`--active` 追加）

**Interfaces:**
- Consumes: Task 1 の `buildPageGroups` / `groupIndexForPage` / `computeFitPageCount` / `PageGroup` / `ViewMode`、Task 2 の `TriplePageIcon` / `FitWindowIcon` / `PageImage.onLoad`
- Produces: `SpreadViewerHandle = { viewMode: ViewMode; readingDirection: ReadingDirection; setViewMode: (mode: ViewMode) => void; toggleReadingDirection: () => void }`
- Props（`SpreadViewerProps`）は変更なし

**設計メモ（実装者向け）:**
- 正準状態を「グループ index」ではなく **`currentPage`（現在グループの読み順先頭ページ index）** に変更する。グループ index は `groupIndexForPage` で毎回導出する。これにより fit モードのリサイズで N が変わってグループ構成が変化しても、表示位置が自動的に保たれる
- 読み方向はグループ構成に影響しなくなった（レンダリング時に配列を反転するだけ）ため、方向切替時の位置補正は不要
- ページ送りクリックは各セルではなく `.spread-viewer__pages` コンテナの onClick 1 箇所で行い、`e.clientX` が画面左半分か右半分かで前後を判定する（従来と同じ体感）

- [ ] **Step 1: SpreadViewer.tsx を全面書き換え**

`src/components/SpreadViewer/SpreadViewer.tsx` 全体を以下に置き換え:

```tsx
import {
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { getViewerSettings, saveViewerSettings } from "../../api/settings";
import { errorToString } from "../../utils/errorToString";
import type { PageGroup, ReadingDirection, ViewMode } from "../../utils/spreadLayout";
import { buildPageGroups, computeFitPageCount, groupIndexForPage } from "../../utils/spreadLayout";
import {
  FitWindowIcon,
  LtrIcon,
  RtlIcon,
  SinglePageIcon,
  SpreadViewIcon,
  TriplePageIcon,
} from "../Icons/Icons";
import { PageImage } from "./PageImage";

export type SpreadViewerHandle = {
  viewMode: ViewMode;
  readingDirection: ReadingDirection;
  setViewMode: (mode: ViewMode) => void;
  toggleReadingDirection: () => void;
};

type SpreadViewerProps = {
  pageCount: number;
  pageNames: string[];
  getPageDataUrl: (pageIndex: number) => Promise<string>;
  onSpreadChange?: (spreadIndex: number, totalSpreads: number) => void;
  onBack?: () => void;
  defaultReadingDirection?: ReadingDirection;
  ref?: Ref<SpreadViewerHandle>;
};

/** Assumed page aspect (width/height) until a real page is measured. A4 portrait. */
const DEFAULT_PAGE_ASPECT = 0.707;

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  single: "単ページ表示",
  spread: "見開き表示",
  triple: "3ページ表示",
  fit: "ウィンドウ追従表示",
};

export function SpreadViewer({
  pageCount,
  pageNames,
  getPageDataUrl,
  onSpreadChange,
  onBack,
  defaultReadingDirection = "rtl",
  ref,
}: SpreadViewerProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [srcs, setSrcs] = useState<(string | null)[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewModeState] = useState<ViewMode>("spread");
  const [readingDirection, setReadingDirection] =
    useState<ReadingDirection>(defaultReadingDirection);
  const [pageAspect, setPageAspect] = useState<number | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const pagesRef = useRef<HTMLDivElement>(null);

  // Load saved settings on mount
  useEffect(() => {
    getViewerSettings().then((settings) => {
      if (settings.viewMode) {
        setViewModeState(settings.viewMode);
      }
      if (settings.readingDirection) {
        setReadingDirection(settings.readingDirection);
      }
    });
  }, []);

  // Track the pages container size for the fit mode
  useEffect(() => {
    const el = pagesRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isRtl = readingDirection === "rtl";

  const fitPageCount =
    viewMode === "fit"
      ? computeFitPageCount(
          containerSize.width,
          containerSize.height,
          pageAspect ?? DEFAULT_PAGE_ASPECT,
        )
      : 2;

  const groups: PageGroup[] = useMemo(
    () => buildPageGroups(pageCount, viewMode, fitPageCount),
    [pageCount, viewMode, fitPageCount],
  );

  // Derive the group index from the canonical currentPage so that position is
  // preserved whenever the grouping changes (mode switch, fit resize).
  const groupIndex = Math.max(
    0,
    groupIndexForPage(groups, Math.min(currentPage, Math.max(0, pageCount - 1))),
  );
  const currentGroup: PageGroup = groups[groupIndex] ?? [];
  const groupKey = currentGroup.join(",");

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    saveViewerSettings({ viewMode: mode });
  }, []);

  const toggleReadingDirection = useCallback(() => {
    setReadingDirection((prev) => {
      const next: ReadingDirection = prev === "rtl" ? "ltr" : "rtl";
      saveViewerSettings({ readingDirection: next });
      return next;
    });
  }, []);

  useImperativeHandle(ref, () => ({
    viewMode,
    readingDirection,
    setViewMode,
    toggleReadingDirection,
  }));

  // Notify parent of group change
  useEffect(() => {
    onSpreadChange?.(groupIndex, groups.length);
  }, [groupIndex, groups.length, onSpreadChange]);

  // Load images for the current group
  useEffect(() => {
    let cancelled = false;
    const pages = groupKey === "" ? [] : groupKey.split(",").map(Number);

    setSrcs(pages.map(() => null));
    setLoadError(null);
    if (pages.length === 0) return;

    Promise.all(pages.map((p) => getPageDataUrl(p)))
      .then((loaded) => {
        if (!cancelled) setSrcs(loaded);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorToString(err));
      });

    return () => {
      cancelled = true;
    };
  }, [getPageDataUrl, groupKey]);

  const goNext = useCallback(() => {
    const next = groups[groupIndex + 1];
    if (next) setCurrentPage(next[0]);
  }, [groups, groupIndex]);

  const goPrev = useCallback(() => {
    const prev = groups[groupIndex - 1];
    if (prev) setCurrentPage(prev[0]);
  }, [groups, groupIndex]);

  // Keyboard navigation (direction-aware)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        isRtl ? goNext() : goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        isRtl ? goPrev() : goNext();
      } else if (e.key === "Home") {
        e.preventDefault();
        setCurrentPage(0);
      } else if (e.key === "End") {
        e.preventDefault();
        const last = groups[groups.length - 1];
        if (last) setCurrentPage(last[0]);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, groups, isRtl]);

  // Mouse wheel navigation
  useEffect(() => {
    let lastWheelTime = 0;
    const wheelThrottleMs = 200;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheelTime < wheelThrottleMs) return;
      lastWheelTime = now;

      if (e.deltaY > 0) {
        goNext();
      } else if (e.deltaY < 0) {
        goPrev();
      }
    }

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [goNext, goPrev]);

  const isFirst = groupIndex === 0;
  const isLast = groupIndex >= groups.length - 1;
  const progressPercent = groups.length > 1 ? (groupIndex / (groups.length - 1)) * 100 : 100;

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = isRtl
        ? (rect.right - e.clientX) / rect.width
        : (e.clientX - rect.left) / rect.width;
      const newIndex = Math.round(ratio * (groups.length - 1));
      const clamped = Math.max(0, Math.min(newIndex, groups.length - 1));
      const group = groups[clamped];
      if (group) setCurrentPage(group[0]);
    },
    [groups, isRtl],
  );

  // Page-turn by clicking the left/right half of the pages area
  const handlePagesClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const isLeftHalf = e.clientX < window.innerWidth / 2;
      if (isLeftHalf) {
        isRtl ? goNext() : goPrev();
      } else {
        isRtl ? goPrev() : goNext();
      }
    },
    [isRtl, goNext, goPrev],
  );

  // Measure the real page aspect for the fit mode
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
    const aspect = img.naturalWidth / img.naturalHeight;
    setPageAspect((prev) => (prev !== null && Math.abs(prev - aspect) < 0.001 ? prev : aspect));
  }, []);

  const displayPages = isRtl ? [...currentGroup].reverse() : currentGroup;
  const displaySrcs = isRtl ? [...srcs].reverse() : srcs;
  const isPair = displayPages.length === 2;

  return (
    <div className="spread-viewer">
      {loadError && (
        <div className="spread-viewer__error">
          <p>Failed to load image: {loadError}</p>
        </div>
      )}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: keyboard nav handled at window level */}
      <div
        className={`spread-viewer__pages${isPair ? " spread-viewer__pages--pair" : ""}`}
        ref={pagesRef}
        onClick={handlePagesClick}
      >
        {displayPages.map((pageIndex, i) => (
          <div className="spread-viewer__cell" key={pageIndex}>
            <PageImage
              src={displaySrcs[i] ?? null}
              alt={pageNames[pageIndex] ?? ""}
              onLoad={handleImageLoad}
            />
          </div>
        ))}
      </div>
      <div className="spread-viewer__footer">
        {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: mouse interaction for progress bar */}
        <div className="spread-viewer__progress" onClick={handleProgressClick}>
          <div
            className="spread-viewer__progress-fill"
            style={
              isRtl
                ? { width: `${progressPercent}%`, right: 0, left: "auto" }
                : { width: `${progressPercent}%`, left: 0, right: "auto" }
            }
          />
          <div
            className="spread-viewer__progress-thumb"
            style={
              isRtl
                ? { right: `${progressPercent}%`, left: "auto", transform: "translate(50%, -50%)" }
                : { left: `${progressPercent}%`, right: "auto", transform: "translate(-50%, -50%)" }
            }
          />
        </div>
        <div className="spread-viewer__nav">
          {onBack && (
            <button type="button" className="spread-viewer__back" onClick={onBack}>
              ≡
            </button>
          )}
          <button
            type="button"
            disabled={isRtl ? isLast : isFirst}
            onClick={isRtl ? goNext : goPrev}
          >
            ←
          </button>
          <span className="spread-viewer__info">
            {groupIndex + 1} / {groups.length}
          </span>
          <button
            type="button"
            disabled={isRtl ? isFirst : isLast}
            onClick={isRtl ? goPrev : goNext}
          >
            →
          </button>
          <div className="spread-viewer__toggles">
            <button
              type="button"
              className={`spread-viewer__mode-toggle${viewMode === "single" ? " spread-viewer__mode-toggle--active" : ""}`}
              onClick={() => setViewMode("single")}
              title={VIEW_MODE_LABELS.single}
            >
              <SinglePageIcon size={16} />
            </button>
            <button
              type="button"
              className={`spread-viewer__mode-toggle${viewMode === "spread" ? " spread-viewer__mode-toggle--active" : ""}`}
              onClick={() => setViewMode("spread")}
              title={VIEW_MODE_LABELS.spread}
            >
              <SpreadViewIcon size={16} />
            </button>
            <button
              type="button"
              className={`spread-viewer__mode-toggle${viewMode === "triple" ? " spread-viewer__mode-toggle--active" : ""}`}
              onClick={() => setViewMode("triple")}
              title={VIEW_MODE_LABELS.triple}
            >
              <TriplePageIcon size={16} />
            </button>
            <button
              type="button"
              className={`spread-viewer__mode-toggle${viewMode === "fit" ? " spread-viewer__mode-toggle--active" : ""}`}
              onClick={() => setViewMode("fit")}
              title={VIEW_MODE_LABELS.fit}
            >
              <FitWindowIcon size={16} />
            </button>
            <button
              type="button"
              className="spread-viewer__mode-toggle"
              onClick={toggleReadingDirection}
              title={isRtl ? "右→左 (RTL)" : "左→右 (LTR)"}
            >
              {isRtl ? <RtlIcon size={16} /> : <LtrIcon size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

注意点:
- `settingsLoaded` ref は旧コードでも未使用だったため削除してよい
- `VIEW_MODE_LABELS` は Step 3 のコンテキストメニューと文言を一致させること

- [ ] **Step 2: viewer.css のセルスタイルを書き換え**

`src/styles/viewer.css` の `.spread-viewer__half` 〜 `.spread-viewer__half--single .page-image`（`/* Page image */` の `.page-image` 本体は残す）を以下に置き換え:

```css
.spread-viewer__cell {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
}

/* Page image */
.page-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

/* Two-page spread: align images toward the spine so extra space appears on the outer edges */
.spread-viewer__pages--pair .spread-viewer__cell:first-child {
  justify-content: flex-end;
}

.spread-viewer__pages--pair .spread-viewer__cell:first-child .page-image {
  object-position: right center;
}

.spread-viewer__pages--pair .spread-viewer__cell:last-child {
  justify-content: flex-start;
}

.spread-viewer__pages--pair .spread-viewer__cell:last-child .page-image {
  object-position: left center;
}
```

さらに `.spread-viewer__mode-toggle` の直後にアクティブ状態のスタイルを追加:

```css
.spread-viewer__mode-toggle--active {
  background: var(--viewer-color-bg-hover);
  border-color: var(--viewer-color-accent);
  color: var(--viewer-color-accent);
}
```

- [ ] **Step 3: ViewerApp のコンテキストメニューを 4 モード化**

`src/ViewerApp.tsx` の `handleContextMenu` 内、`viewModeItem` / `directionItem` の構築部分（`const { Menu, MenuItem, PredefinedMenuItem } = ...` から `const menu = await Menu.new({...})` まで）を以下に置き換え:

```tsx
const { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem } = await import(
  "@tauri-apps/api/menu"
);
const handle = spreadViewerRef.current;

const modeEntries = [
  ["single", "単ページ表示"],
  ["spread", "見開き表示"],
  ["triple", "3ページ表示"],
  ["fit", "ウィンドウ追従表示"],
] as const;

const modeItems = await Promise.all(
  modeEntries.map(([mode, text]) =>
    CheckMenuItem.new({
      text,
      checked: handle?.viewMode === mode,
      action: () => handle?.setViewMode(mode),
    }),
  ),
);

const directionItem = await MenuItem.new({
  text: handle?.readingDirection === "rtl" ? "左→右 (LTR) に切替" : "右→左 (RTL) に切替",
  action: () => handle?.toggleReadingDirection(),
});

const separator0 = await PredefinedMenuItem.new({ item: "Separator" });
const separator1 = await PredefinedMenuItem.new({ item: "Separator" });
const separator2 = await PredefinedMenuItem.new({ item: "Separator" });

const trashItem = await MenuItem.new({
  text: "Move to Trash",
  action: handleTrash,
});

const closeItem = await MenuItem.new({
  text: "Close Window",
  action: () => getCurrentWindow().close(),
});

const menu = await Menu.new({
  items: [...modeItems, separator0, directionItem, separator1, trashItem, separator2, closeItem],
});
await menu.popup();
```

- [ ] **Step 4: 検証**

Run: `npx tsc --noEmit`
Expected: エラーなし

Run: `pnpm test`
Expected: PASS

Run: `pnpm lint`
Expected: エラーなし（biome-ignore コメントの位置に注意）

手動確認（可能な環境であれば）: `pnpm tauri dev` でビューワーを開き、4 ボタンでモードが切り替わること・fit モードでウィンドウリサイズすると枚数が変わること・右クリックメニューに 4 項目とチェックが出ることを確認

- [ ] **Step 5: フォーマット・コミット**

```bash
pnpm format && pnpm lint
git add src/components/SpreadViewer/SpreadViewer.tsx src/ViewerApp.tsx src/styles/viewer.css
git commit -m "Rewrite SpreadViewer with page groups; add triple and fit view modes"
```

---

### Task 4: 旧 Spread API の削除と最終品質ゲート

**Files:**
- Modify: `src/utils/spreadLayout.ts`（`Spread` 型・`buildSpreads`・`spreadIndexForPage`・`currentPageFromSpread` を削除）
- Modify: `src/utils/spreadLayout.test.ts`（旧 API の describe ブロックと import を削除）

**Interfaces:**
- Consumes: なし
- Produces: なし（削除のみ。残る export は `ViewMode` / `ReadingDirection` / `PageGroup` / `buildPageGroups` / `groupIndexForPage` / `currentPageFromGroup` / `computeFitPageCount`）

- [ ] **Step 1: 参照が残っていないことを確認**

Run: `grep -rn "buildSpreads\|spreadIndexForPage\|currentPageFromSpread\|Spread\b" src/ --include="*.ts" --include="*.tsx" | grep -v spreadLayout`
Expected: 出力なし（spreadLayout 以外に参照ゼロ。`SpreadViewer` / `SpreadViewIcon` などの名称は `Spread\b` にマッチしないため除外される）

- [ ] **Step 2: 旧 API を削除**

`src/utils/spreadLayout.ts` から以下を削除:
- `Spread` 型定義
- `buildSpreads` 関数
- `spreadIndexForPage` 関数
- `currentPageFromSpread` 関数
- ファイル冒頭コメントの旧ルール記述（PageGroup ベースの説明に書き換え）

`src/utils/spreadLayout.test.ts` から以下を削除:
- `buildSpreads` / `spreadIndexForPage` / `currentPageFromSpread` を使う全 describe ブロック
  （`buildSpreads`、`buildSpreads (single mode)`、`spreadIndexForPage (spread mode)`、`buildSpreads (LTR spread mode)`、`spreadIndexForPage (LTR spread mode)`、`currentPageFromSpread`、`spreadIndexForPage (single mode)`）
- import から `buildSpreads` / `spreadIndexForPage` / `currentPageFromSpread` / `ReadingDirection` を削除
  （新テストは `ViewMode` も直接は使っていないため、未使用なら合わせて削除）

- [ ] **Step 3: 全品質ゲートを実行**

```bash
pnpm format
pnpm lint
pnpm test
npx tsc --noEmit
```

Expected: すべて成功（テストは新 API 分のみで全件 PASS）

- [ ] **Step 4: コミット**

```bash
git add src/utils/spreadLayout.ts src/utils/spreadLayout.test.ts
git commit -m "Remove legacy Spread API superseded by PageGroup"
```

---

## 完了後

1. `git push -u origin feat/multi-page-view`
2. `gh pr create` で `main` 向け PR を作成（PR 本文に `Closes #30` を含める）
3. CI（TypeScript + Rust）の通過を確認してからマージ
