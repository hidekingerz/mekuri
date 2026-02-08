import { useCallback, useEffect, useState } from "react";
import {
  type ArchiveContents,
  analyzeArchiveContents,
  extractNestedArchive,
  listArchiveImages,
} from "../api/archive";

interface ArchiveLoaderState {
  effectivePath: string | null;
  imageNames: string[];
  nestedArchives: string[] | null;
  loading: boolean;
  error: string | null;
  hasNestedCache: boolean;
}

export function useArchiveLoader(archivePath: string | null) {
  const [effectivePath, setEffectivePath] = useState<string | null>(null);
  const [imageNames, setImageNames] = useState<string[]>([]);
  const [nestedArchives, setNestedArchives] = useState<string[] | null>(null);
  const [cachedNestedArchives, setCachedNestedArchives] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analyze archive contents when archive path changes
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

  const selectNestedArchive = useCallback(
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

  const backToNestedList = useCallback(() => {
    if (cachedNestedArchives) {
      setNestedArchives(cachedNestedArchives);
      setImageNames([]);
      setEffectivePath(null);
    }
  }, [cachedNestedArchives]);

  const state: ArchiveLoaderState = {
    effectivePath,
    imageNames,
    nestedArchives,
    loading,
    error,
    hasNestedCache: cachedNestedArchives !== null,
  };

  return { ...state, selectNestedArchive, backToNestedList };
}
