import { useCallback, useEffect, useMemo, useState } from "react";
import { getArchiveImage } from "../../hooks/useArchive";
import type { Spread } from "../../utils/spreadLayout";
import { buildSpreads } from "../../utils/spreadLayout";
import { PageImage } from "./PageImage";

interface SpreadViewerProps {
  archivePath: string;
  imageNames: string[];
  onSpreadChange?: (spreadIndex: number, totalSpreads: number) => void;
  onBack?: () => void;
}

export function SpreadViewer({
  archivePath,
  imageNames,
  onSpreadChange,
  onBack,
}: SpreadViewerProps) {
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [rightSrc, setRightSrc] = useState<string | null>(null);
  const [leftSrc, setLeftSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const spreads: Spread[] = useMemo(() => buildSpreads(imageNames.length), [imageNames.length]);

  const currentSpread = spreads[spreadIndex] ?? { right: null, left: null };

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
            ? getArchiveImage(archivePath, imageNames[currentSpread.right])
            : Promise.resolve(null),
          currentSpread.left !== null
            ? getArchiveImage(archivePath, imageNames[currentSpread.left])
            : Promise.resolve(null),
        ]);

        if (!cancelled) {
          setRightSrc(right);
          setLeftSrc(left);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(String(err));
        }
      }
    }

    loadImages();
    return () => {
      cancelled = true;
    };
  }, [archivePath, imageNames, currentSpread.right, currentSpread.left]);

  const goNext = useCallback(() => {
    setSpreadIndex((prev) => Math.min(prev + 1, spreads.length - 1));
  }, [spreads.length]);

  const goPrev = useCallback(() => {
    setSpreadIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goPrev();
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
  }, [goNext, goPrev, spreads.length]);

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
      const clickX = rect.right - e.clientX;
      const ratio = clickX / rect.width;
      const newIndex = Math.round(ratio * (spreads.length - 1));
      setSpreadIndex(Math.max(0, Math.min(newIndex, spreads.length - 1)));
    },
    [spreads.length],
  );

  return (
    <div className="spread-viewer">
      {loadError && (
        <div className="spread-viewer__error">
          <p>Failed to load image: {loadError}</p>
        </div>
      )}
      <div className="spread-viewer__pages">
        {/* RTL: left side = later page, click to go next */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: keyboard nav handled at window level */}
        <div className="spread-viewer__half" onClick={goNext}>
          <PageImage
            src={leftSrc}
            alt={currentSpread.left !== null ? imageNames[currentSpread.left] : ""}
          />
        </div>
        {/* RTL: right side = earlier page, click to go prev */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: keyboard nav handled at window level */}
        <div className="spread-viewer__half" onClick={goPrev}>
          <PageImage
            src={rightSrc}
            alt={currentSpread.right !== null ? imageNames[currentSpread.right] : ""}
          />
        </div>
      </div>
      <div className="spread-viewer__footer">
        {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: mouse interaction for progress bar */}
        <div className="spread-viewer__progress" onClick={handleProgressClick}>
          <div className="spread-viewer__progress-fill" style={{ width: `${progressPercent}%` }} />
          <div className="spread-viewer__progress-thumb" style={{ right: `${progressPercent}%` }} />
        </div>
        <div className="spread-viewer__nav">
          {onBack && (
            <button type="button" className="spread-viewer__back" onClick={onBack}>
              ≡
            </button>
          )}
          <button type="button" disabled={isLast} onClick={goNext}>
            ←
          </button>
          <span className="spread-viewer__info">
            {spreadIndex + 1} / {spreads.length}
          </span>
          <button type="button" disabled={isFirst} onClick={goPrev}>
            →
          </button>
        </div>
      </div>
    </div>
  );
}
