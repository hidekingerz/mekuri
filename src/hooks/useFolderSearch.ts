import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchDirectory } from "../api/directory";
import type { DirectoryEntry } from "../types";

const SEARCH_DEBOUNCE_MS = 300;

export type FolderSearch = {
  query: string;
  setQuery: (query: string) => void;
  /** 検索結果。検索していないときは null */
  results: DirectoryEntry[] | null;
  /** 検索結果のうちフォルダのみ。検索していないときは null */
  folders: DirectoryEntry[] | null;
  /** 検索結果を表示中かどうか */
  isActive: boolean;
  /** 現在のクエリで検索をやり直す。検索中でなければ何もしない */
  rerun: () => Promise<void>;
  clear: () => void;
};

/** お気に入りルート配下のデバウンス付き検索。ルートが変わると検索はリセットされる。 */
export function useFolderSearch(rootPath: string | null): FolderSearch {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryEntry[] | null>(null);

  // 古い応答を捨てるための連番。検索語・ルートが変わるか検索を抜けるたびに進める
  const requestIdRef = useRef(0);

  const runSearch = useCallback(async (root: string, q: string) => {
    const requestId = ++requestIdRef.current;
    try {
      const found = await searchDirectory(root, q);
      if (requestId === requestIdRef.current) setResults(found);
    } catch (err) {
      console.error("Search failed:", err);
      if (requestId === requestIdRef.current) setResults([]);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    // 検索語やルートが変わったら、取りに行っている途中の応答は使わない
    requestIdRef.current++;
    if (!query || !rootPath) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      void runSearch(rootPath, query);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, rootPath, runSearch]);

  // Reset search when the root changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: must reset search when rootPath changes
  useEffect(() => {
    setQuery("");
    setResults(null);
  }, [rootPath]);

  const folders = useMemo(
    () => (results === null ? null : results.filter((e) => e.is_dir)),
    [results],
  );

  const isActive = results !== null && rootPath !== null && query !== "";

  const rerun = useCallback(async () => {
    if (isActive && rootPath) await runSearch(rootPath, query);
  }, [isActive, rootPath, query, runSearch]);

  const clear = useCallback(() => {
    requestIdRef.current++;
    setQuery("");
    setResults(null);
  }, []);

  return { query, setQuery, results, folders, isActive, rerun, clear };
}
