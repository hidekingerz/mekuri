/**
 * プロセス内 invoke バインディング。
 *
 * Tauri 版フロント（`src/api/`）が `@tauri-apps/api/core` の `invoke(command, args)`
 * 経由で Rust コマンドを呼んでいたのを、Deno Desktop ではプロセス内で `backend/`
 * の関数へ直接ディスパッチする。コマンド名・引数名は Tauri 版（`src/api/` が渡す形）
 * と同じものを受け取り、戻り値型も揃える。これにより `src/api/` は import 先を
 * 差し替えるだけで配線替えできる。
 */

import {
  analyzeContents,
  type ArchiveContents,
  type DirectoryEntry,
  extractNestedArchive,
  getImageBase64,
  listImages,
  pickFolder,
  readDirectory,
  readFileBase64,
  searchDirectory,
  trashFile,
} from "../backend/mod.ts";

/** invoke に渡す引数オブジェクト。Tauri 版と同じく任意のキーを許す。 */
export type InvokeArgs = Record<string, unknown>;

/** 引数オブジェクトから文字列フィールドを必須として取り出す。 */
function requireString(args: InvokeArgs | undefined, key: string): string {
  const value = args?.[key];
  if (typeof value !== "string") {
    throw new Error(`Missing or invalid argument: ${key}`);
  }
  return value;
}

/**
 * Tauri 版 `invoke<T>(command, args)` 互換のプロセス内ディスパッチ。
 * 既知のコマンド名を `backend/` の関数へ振り分け、未知のコマンドはエラーにする。
 */
export async function invoke<T>(
  command: string,
  args?: InvokeArgs,
): Promise<T> {
  switch (command) {
    case "read_directory":
      return await readDirectory(requireString(args, "path")) as T;
    case "search_directory":
      return await searchDirectory(
        requireString(args, "path"),
        requireString(args, "query"),
      ) as T;
    case "read_file_base64":
      return await readFileBase64(requireString(args, "path")) as T;
    case "trash_file":
      return await trashFile(requireString(args, "path")) as T;
    case "open_folder":
      return await pickFolder() as T;
    case "list_archive_images":
      return await listImages(requireString(args, "archivePath")) as T;
    case "get_archive_image":
      return await getImageBase64(
        requireString(args, "archivePath"),
        requireString(args, "entryName"),
      ) as T;
    case "analyze_archive_contents":
      return await analyzeContents(requireString(args, "archivePath")) as T;
    case "extract_nested_archive":
      return await extractNestedArchive(
        requireString(args, "parentPath"),
        requireString(args, "nestedName"),
      ) as T;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

export type { ArchiveContents, DirectoryEntry };
