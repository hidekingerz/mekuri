import { invoke } from "@tauri-apps/api/core";
import type { DirectoryEntry } from "../types";

export async function readDirectory(path: string): Promise<DirectoryEntry[]> {
  return invoke<DirectoryEntry[]>("read_directory", { path });
}
