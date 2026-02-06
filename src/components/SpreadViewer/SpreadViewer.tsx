import { useCallback, useEffect, useMemo, useState } from "react";
import { getArchiveImage } from "../../hooks/useArchive";
import type { Spread } from "../../utils/spreadLayout";
import { buildSpreads } from "../../utils/spreadLayout";
import { PageImage } from "./PageImage";

interface SpreadViewerProps {
  archivePath: string;
  imageNames: string[];
}

export function SpreadViewer({ archivePath, imageNames }: SpreadViewerProps) {
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [rightSrc, setRightSrc] = useState<string | null>(null);
  const [leftSrc, setLeftSrc] = useState<string | null>(null);

  const spreads: Spread[] = useMemo(() => buildSpreads(imageNames.length), [imageNames.length]);

  const currentSpread = spreads[spreadIndex] ?? { right: null, left: null };

  // Load images for current spread
  useEffect(() => {
    let cancelled = false;

    async function loadImages() {
      setRightSrc(null);
      setLeftSrc(null);

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

  const isFirst = spreadIndex === 0;
  const isLast = spreadIndex >= spreads.length - 1;

  return (
    <div className="spread-viewer">
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
      <div className="spread-viewer__nav">
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
  );
}
