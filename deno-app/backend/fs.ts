/**
 * フォルダ走査。
 *
 * Tauri 版 `src-tauri/src/commands/fs.rs` の `read_directory` / `search_directory` /
 * `read_file_base64` に相当する。Deno のコアファイル API（`Deno.readDir` /
 * `Deno.readFile`）のみを使い、Deno Desktop API には依存しない。
 */

import { naturalCompare } from "./sort.ts";
import { isArchiveFile, isPdfFile } from "./extensions.ts";

/** フォルダ走査の 1 エントリ。Tauri 版 `DirectoryEntry` と同じフィールド名を維持する。 */
export interface DirectoryEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_archive: boolean;
  is_pdf: boolean;
  has_subfolders: boolean;
}

/** ディレクトリ・アーカイブ・PDF を比較する。ディレクトリ優先、その後は自然順。 */
function compareEntries(a: DirectoryEntry, b: DirectoryEntry): number {
  if (a.is_dir && !b.is_dir) return -1;
  if (!a.is_dir && b.is_dir) return 1;
  return naturalCompare(a.name, b.name);
}

/** パス区切りを考慮して 2 つのパスを結合する。 */
function joinPath(dir: string, name: string): string {
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`;
}

/** 指定ディレクトリに（隠しでない）サブディレクトリが存在するか。 */
async function hasSubdirectories(path: string): Promise<boolean> {
  try {
    for await (const entry of Deno.readDir(path)) {
      if (entry.isDirectory && !entry.name.startsWith(".")) {
        return true;
      }
    }
  } catch {
    // 読み取れないディレクトリは「サブフォルダなし」扱い
  }
  return false;
}

/**
 * ディレクトリ直下を走査し、ディレクトリ・アーカイブ・PDF のみを返す。
 * 隠しファイル（`.` 始まり）は除外し、ディレクトリ優先・自然順でソートする。
 */
export async function readDirectory(path: string): Promise<DirectoryEntry[]> {
  let dirEntries: Deno.DirEntry[];
  try {
    dirEntries = [];
    for await (const entry of Deno.readDir(path)) {
      dirEntries.push(entry);
    }
  } catch (e) {
    throw new Error(
      `Failed to read directory: ${e instanceof Error ? e.message : e}`,
    );
  }

  const result: DirectoryEntry[] = [];
  for (const entry of dirEntries) {
    const { name } = entry;

    // 隠しファイルはスキップ
    if (name.startsWith(".")) continue;

    const isDir = entry.isDirectory;
    const isArchive = !isDir && isArchiveFile(name);
    const isPdf = !isDir && !isArchive && isPdfFile(name);

    // ディレクトリ・アーカイブ・PDF のみ表示
    if (!isDir && !isArchive && !isPdf) continue;

    const entryPath = joinPath(path, name);
    const hasSubfolders = isDir ? await hasSubdirectories(entryPath) : false;

    result.push({
      name,
      path: entryPath,
      is_dir: isDir,
      is_archive: isArchive,
      is_pdf: isPdf,
      has_subfolders: hasSubfolders,
    });
  }

  result.sort(compareEntries);
  return result;
}

/** `searchDirectory` の再帰本体。マッチしたエントリを `result` に追加する。 */
async function searchRecursive(
  dir: string,
  query: string,
  result: DirectoryEntry[],
): Promise<void> {
  let dirEntries: Deno.DirEntry[];
  try {
    dirEntries = [];
    for await (const entry of Deno.readDir(dir)) {
      dirEntries.push(entry);
    }
  } catch {
    return;
  }

  for (const entry of dirEntries) {
    const { name } = entry;

    // 隠しファイルはスキップ
    if (name.startsWith(".")) continue;

    const entryPath = joinPath(dir, name);

    if (entry.isDirectory) {
      if (name.toLowerCase().includes(query)) {
        result.push({
          name,
          path: entryPath,
          is_dir: true,
          is_archive: false,
          is_pdf: false,
          has_subfolders: await hasSubdirectories(entryPath),
        });
      }
      // 再帰的にサブディレクトリを検索
      await searchRecursive(entryPath, query, result);
    } else {
      const isArchive = isArchiveFile(name);
      const isPdf = !isArchive && isPdfFile(name);

      if ((isArchive || isPdf) && name.toLowerCase().includes(query)) {
        result.push({
          name,
          path: entryPath,
          is_dir: false,
          is_archive: isArchive,
          is_pdf: isPdf,
          has_subfolders: false,
        });
      }
    }
  }
}

/**
 * ディレクトリを再帰的に検索し、名前に `query`（大文字小文字無視）を含む
 * ディレクトリ・アーカイブ・PDF を返す。ディレクトリ優先・自然順でソートする。
 */
export async function searchDirectory(
  path: string,
  query: string,
): Promise<DirectoryEntry[]> {
  const queryLower = query.toLowerCase();
  const result: DirectoryEntry[] = [];
  await searchRecursive(path, queryLower, result);
  result.sort(compareEntries);
  return result;
}

/**
 * ファイルをゴミ箱へ移動する（Tauri 版 `trash_file` 相当）。
 *
 * 検証（存在する・通常ファイルである）は純粋ロジックとして本体で行い、実際の
 * ゴミ箱移動はネイティブ依存（`npm:trash`）になるため注入可能な `deleter` に分離する。
 * これにより `backend/` を Deno Desktop 非依存に保ち、検証パスを単体テストできる。
 */
export type FileDeleter = (path: string) => Promise<void>;

/** 既定の deleter。`npm:trash` を動的 import してゴミ箱へ移動する。 */
async function defaultDeleter(path: string): Promise<void> {
  const mod = await import("trash");
  const trash = mod.default as (p: string) => Promise<void>;
  try {
    await trash(path);
  } catch (e) {
    throw new Error(
      `Failed to move file to trash: ${e instanceof Error ? e.message : e}`,
    );
  }
}

export async function trashFile(
  path: string,
  deleter: FileDeleter = defaultDeleter,
): Promise<void> {
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(path);
  } catch {
    throw new Error(`File does not exist: ${path}`);
  }
  if (!stat.isFile) {
    throw new Error(`Path is not a file: ${path}`);
  }
  await deleter(path);
}

/** ファイルを読み込み Base64 文字列で返す（Tauri 版 `read_file_base64` 相当）。 */
export async function readFileBase64(path: string): Promise<string> {
  let data: Uint8Array;
  try {
    data = await Deno.readFile(path);
  } catch (e) {
    throw new Error(
      `Failed to read file: ${e instanceof Error ? e.message : e}`,
    );
  }
  return encodeBase64(data);
}

/** Uint8Array を標準 Base64 文字列へエンコードする。 */
function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
