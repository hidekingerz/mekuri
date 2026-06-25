/**
 * bindings の公開 API。フロント（`src/api/`）はここから invoke 互換関数を取り込む。
 * 新しいバインディングを追加したらここから re-export し、`deno check bindings/mod.ts`
 * で型検査される状態を保つ。
 */

export {
  type ArchiveContents,
  type DirectoryEntry,
  invoke,
  type InvokeArgs,
} from "./invoke.ts";
export { handleStoreCommand } from "./store.ts";
