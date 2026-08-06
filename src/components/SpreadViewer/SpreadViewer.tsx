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
import { FILE_DRAG_MIME } from "../../utils/constants";
import { errorToString } from "../../utils/errorToString";
import type { PageGroup, ReadingDirection, ViewMode } from "../../utils/spreadLayout";
import {
  buildPageGroups,
  computeFitPageCount,
  currentPageFromGroup,
  groupIndexForPage,
} from "../../utils/spreadLayout";
import {
  FitWindowIcon,
  LtrIcon,
  MoveFolderIcon,
  RtlIcon,
  SinglePageIcon,
  SpreadViewIcon,
  TriplePageIcon,
} from "../Icons/Icons";
import { PageImage } from "./PageImage";

export type SpreadViewerHandle = {
  viewMode: ViewMode;
  readingDirection: ReadingDirection;
  currentPage: number;
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
  /** マウント時に開くページ index（移動後の位置復帰用） */
  initialPage?: number;
  /** ファイル移動パネル連携（指定時のみ移動ボタンとドラッグを有効化） */
  movePanel?: {
    open: boolean;
    onToggle: () => void;
    dragData: string;
  };
  ref?: Ref<SpreadViewerHandle>;
};

/** Assumed page aspect (width/height) until a real page is measured. A4 portrait. */
const DEFAULT_PAGE_ASPECT = Math.SQRT1_2;

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
  initialPage,
  movePanel,
  ref,
}: SpreadViewerProps) {
  const [currentPage, setCurrentPage] = useState(initialPage ?? 0);
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
    currentPage: currentPageFromGroup(currentGroup),
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
    // Latch the first measured page aspect (spec: measure the first displayed page).
    // Updating on every load can oscillate fitPageCount on mixed-aspect archives.
    setPageAspect((prev) => prev ?? aspect);
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
        draggable={movePanel?.open ?? false}
        onDragStart={(e) => {
          if (!movePanel?.open) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData(FILE_DRAG_MIME, movePanel.dragData);
          e.dataTransfer.effectAllowed = "move";
        }}
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
              aria-pressed={viewMode === "single"}
            >
              <SinglePageIcon size={16} />
            </button>
            <button
              type="button"
              className={`spread-viewer__mode-toggle${viewMode === "spread" ? " spread-viewer__mode-toggle--active" : ""}`}
              onClick={() => setViewMode("spread")}
              title={VIEW_MODE_LABELS.spread}
              aria-pressed={viewMode === "spread"}
            >
              <SpreadViewIcon size={16} />
            </button>
            <button
              type="button"
              className={`spread-viewer__mode-toggle${viewMode === "triple" ? " spread-viewer__mode-toggle--active" : ""}`}
              onClick={() => setViewMode("triple")}
              title={VIEW_MODE_LABELS.triple}
              aria-pressed={viewMode === "triple"}
            >
              <TriplePageIcon size={16} />
            </button>
            <button
              type="button"
              className={`spread-viewer__mode-toggle${viewMode === "fit" ? " spread-viewer__mode-toggle--active" : ""}`}
              onClick={() => setViewMode("fit")}
              title={VIEW_MODE_LABELS.fit}
              aria-pressed={viewMode === "fit"}
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
            {movePanel && (
              <button
                type="button"
                className={`spread-viewer__mode-toggle${movePanel.open ? " spread-viewer__mode-toggle--active" : ""}`}
                onClick={movePanel.onToggle}
                title="ファイルを移動"
                aria-pressed={movePanel.open}
              >
                <MoveFolderIcon size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
