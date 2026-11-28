import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ArchiveContents,
  analyzeArchiveContents,
  extractNestedArchive,
  listArchiveImages,
} from "../api/archive";
import { errorToString } from "../utils/errorToString";

type ArchiveLoaderState = {
  effectivePath: string | null;
  imageNames: string[];
  nestedArchives: string[] | null;
  loading: boolean;
  error: string | null;
  /** 解析できたが画像もネストしたアーカイブも無い */
  isEmpty: boolean;
  hasNestedCache: boolean;
};

export function useArchiveLoader(archivePath: string | null) {
  const [effectivePath, setEffectivePath] = useState<string | null>(null);
  const [imageNames, setImageNames] = useState<string[]>([]);
  const [nestedArchives, setNestedArchives] = useState<string[] | null>(null);
  const [cachedNestedArchives, setCachedNestedArchives] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  // 下の状態がどのファイルのものか。ファイルが変わった直後の描画では、まだ前のファイルの
  // 状態が残っているので、そのあいだは読み込み中として扱う
  const [analyzedPath, setAnalyzedPath] = useState<string | null>(null);
  // 読み込みの通し番号。ファイルを開き直すたびに進める。展開を始めたあとで番号が進んでいたら、
  // その展開の結果は使わない（別のファイルへ移って戻った場合も、前の展開は古い）
  const loadIdRef = useRef(0);

  // Analyze archive contents when archive path changes
  useEffect(() => {
    loadIdRef.current += 1;
    // PDF を開いているあいだは path が無い。戻ってきたときに前の状態を使わないよう、印を消す
    setAnalyzedPath(archivePath);
    if (!archivePath) return;
    const path = archivePath;

    let cancelled = false;
    setLoading(true);
    setNestedArchives(null);
    // 前のファイルのネストの一覧を持ち越さない（開けなかったファイルで「一覧に戻る」が出てしまう）
    setCachedNestedArchives(null);
    setImageNames([]);
    setEffectivePath(null);
    setError(null);
    setIsEmpty(false);

    async function analyze() {
      try {
        const contents: ArchiveContents = await analyzeArchiveContents(path);
        if (cancelled) return;

        if (contents.type === "Images") {
          setImageNames(contents.names);
          setEffectivePath(path);
          setCachedNestedArchives(null);
        } else if (contents.type === "NestedArchives" && contents.names.length === 1) {
          // 中のアーカイブが 1 つだけなら、選ばせずにそのまま開く
          const extractedPath = await extractNestedArchive(path, contents.names[0]);
          const names = await listArchiveImages(extractedPath);
          if (cancelled) return;
          setImageNames(names);
          setEffectivePath(extractedPath);
        } else if (contents.type === "NestedArchives") {
          setNestedArchives(contents.names);
          setCachedNestedArchives(contents.names);
        } else {
          setIsEmpty(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorToString(err));
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
      // 展開のあいだに別のファイルへ移っていたら、結果は使わない（移動先の表示を上書きしない）
      const loadId = loadIdRef.current;
      const stillCurrent = () => loadIdRef.current === loadId;
      setLoading(true);
      setError(null);

      try {
        const extractedPath = await extractNestedArchive(archivePath, nestedName);
        const names = await listArchiveImages(extractedPath);
        if (!stillCurrent()) return;
        setImageNames(names);
        setEffectivePath(extractedPath);
        setNestedArchives(null);
      } catch (err) {
        if (stillCurrent()) setError(errorToString(err));
      } finally {
        if (stillCurrent()) setLoading(false);
      }
    },
    [archivePath],
  );

  const backToNestedList = useCallback(() => {
    if (cachedNestedArchives) {
      setNestedArchives(cachedNestedArchives);
      setImageNames([]);
      setEffectivePath(null);
      // 展開に失敗したあとでも、一覧へ戻って別のものを選べるようにする
      setError(null);
    }
  }, [cachedNestedArchives]);

  const stale = archivePath !== null && analyzedPath !== archivePath;
  const state: ArchiveLoaderState = stale
    ? {
        effectivePath: null,
        imageNames: [],
        nestedArchives: null,
        loading: true,
        error: null,
        isEmpty: false,
        hasNestedCache: false,
      }
    : {
        effectivePath,
        imageNames,
        nestedArchives,
        loading,
        error,
        isEmpty,
        hasNestedCache: cachedNestedArchives !== null,
      };

  return { ...state, selectNestedArchive, backToNestedList };
}
