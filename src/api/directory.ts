import { invoke } from "@tauri-apps/api/core";
import type { DirectoryEntry } from "../types";
import { errorToString } from "../utils/errorToString";

export async function readDirectory(path: string): Promise<DirectoryEntry[]> {
  return invoke<DirectoryEntry[]>("read_directory", { path });
}

export async function readDirectoryFolders(path: string): Promise<DirectoryEntry[]> {
  const entries = await readDirectory(path);
  return entries.filter((entry) => entry.is_dir);
}

export async function readDirectoryFiles(path: string): Promise<DirectoryEntry[]> {
  const entries = await readDirectory(path);
  return entries.filter((entry) => !entry.is_dir && (entry.is_archive || entry.is_pdf));
}

export async function searchDirectory(path: string, query: string): Promise<DirectoryEntry[]> {
  return invoke<DirectoryEntry[]>("search_directory", { path, query });
}

export async function readFileBase64(path: string): Promise<string> {
  return invoke<string>("read_file_base64", { path });
}

export function getParentDirectory(filePath: string): string {
  // Handle both Unix and Windows paths
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  if (lastSlash === -1) return filePath;
  return filePath.substring(0, lastSlash);
}

export async function trashFile(path: string): Promise<void> {
  return invoke<void>("trash_file", { path });
}

export async function moveFile(src: string, destDir: string): Promise<string> {
  return invoke<string>("move_file", { src, destDir });
}

export async function getSiblingArchives(
  currentPath: string,
): Promise<{ archives: string[]; currentIndex: number }> {
  const parentDir = getParentDirectory(currentPath);
  const files = await readDirectoryFiles(parentDir);
  const archives = files.map((f) => f.path);
  const currentIndex = archives.indexOf(currentPath);
  return { archives, currentIndex };
}

export async function trashFiles(paths: string[]): Promise<void> {
  return invoke<void>("trash_files", { paths });
}

export type MoveFilesResult = { moved: string[]; errors: string[] };

/** 複数ファイルを順に移動する。1 件の失敗で止めず、成功分と失敗分を分けて返す。 */
export async function moveFiles(srcPaths: string[], destDir: string): Promise<MoveFilesResult> {
  const moved: string[] = [];
  const errors: string[] = [];
  for (const src of srcPaths) {
    try {
      moved.push(await moveFile(src, destDir));
    } catch (err) {
      errors.push(errorToString(err));
    }
  }
  return { moved, errors };
}
