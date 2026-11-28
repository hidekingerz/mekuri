import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchDirectory } from "../api/directory";
import type { DirectoryEntry } from "../types";
import { errorToString } from "../utils/errorToString";

const SEARCH_DEBOUNCE_MS = 300;

export type FolderSearch = {
  query: string;
  setQuery: (query: string) => void;
  /** 検索結果。検索していないときは null */
  results: DirectoryEntry[] | null;
  /** 検索結果のうちフォルダのみ。検索していないときは null */
  folders: DirectoryEntry[] | null;
  /** 検索の失敗。検索していないか、成功していれば null */
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);
  // 前後の空白は検索語に含めない（IME の確定などで付きやすく、付いたままだと何も一致しない）
  const term = query.trim();

  // 古い応答を捨てるための連番。検索語・ルートが変わるか検索を抜けるたびに進める
  const requestIdRef = useRef(0);

  const runSearch = useCallback(async (root: string, q: string) => {
    const requestId = ++requestIdRef.current;
    try {
      const found = await searchDirectory(root, q);
      if (requestId !== requestIdRef.current) return;
      setResults(found);
      setError(null);
    } catch (err) {
      console.error("Search failed:", err);
      if (requestId !== requestIdRef.current) return;
      // 「一致なし」と区別できるよう、失敗として持つ
      setResults([]);
      setError(errorToString(err));
    }
  }, []);

  // Debounced search
  useEffect(() => {
    // 検索語やルートが変わったら、取りに行っている途中の応答は使わない
    requestIdRef.current++;
    if (!term || !rootPath) {
      setResults(null);
      setError(null);
      return;
    }
    const timer = setTimeout(() => {
      void runSearch(rootPath, term);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, rootPath, runSearch]);

  // Reset search when the root changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: must reset search when rootPath changes
  useEffect(() => {
    setQuery("");
    setResults(null);
    setError(null);
  }, [rootPath]);

  const folders = useMemo(
    () => (results === null ? null : results.filter((e) => e.is_dir)),
    [results],
  );

  const isActive = results !== null && rootPath !== null && term !== "";

  const rerun = useCallback(async () => {
    if (isActive && rootPath) await runSearch(rootPath, term);
  }, [isActive, rootPath, term, runSearch]);

  const clear = useCallback(() => {
    requestIdRef.current++;
    setQuery("");
    setResults(null);
    setError(null);
  }, []);

  return { query, setQuery, results, folders, error, isActive, rerun, clear };
}
