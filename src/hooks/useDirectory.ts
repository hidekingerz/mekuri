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
  return entries.filter((entry) => !entry.is_dir && entry.is_archive);
}
