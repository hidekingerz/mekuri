import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSiblingArchives } from "../api/directory";
import { onFileChanged } from "../api/fileEvents";
import type { SiblingNavigation } from "../types";
import {
  siblingByPath,
  siblingDirectionForKey,
  siblingDirectionForMouseButton,
} from "../utils/spreadNavigation";
import { appTitle, fileNameFromPath } from "../utils/windowLabel";

type Siblings = { archives: string[]; currentIndex: number };

const NO_SIBLINGS: Siblings = { archives: [], currentIndex: -1 };

/**
 * 同一フォルダ内の前後のアーカイブへ移動する。Alt+↓/↑ のキー操作と
 * マウスの戻る/進むボタンを登録し、ボタンやメニューから呼ぶための移動関数と端判定を返す。
 */
export function useSiblingNavigation(
  archivePath: string | null,
  onNavigate: (newPath: string) => void,
): SiblingNavigation {
  const [siblings, setSiblings] = useState<Siblings>(NO_SIBLINGS);

  // 端判定用に兄弟一覧を保持し、他ウィンドウでのファイル移動・削除時にも追従する
  useEffect(() => {
    if (!archivePath) {
      setSiblings(NO_SIBLINGS);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const result = await getSiblingArchives(archivePath);
        if (!cancelled) setSiblings(result);
      } catch (err) {
        console.error("Failed to load sibling archives:", err);
      }
    };

    void refresh();
    const unlistenPromise = onFileChanged(() => void refresh());

    return () => {
      cancelled = true;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [archivePath]);

  const navigate = useCallback(
    async (direction: "next" | "prev") => {
      if (!archivePath) return;
      try {
        // 移動時は最新の一覧で判定する (保持中の一覧が古い可能性があるため)
        const { archives } = await getSiblingArchives(archivePath);
        const newPath = siblingByPath(archives, archivePath, direction);
        if (!newPath) return;

        onNavigate(newPath);
        await getCurrentWindow().setTitle(appTitle(fileNameFromPath(newPath)));
      } catch (err) {
        console.error("Failed to navigate to sibling archive:", err);
      }
    },
    [archivePath, onNavigate],
  );

  const goNext = useCallback(() => void navigate("next"), [navigate]);
  const goPrev = useCallback(() => void navigate("prev"), [navigate]);

  useEffect(() => {
    if (!archivePath) return;

    // 確認ダイアログが開いているあいだは、裏でファイルを切り替えない
    const dialogOpen = () => document.querySelector("dialog[open]") !== null;

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

  return useMemo(
    () => ({
      hasNext:
        archivePath !== null && siblingByPath(siblings.archives, archivePath, "next") !== null,
      hasPrev:
        archivePath !== null && siblingByPath(siblings.archives, archivePath, "prev") !== null,
      goNext,
      goPrev,
    }),
    [siblings, archivePath, goNext, goPrev],
  );
}
