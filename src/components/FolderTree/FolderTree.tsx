import { useCallback, useEffect, useRef, useState } from "react";
import { readDirectoryFolders } from "../../api/directory";
import { addFavorite } from "../../api/favorites";
import { useContextMenu } from "../../hooks/useContextMenu";
import { useFolderDropTarget } from "../../hooks/useFolderDropTarget";
import type { DirectoryEntry, TreeNodeData } from "../../types";
import { errorToString } from "../../utils/errorToString";
import {
  findNode,
  getAncestorPaths,
  mergeNodes,
  relativeParent,
  removeNode,
  replaceChildren,
  setNodeOpen,
} from "../../utils/folderTree";
import { moveListIndex } from "../../utils/listKeyboard";
import { FolderIcon } from "../Icons/Icons";
import { TreeNode } from "./TreeNode";

type FolderTreeProps = {
  rootPath: string;
  selectedPath: string | null;
  onFolderSelect: (path: string) => void;
  onFavoriteAdded?: () => void;
  /** お気に入りの保存の失敗を知らせる（null は、前の失敗の表示を消す） */
  onFavoriteError?: (message: string | null) => void;
  searchFolders: DirectoryEntry[] | null;
  /** 検索の失敗。検索していないか、成功していれば null */
  searchError?: string | null;
  revealPath: string | null;
  onRevealComplete: () => void;
  onFileDrop: (srcPaths: string[], destDir: string) => void;
  /** フォルダをゴミ箱に移す。確認して移したときだけ true を返す */
  onTrashFolder: (path: string) => Promise<boolean>;
  reloadTrigger?: number;
};

