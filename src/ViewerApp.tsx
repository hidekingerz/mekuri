import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";
import {
  type ArchiveContents,
  analyzeArchiveContents,
  extractNestedArchive,
  listArchiveImages,
} from "./api/archive";
import { getSiblingArchives } from "./api/directory";
import { saveViewerSettings } from "./api/settings";
import { SpreadViewer } from "./components/SpreadViewer/SpreadViewer";
import { useWindowResize } from "./hooks/useWindowResize";
import { fileNameFromPath } from "./utils/windowLabel";

function Viewer() {
  const [archivePath, setArchivePath] = useState<string | null>(null);
  const [effectivePath, setEffectivePath] = useState<string | null>(null);
  const [imageNames, setImageNames] = useState<string[]>([]);
  const [nestedArchives, setNestedArchives] = useState<string[] | null>(null);
  const [cachedNestedArchives, setCachedNestedArchives] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read archive path from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = params.get("archive");
    if (path) {
      setArchivePath(path);
    }
  }, []);

  const handleWindowResize = useCallback(async (size: { width: number; height: number }) => {
    await saveViewerSettings(size);
  }, []);
  useWindowResize(handleWindowResize);

  // Navigate to sibling archive with Alt+Arrow keys
  useEffect(() => {
    if (!archivePath) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;

      e.preventDefault();

      try {
        const { archives, currentIndex } = await getSiblingArchives(archivePath);
        if (currentIndex === -1 || archives.length <= 1) return;

        let newIndex: number;
        if (e.key === "ArrowUp") {
          newIndex = currentIndex + 1;
          if (newIndex >= archives.length) return;
        } else {
          newIndex = currentIndex - 1;
          if (newIndex < 0) return;
        }

        const newPath = archives[newIndex];
        setArchivePath(newPath);

        const fileName = fileNameFromPath(newPath);
        await getCurrentWindow().setTitle(`${fileName} - mekuri`);
      } catch (err) {
        console.error("Failed to navigate to sibling archive:", err);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [archivePath]);

  // Analyze archive contents when archive path is set
  useEffect(() => {
    if (!archivePath) return;
    const path = archivePath;

    let cancelled = false;
    setLoading(true);
    setNestedArchives(null);
    setImageNames([]);
    setEffectivePath(null);

    async function analyze() {
      try {
        const contents: ArchiveContents = await analyzeArchiveContents(path);
        if (cancelled) return;

        if (contents.type === "Images") {
          setImageNames(contents.names);
          setEffectivePath(path);
          setCachedNestedArchives(null);
        } else if (contents.type === "NestedArchives") {
          setNestedArchives(contents.names);
          setCachedNestedArchives(contents.names);
        } else {
          setError("No images found in this archive");
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    analyze();
    return () => {
      cancelled = true;
    };
  }, [archivePath]);

  // Handle nested archive selection
  const handleNestedSelect = useCallback(
    async (nestedName: string) => {
      if (!archivePath) return;
      setLoading(true);
      setError(null);

      try {
        const extractedPath = await extractNestedArchive(archivePath, nestedName);
        const names = await listArchiveImages(extractedPath);
        setImageNames(names);
        setEffectivePath(extractedPath);
        setNestedArchives(null);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [archivePath],
  );

  const handleSpreadChange = useCallback(
    (spreadIndex: number, totalSpreads: number) => {
      if (!archivePath) return;
      const fileName = fileNameFromPath(archivePath);
      const title = `${fileName} [${spreadIndex + 1}/${totalSpreads}] - mekuri`;
      getCurrentWindow().setTitle(title);
    },
    [archivePath],
  );

  // Go back to nested archive selection
  const handleBackToList = useCallback(() => {
    if (cachedNestedArchives) {
      setNestedArchives(cachedNestedArchives);
      setImageNames([]);
      setEffectivePath(null);
    }
  }, [cachedNestedArchives]);

  if (error) {
    return (
      <div className="viewer viewer--error">
        <p>Failed to open archive</p>
        <p className="viewer__error-detail">{error}</p>
      </div>
    );
  }

  if (!archivePath || loading) {
    return (
      <div className="viewer viewer--loading">
        <p>Loading...</p>
      </div>
    );
  }

  // Show nested archive selection
  if (nestedArchives && nestedArchives.length > 0) {
    return (
      <div className="viewer viewer--nested">
        <div className="nested-selector">
          <h2 className="nested-selector__title">Select Archive</h2>
          <p className="nested-selector__desc">This archive contains multiple archives:</p>
          <ul className="nested-selector__list">
            {nestedArchives.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className="nested-selector__item"
                  onClick={() => handleNestedSelect(name)}
                >
                  {name.split("/").pop() || name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (imageNames.length === 0) {
    return (
      <div className="viewer viewer--empty">
        <p>No images found in this archive</p>
      </div>
    );
  }

  return (
    <div className="viewer">
      <SpreadViewer
        archivePath={effectivePath || archivePath}
        imageNames={imageNames}
        onSpreadChange={handleSpreadChange}
        onBack={cachedNestedArchives ? handleBackToList : undefined}
      />
    </div>
  );
}

export default Viewer;
