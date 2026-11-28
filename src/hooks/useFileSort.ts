import { useCallback, useEffect, useRef, useState } from "react";
import { emitFileSortChanged } from "../api/fileEvents";
import { getFileSort, saveFileSort } from "../api/settings";
import { DEFAULT_FILE_SORT, type FileSort } from "../utils/fileSort";

/**
 * ファイル一覧の並び順。マウント時に保存値を復元し、変更時に保存して、開いているビューワーへ知らせる
 * （ビューワーは、前後のファイルへ移る順をこの並びに合わせる）。
 */
export function useFileSort() {
  const [sort, setSort] = useState<FileSort>(DEFAULT_FILE_SORT);
  // 保存値を読み終える前に利用者が並び順を変えたら、読んだ値で上書きしない
  const changedRef = useRef(false);

  useEffect(() => {
    getFileSort()
      .then((saved) => {
        if (!changedRef.current) setSort(saved);
      })
      .catch((err) => {
        console.error("Failed to load file sort:", err);
      });
  }, []);

  const changeSort = useCallback((next: FileSort) => {
    changedRef.current = true;
    setSort(next);
    saveFileSort(next)
      .then(emitFileSortChanged)
      .catch((err) => {
        console.error("Failed to save file sort:", err);
      });
  }, []);

  return { sort, changeSort };
}