export function FolderTree({
  rootPath,
  selectedPath,
  onFolderSelect,
  onFavoriteAdded,
  onFavoriteError,
  searchFolders,
  searchError = null,
  revealPath,
  onRevealComplete,
  onFileDrop,
  onTrashFolder,
  reloadTrigger,
}: FolderTreeProps) {
  const [nodes, setNodes] = useState<TreeNodeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ルートの読み込みをやり直すための番号（失敗したあとの「再読み込み」で進める）
  const [rootLoadId, setRootLoadId] = useState(0);
  // 展開を終えたあとに、見える位置までスクロールする項目
  const [scrollToPath, setScrollToPath] = useState<string | null>(null);
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();
  // いまのツリー。読み込みを待ったあとの処理は、待つ前のツリーではなくこれを見る
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // ルート直下を読み込む。お気に入りごとに別のインスタンスになる（呼び出し側が key を付ける）ので、
  // 別のお気に入りの読み込み結果がここへ届くことはない
  // biome-ignore lint/correctness/useExhaustiveDependencies: rootLoadId is intentionally used to retry
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    readDirectoryFolders(rootPath)
      .then((entries) => {
        if (cancelled) return;
        setNodes((prev) => mergeNodes(prev, entries));
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) setError(errorToString(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rootPath, rootLoadId]);

  // Reload ボタン: 選択中フォルダ (未選択ならルート) の子フォルダを再取得し、展開状態を保ってマージする。
  // ルートをまだ読めていなければ（失敗したあとなど）、ルートの読み込みからやり直す
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadTrigger is intentionally used to force re-fetch
  useEffect(() => {
    if (!reloadTrigger) return;
    if (!loaded) {
      setRootLoadId((n) => n + 1);
      return;
    }
    const target = selectedPath ?? rootPath;
    let cancelled = false;
    readDirectoryFolders(target)
      .then((fresh) => {
        if (cancelled) return;
        setNodes((prev) =>
          target === rootPath ? mergeNodes(prev, fresh) : replaceChildren(prev, target, fresh),
        );
      })
      .catch((err) => {
        console.error("Failed to reload folder tree:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTrigger]);

  // path の直下を、まだ読んでいなければ読み込んで開く。読み込みの結果は、待っているあいだに
  // ほかの操作で変わったかもしれない最新のツリーへ入れる。読めなければ false
  const openNode = useCallback(async (path: string): Promise<boolean> => {
    if (findNode(nodesRef.current, path)?.children == null) {
      try {
        const entries = await readDirectoryFolders(path);
        setNodes((prev) => replaceChildren(prev, path, entries));
      } catch (err) {
        // 開いた表示にしない。次に開こうとしたときに読み直す
        console.error("Failed to load folder:", err);
        return false;
      }
    }
    setNodes((prev) => setNodeOpen(prev, path, true));
    return true;
  }, []);

  // revealPath が設定されたら、そこまでのフォルダを上から順に開く
  useEffect(() => {
    if (!revealPath || !loaded) return;
    let cancelled = false;
    void (async () => {
      for (const path of getAncestorPaths(rootPath, revealPath)) {
        if (cancelled || !(await openNode(path))) break;
      }
      if (cancelled) return;
      setScrollToPath(revealPath);
      onRevealComplete();
    })();
    return () => {
      cancelled = true;
    };
  }, [revealPath, loaded, rootPath, onRevealComplete, openNode]);

  const toggleNode = useCallback(
    (path: string) => {
      const node = findNode(nodesRef.current, path);
      // サブフォルダの無いフォルダは、開いても中に出すものが無い
      if (!node?.entry.has_subfolders) return;
      if (node.isOpen) setNodes((prev) => setNodeOpen(prev, path, false));
      else void openNode(path);
    },
    [openNode],
  );

  const treeRef = useRef<HTMLDivElement>(null);

  // メニューは消えるので、閉じる前に項目へフォーカスを戻しておく（そのままキー操作を続けられるように）
  const focusTreeItem = useCallback((path: string) => {
    treeRef.current
      ?.querySelector<HTMLElement>(`[role="treeitem"][data-path="${CSS.escape(path)}"]`)
      ?.focus();
  }, []);

  // 展開のあと、項目が画面の外にあれば見える位置まで寄せる
  // biome-ignore lint/correctness/useExhaustiveDependencies: nodes の更新で項目が描かれてから探す
  useEffect(() => {
    if (!scrollToPath) return;
    const item = treeRef.current?.querySelector<HTMLElement>(
      `[role="treeitem"][data-path="${CSS.escape(scrollToPath)}"]`,
    );
    if (!item) return;
    item.scrollIntoView({ block: "nearest" });
    setScrollToPath(null);
  }, [scrollToPath, nodes]);

  const handleAddFavorite = useCallback(async () => {
    if (!contextMenu) return;
    const path = contextMenu.path;
    focusTreeItem(path);
    closeContextMenu();
    onFavoriteError?.(null);
    try {
      await addFavorite(path);
      onFavoriteAdded?.();
    } catch (err) {
      onFavoriteError?.(errorToString(err));
    }
  }, [contextMenu, focusTreeItem, closeContextMenu, onFavoriteAdded, onFavoriteError]);

  const handleTrashFolder = useCallback(async () => {
    if (!contextMenu) return;
    const path = contextMenu.path;
    // 確認をキャンセルしたときに、この項目からキー操作を続けられるようにする
    focusTreeItem(path);
    closeContextMenu();
    if (await onTrashFolder(path)) {
      setNodes((prev) => removeNode(prev, path));
    }
  }, [contextMenu, focusTreeItem, closeContextMenu, onTrashFolder]);

  // 検索に一致したフォルダの行も、ファイルの落とし先にする
  const { dragOverPath, dropProps } = useFolderDropTarget(onFileDrop);

  // ↑↓ / Home / End で表示中の項目間を移動する（開閉と選択は各項目が処理する）
  const handleTreeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]'));
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = moveListIndex(items.length, current, e.key);
    if (next === null) return;
    e.preventDefault();
    items[next]?.focus();
    items[next]?.scrollIntoView({ block: "nearest" });
  };

  // 検索中はフラットリストで表示
  if (searchFolders !== null) {
    const header = (
      <div className="folder-tree__search-header">
        一致したフォルダ{" "}
        <span className="folder-tree__search-count">{searchFolders.length} 件</span>
      </div>
    );
    if (searchFolders.length === 0) {
      return (
        <>
          {header}
          <div className="folder-tree-loading">
            {searchError ? "検索できませんでした" : "一致するフォルダがありません"}
          </div>
        </>
      );
    }
    return (
      <div
        className="folder-tree"
        role="tree"
        aria-label="検索に一致したフォルダ"
        onKeyDown={handleTreeKeyDown}
      >
        {header}
        {searchFolders.map((folder) => (
          <div
            key={folder.path}
            className={`tree-node tree-node--folder ${folder.path === selectedPath ? "tree-node--selected" : ""}${dragOverPath === folder.path ? " tree-node--drop-target" : ""}`}
            style={{ paddingLeft: "8px" }}
            onClick={() => onFolderSelect(folder.path)}
            {...dropProps(folder.path)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onFolderSelect(folder.path);
              }
            }}
            role="treeitem"
            aria-selected={folder.path === selectedPath}
            tabIndex={0}
          >
            <span className="tree-node__icon">
              <FolderIcon size={16} />
            </span>
            <span className="tree-node__name">
              {folder.name}
              {relativeParent(rootPath, folder.path) && (
                <span className="tree-node__location">{relativeParent(rootPath, folder.path)}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (loading && nodes.length === 0) {
    return <div className="folder-tree-loading">読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="folder-tree-error">
        <p>フォルダを読み込めませんでした</p>
        <p className="folder-tree-error__detail">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="folder-tree"
        role="tree"
        aria-label="フォルダツリー"
        ref={treeRef}
        onKeyDown={handleTreeKeyDown}
      >
        {nodes.map((node) => (
          <TreeNode
            key={node.entry.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onToggle={toggleNode}
            onSelect={onFolderSelect}
            onContextMenu={openContextMenu}
            onFileDrop={onFileDrop}
          />
        ))}
      </div>

      {/* メニューはツリー（role="tree"）の外に置く。中に置くと、ツリーの子として許されない要素になる */}
      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button type="button" className="context-menu__item" onClick={handleAddFavorite}>
            お気に入りに追加
          </button>
          <hr className="context-menu__separator" />
          <button
            type="button"
            className="context-menu__item context-menu__item--danger"
            onClick={handleTrashFolder}
          >
            ゴミ箱に移動
          </button>
        </div>
      )}
    </>
  );
}
