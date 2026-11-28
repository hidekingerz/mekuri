import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSiblingFiles } from "../api/directory";
import { onFileChanged, onFileSortChanged } from "../api/fileEvents";
import type { DirectoryEntry, SiblingNavigation } from "../types";
import { DEFAULT_FILE_SORT, type FileSort } from "../utils/fileSort";
import {
  currentEntry,
  siblingDirectionForKey,
  siblingDirectionForMouseButton,
  siblingPath,
} from "../utils/spreadNavigation";
import { appTitle, fileNameFromPath } from "../utils/windowLabel";

type Siblings = {
  /** 同じフォルダのファイル。メインウィンドウの一覧と同じ並び順 */
  entries: DirectoryEntry[];
  sort: FileSort;
  /** 開いているファイルが最後に一覧で見えたときの情報。一覧から消えたあと、並びの中の元の位置を求めるのに使う */
  lastSeen: DirectoryEntry | null;
};

const NO_SIBLINGS: Siblings = { entries: [], sort: DEFAULT_FILE_SORT, lastSeen: null };

/** 確認ダイアログが開いているあいだは、裏でファイルを切り替えない。 */
const dialogOpen = () => document.querySelector("dialog[open]") !== null;

/**
 * 同一フォルダ内の前後のファイルへ移動する。順序は、メインウィンドウのファイル一覧の並び順に合わせる。
 * Alt+↓/↑ のキー操作とマウスの戻る/進むボタンを登録し、ボタンやメニューから呼ぶための移動関数と端判定を返す。
 */

export function useSiblingNavigation(
  archivePath: string | null,
  onNavigate: (newPath: string) => void,
): SiblingNavigation {
  const [siblings, setSiblings] = useState<Siblings>(NO_SIBLINGS);
  const { lastSeen } = siblings;

  // 端判定用に兄弟一覧を保持し、他ウィンドウでのファイル移動・削除と、並び順の変更にも追従する
  useEffect(() => {
    if (!archivePath) {
      setSiblings(NO_SIBLINGS);
      return;
    }

    let cancelled = false;
    // 取得の通し番号。あとから始めた取得が先に返ることがあるので、遅れて返った古い結果は使わない
    let latest = 0;
    const refresh = async () => {
      latest += 1;
      const id = latest;
      try {
        const { entries, sort } = await getSiblingFiles(archivePath);
        if (cancelled || id !== latest) return;
        setSiblings((prev) => ({
          entries,
          sort,
          lastSeen:
            entries.find((entry) => entry.path === archivePath) ??
            (prev.lastSeen?.path === archivePath ? prev.lastSeen : null),
        }));
      } catch (err) {
        console.error("Failed to load sibling archives:", err);
      }
    };

    void refresh();
    const unlistenPromises = [
      onFileChanged(() => void refresh()),
      onFileSortChanged(() => void refresh()),
    ];

    return () => {
      cancelled = true;
      for (const promise of unlistenPromises) void promise.then((unlisten) => unlisten());
    };
  }, [archivePath]);

  const navigate = useCallback(
    async (direction: "next" | "prev") => {
      if (!archivePath) return;
      try {
        // 移動時は最新の一覧と並び順で判定する (保持中のものが古い可能性があるため)
        const { entries, sort } = await getSiblingFiles(archivePath);
        const current = currentEntry(entries, archivePath, lastSeen);
        const newPath = siblingPath(entries, sort, current, direction);
        // 一覧を待つあいだに確認ダイアログが開いていたら、その裏では切り替えない
        if (!newPath || dialogOpen()) return;

        onNavigate(newPath);
        await getCurrentWindow().setTitle(appTitle(fileNameFromPath(newPath)));
      } catch (err) {
        console.error("Failed to navigate to sibling archive:", err);
      }
    },
    [archivePath, onNavigate, lastSeen],
  );

  const goNext = useCallback(() => void navigate("next"), [navigate]);
  const goPrev = useCallback(() => void navigate("prev"), [navigate]);

  useEffect(() => {
    if (!archivePath) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const direction = siblingDirectionForKey(e);
      if (!direction || dialogOpen()) return;
      e.preventDefault();
      if (direction === "next") goNext();
      else goPrev();
    };

    const handleMouseUp = (e: MouseEvent) => {
      const direction = siblingDirectionForMouseButton(e.button);
      if (!direction || dialogOpen()) return;
      e.preventDefault();
      if (direction === "next") goNext();
      else goPrev();
    };

    // WebView 既定の履歴移動を抑止するため、mousedown も止める
    const suppressHistoryNavigation = (e: MouseEvent) => {
      if (siblingDirectionForMouseButton(e.button)) e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousedown", suppressHistoryNavigation);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousedown", suppressHistoryNavigation);
    };
  }, [archivePath, goNext, goPrev]);

  return useMemo(() => {
    const has = (direction: "next" | "prev") => {
      if (archivePath === null) return false;
      const current = currentEntry(siblings.entries, archivePath, siblings.lastSeen);
      return siblingPath(siblings.entries, siblings.sort, current, direction) !== null;
    };
    return { hasNext: has("next"), hasPrev: has("prev"), goNext, goPrev };
  }, [siblings, archivePath, goNext, goPrev]);
}
