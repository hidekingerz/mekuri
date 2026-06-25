# MEMORY — ループの記憶（背骨）

> 毎周このファイルを読み、末尾に追記する。会話履歴ではなく**このファイルが記憶**。
> 人間が消さない限り、後の周でも過去の試行を踏まえて動ける。

## Done（達成済み）

- [m2:fs] `deno-app/backend/fs.ts` を `src-tauri/src/commands/fs.rs` から移植（`readDirectory` / `searchDirectory` / `readFileBase64`）。依存する拡張子判定を `backend/extensions.ts`（`isArchiveFile`/`isPdfFile`/`isImageFile`/`mimeTypeFromName`、archive/mod.rs 相当）に切り出し。`fs.test.ts`(9)・`extensions.test.ts`(4) 追加、`mod.ts` から re-export。VERIFY グリーン（18 tests passed）。commit bcd0f22。`DirectoryEntry` は React 互換のため snake_case フィールド維持。`trash_file` はネイティブ trash 依存のため未移植（マイルストーン3/別途検討）。
- [setup] スキャフォールド作成。`deno-app/deno.json`（verify タスク）、`deno-app/backend/sort.ts`（自然順ソートの参照実装）+ `sort.test.ts`、`deno-app/backend/mod.ts`、`bindings/`・`archive/` ディレクトリを用意。`cd deno-app && deno task verify` がグリーンであることを確認済み。マイルストーン1完了・マイルストーン2の sort.ts 完了。

## Open（未解決 / 次周への申し送り）

- [next] マイルストーン2の続き。次タスク候補: `deno-app/backend/archive/zip.ts` を `src-tauri/src/archive/zip.rs` から移植（ZIP/CBZ の画像一覧・内容分析・画像 Base64 取得・ネスト展開）し `zip.test.ts` を追加する。ライブラリ調査が必要（PLAN 段で npm/jsr の ZIP 展開ライブラリを `deno.json` の imports に追加。理由を MEMORY に記録）。拡張子判定は `backend/extensions.ts` を流用できる。`fs.ts` を実装パターンの手本にする。

## Notes（学び / 落とし穴）

- 作業ディレクトリ（cwd）はリポジトリルート。ループ用ドキュメントは `loop/` 配下。VERIFY は `cd deno-app && deno task verify`。
- マイルストーン4（`Deno.BrowserWindow`）・6（`deno desktop`）は canary（deno 2.9.0+）が必要。stable 2.7.12 では型検査・起動できないため、これらは canary 導入後に着手する。それまでは backend ロジック（2）とフロント配線（3）・設定永続化（5）を進める。
- `backend/` は Deno Desktop API に依存させない（単体テスト可能に保つ）。公開 API は `backend/mod.ts` から re-export し、`deno check backend/mod.ts` で型検査される状態を維持する。
- 正解は元の Tauri 実装（`src-tauri/`）と React フロント（`src/`）の挙動。移植時は対応する Rust ファイルを読んで仕様を合わせる。
