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
import type { ReadingDirection, Spread, ViewMode } from "../../utils/spreadLayout";
import { buildSpreads, currentPageFromSpread, spreadIndexForPage } from "../../utils/spreadLayout";
import { LtrIcon, RtlIcon, SinglePageIcon, SpreadViewIcon } from "../Icons/Icons";
import { PageImage } from "./PageImage";

export type SpreadViewerHandle = {
  viewMode: ViewMode;
  readingDirection: ReadingDirection;
  toggleViewMode: () => void;
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

export function SpreadViewer({
  pageCount,
  pageNames,
  getPageDataUrl,
  onSpreadChange,
  onBack,
  defaultReadingDirection = "rtl",
  ref,
}: SpreadViewerProps) {
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [rightSrc, setRightSrc] = useState<string | null>(null);
  const [leftSrc, setLeftSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("spread");
  const [readingDirection, setReadingDirection] =
    useState<ReadingDirection>(defaultReadingDirection);
  const settingsLoaded = useRef(false);

  // Load saved settings on mount
  useEffect(() => {
    getViewerSettings().then((settings) => {
      if (settings.viewMode) {
        setViewMode(settings.viewMode);
      }
      if (settings.readingDirection) {
        setReadingDirection(settings.readingDirection);
      }
      settingsLoaded.current = true;
    });
  }, []);

  const isRtl = readingDirection === "rtl";

  const spreads: Spread[] = useMemo(
    () => buildSpreads(pageCount, viewMode, readingDirection),
    [pageCount, viewMode, readingDirection],
  );

  const currentSpread = spreads[spreadIndex] ?? { right: null, left: null };

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next: ViewMode = prev === "spread" ? "single" : "spread";
      // Preserve current page position
      const currentPageIndex = currentPageFromSpread(
        spreads[spreadIndex] ?? { right: null, left: null },
        readingDirection,
      );
      const newSpreads = buildSpreads(pageCount, next, readingDirection);
      const newIndex = spreadIndexForPage(newSpreads, currentPageIndex);
      setSpreadIndex(Math.max(0, newIndex));
      saveViewerSettings({ viewMode: next });
      return next;
    });
  }, [spreads, spreadIndex, pageCount, readingDirection]);

  const toggleReadingDirection = useCallback(() => {
    setReadingDirection((prev) => {
      const next: ReadingDirection = prev === "rtl" ? "ltr" : "rtl";
      // Preserve current page position
      const currentPageIndex = currentPageFromSpread(
        spreads[spreadIndex] ?? { right: null, left: null },
        prev,
      );
      const newSpreads = buildSpreads(pageCount, viewMode, next);
      const newIndex = spreadIndexForPage(newSpreads, currentPageIndex);
      setSpreadIndex(Math.max(0, newIndex));
      saveViewerSettings({ readingDirection: next });
      return next;
    });
  }, [spreads, spreadIndex, pageCount, viewMode]);

  useImperativeHandle(ref, () => ({
    viewMode,
    readingDirection,
    toggleViewMode,
    toggleReadingDirection,
  }));

  // Notify parent of spread change
  useEffect(() => {
    onSpreadChange?.(spreadIndex, spreads.length);
  }, [spreadIndex, spreads.length, onSpreadChange]);

  // Load images for current spread
  useEffect(() => {
    let cancelled = false;

    async function loadImages() {
      setRightSrc(null);
      setLeftSrc(null);
      setLoadError(null);

      try {
        const [right, left] = await Promise.all([
          currentSpread.right !== null
            ? getPageDataUrl(currentSpread.right)
            : Promise.resolve(null),
          currentSpread.left !== null ? getPageDataUrl(currentSpread.left) : Promise.resolve(null),
        ]);

        if (!cancelled) {
          setRightSrc(right);
          setLeftSrc(left);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(errorToString(err));
        }
      }
    }

    loadImages();
    return () => {
      cancelled = true;
    };
  }, [getPageDataUrl, currentSpread.right, currentSpread.left]);

  const goNext = useCallback(() => {
    setSpreadIndex((prev) => Math.min(prev + 1, spreads.length - 1));
  }, [spreads.length]);

  const goPrev = useCallback(() => {
    setSpreadIndex((prev) => Math.max(prev - 1, 0));
  }, []);

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
        setSpreadIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setSpreadIndex(spreads.length - 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, spreads.length, isRtl]);

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

  const isFirst = spreadIndex === 0;
  const isLast = spreadIndex >= spreads.length - 1;
  const progressPercent = spreads.length > 1 ? (spreadIndex / (spreads.length - 1)) * 100 : 100;

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = isRtl
        ? (rect.right - e.clientX) / rect.width
        : (e.clientX - rect.left) / rect.width;
      const newIndex = Math.round(ratio * (spreads.length - 1));
      setSpreadIndex(Math.max(0, Math.min(newIndex, spreads.length - 1)));
    },
    [spreads.length, isRtl],
  );

  const isSingle = viewMode === "single";

  return (
    <div className="spread-viewer">
      {loadError && (
        <div className="spread-viewer__error">
          <p>Failed to load image: {loadError}</p>
        </div>
      )}
      <div className="spread-viewer__pages">
        {isSingle ? (
          // Single page mode: one full-width page
          // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: keyboard nav handled at window level
          <div className="spread-viewer__half spread-viewer__half--single" onClick={goNext}>
            <PageImage
              src={rightSrc}
              alt={currentSpread.right !== null ? pageNames[currentSpread.right] : ""}
            />
          </div>
        ) : (
          <>
            {/* Left half of screen: next in RTL, prev in LTR */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: keyboard nav handled at window level */}
            <div className="spread-viewer__half" onClick={isRtl ? goNext : goPrev}>
              <PageImage
                src={leftSrc}
                alt={currentSpread.left !== null ? pageNames[currentSpread.left] : ""}
              />
            </div>
            {/* Right half of screen: prev in RTL, next in LTR */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: keyboard nav handled at window level */}
            <div className="spread-viewer__half" onClick={isRtl ? goPrev : goNext}>
              <PageImage
                src={rightSrc}
                alt={currentSpread.right !== null ? pageNames[currentSpread.right] : ""}
              />
            </div>
          </>
        )}
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
            {spreadIndex + 1} / {spreads.length}
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
              className="spread-viewer__mode-toggle"
              onClick={toggleViewMode}
              title={isSingle ? "見開き表示" : "単ページ表示"}
            >
              {isSingle ? <SpreadViewIcon size={16} /> : <SinglePageIcon size={16} />}
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
