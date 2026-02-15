import { invoke } from "@tauri-apps/api/core";
import type { DirectoryEntry } from "../types";

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

export async function getSiblingArchives(
  currentPath: string,
): Promise<{ archives: string[]; currentIndex: number }> {
  const parentDir = getParentDirectory(currentPath);
  const files = await readDirectoryFiles(parentDir);
  const archives = files.map((f) => f.path);
  const currentIndex = archives.indexOf(currentPath);
  return { archives, currentIndex };
}
