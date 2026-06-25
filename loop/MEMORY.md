# MEMORY — ループの記憶（背骨）

> 毎周このファイルを読み、末尾に追記する。会話履歴ではなく**このファイルが記憶**。
> 人間が消さない限り、後の周でも過去の試行を踏まえて動ける。

## Done（達成済み）

- [m2:rar] `deno-app/backend/archive/rar.ts` を `src-tauri/src/archive/rar.rs` から移植（`listImages` / `analyzeContents` / `extractNestedArchive` / `getImageBase64`）。RAR 読み取りに `npm:node-unrar-js@^2.0.2`（解決版 2.0.2）を採用＝Deno で動作する wasm 実装の unrar で、`backend/` を Desktop 非依存に保てるため（純粋 JS RAR ライターが無いのが理由で書き込みは不可）。`createExtractorFromData({data})` の `data` は `ArrayBuffer` 必須なので `new Uint8Array(Deno.readFile結果).buffer` で新規確保して渡す（`data.buffer` 直渡しは `ArrayBufferLike`→TS2322）。`getFileList().fileHeaders`（列挙）/ `extract({files:[name]}).files`（抽出）を使用。`ArchiveContents` 型は `zip.ts` から import 共有し re-export。`mod.ts` では zip と同名関数のため `export * as rar` で名前空間公開（形式ディスパッチ=archive/mod.ts は別タスク）。テスト戦略は元 Rust（mod.rs）と同じくエラーパス中心（RAR フィクスチャ生成不可のため）＝存在しないファイル/不正データでのエラーを検証。`rar.test.ts`(6) 追加。VERIFY グリーン（34 tests passed）。commit 878cc58。
- [m2:zip] `deno-app/backend/archive/zip.ts` を `src-tauri/src/archive/zip.rs` から移植（`listImages` / `analyzeContents` / `extractNestedArchive` / `getImageBase64`）。`ArchiveContents` 判別共用体（`{type:"Images"|"NestedArchives"|"Empty"; names?}`、Rust の serde tag="type" と一致）も定義。ZIP 読み書きライブラリに `jsr:@zip-js/zip-js@^2.7`（解決版 2.8.26）を採用＝Deno 対応・純粋 JS で `backend/` を Desktop 非依存に保て、テスト用 ZIP 生成（ZipWriter）も同一 lib でできるため。`configure({useWebWorkers:false})` でプロセス内実行（worker リーク回避）。`zip.test.ts`(10) 追加、`mod.ts` から re-export。VERIFY グリーン（28 tests passed）。commit 26477c8。落とし穴: zip-js の `Entry` は file/`DirectoryEntry` の union なので `getData` 参照前に `entry.directory` で絞る必要がある。
- [m2:fs] `deno-app/backend/fs.ts` を `src-tauri/src/commands/fs.rs` から移植（`readDirectory` / `searchDirectory` / `readFileBase64`）。依存する拡張子判定を `backend/extensions.ts`（`isArchiveFile`/`isPdfFile`/`isImageFile`/`mimeTypeFromName`、archive/mod.rs 相当）に切り出し。`fs.test.ts`(9)・`extensions.test.ts`(4) 追加、`mod.ts` から re-export。VERIFY グリーン（18 tests passed）。commit bcd0f22。`DirectoryEntry` は React 互換のため snake_case フィールド維持。`trash_file` はネイティブ trash 依存のため未移植（マイルストーン3/別途検討）。
- [setup] スキャフォールド作成。`deno-app/deno.json`（verify タスク）、`deno-app/backend/sort.ts`（自然順ソートの参照実装）+ `sort.test.ts`、`deno-app/backend/mod.ts`、`bindings/`・`archive/` ディレクトリを用意。`cd deno-app && deno task verify` がグリーンであることを確認済み。マイルストーン1完了・マイルストーン2の sort.ts 完了。

## Open（未解決 / 次周への申し送り）

- [next] マイルストーン2の続き。次タスク候補: `deno-app/backend/archive/mod.ts`（共通処理・形式ディスパッチ・内容分析・ネスト展開、`src-tauri/src/archive/mod.rs` 相当）。`detect_format`（拡張子で zip/cbz→zip, rar/cbr→rar を振り分け、それ以外は "Unsupported archive format: .ext" エラー）を実装し、`listImages`/`analyzeContents`/`extractNestedArchive`/`getImageBase64` を zip.ts/rar.ts へディスパッチする統一 API を作る。`ArchiveContents` 型はこの mod.ts へ集約するか zip.ts のまま import 共有するか判断（現状 zip.ts に定義・rar.ts と backend/mod.ts が参照）。テストは mod.rs の `test_unsupported_archive_format`/`test_nonexistent_*`/`test_cbr_dispatches_to_rar` を移植。完了後 `backend/mod.ts` の re-export を「形式別の個別関数」から「統一ディスパッチ API」へ整理し、`export * as rar` の暫定公開を見直す。残るは画像 Base64 インターフェース確認（zip/rar とも data URL 実装済みなので mod.ts 完了でマイルストーン2は実質完了見込み）。
- [next2] zip.rs にあった `extract_nested_archive` は Tauri 版では temp dir をアプリ終了まで保持（TEMP_DIRS）。zip.ts では `Deno.makeTempDir` で作るだけにし後始末はアプリ側へ委ねた。マイルストーン4/5 でアプリ層を作る際に temp ディレクトリのライフサイクル管理（終了時クリーンアップ）を実装すること。

## Notes（学び / 落とし穴）

- 作業ディレクトリ（cwd）はリポジトリルート。ループ用ドキュメントは `loop/` 配下。VERIFY は `cd deno-app && deno task verify`。
- マイルストーン4（`Deno.BrowserWindow`）・6（`deno desktop`）は canary（deno 2.9.0+）が必要。stable 2.7.12 では型検査・起動できないため、これらは canary 導入後に着手する。それまでは backend ロジック（2）とフロント配線（3）・設定永続化（5）を進める。
- `backend/` は Deno Desktop API に依存させない（単体テスト可能に保つ）。公開 API は `backend/mod.ts` から re-export し、`deno check backend/mod.ts` で型検査される状態を維持する。
- 正解は元の Tauri 実装（`src-tauri/`）と React フロント（`src/`）の挙動。移植時は対応する Rust ファイルを読んで仕様を合わせる。
