# MEMORY — ループの記憶（背骨）

> 毎周このファイルを読み、末尾に追記する。会話履歴ではなく**このファイルが記憶**。
> 人間が消さない限り、後の周でも過去の試行を踏まえて動ける。

## Done（達成済み）

- [setup] スキャフォールド作成。`deno-app/deno.json`（verify タスク）、`deno-app/backend/sort.ts`（自然順ソートの参照実装）+ `sort.test.ts`、`deno-app/backend/mod.ts`、`bindings/`・`archive/` ディレクトリを用意。`cd deno-app && deno task verify` がグリーンであることを確認済み。マイルストーン1完了・マイルストーン2の sort.ts 完了。

## Open（未解決 / 次周への申し送り）

- [next] マイルストーン2の続き。次タスク候補: `deno-app/backend/fs.ts` を `src-tauri/src/commands/fs.rs` の `read_directory` 相当として移植し、`fs.test.ts` を追加する。`sort.ts` / `sort.test.ts` を実装パターンの手本にする。

## Notes（学び / 落とし穴）

- 作業ディレクトリ（cwd）はリポジトリルート。ループ用ドキュメントは `loop/` 配下。VERIFY は `cd deno-app && deno task verify`。
- マイルストーン4（`Deno.BrowserWindow`）・6（`deno desktop`）は canary（deno 2.9.0+）が必要。stable 2.7.12 では型検査・起動できないため、これらは canary 導入後に着手する。それまでは backend ロジック（2）とフロント配線（3）・設定永続化（5）を進める。
- `backend/` は Deno Desktop API に依存させない（単体テスト可能に保つ）。公開 API は `backend/mod.ts` から re-export し、`deno check backend/mod.ts` で型検査される状態を維持する。
- 正解は元の Tauri 実装（`src-tauri/`）と React フロント（`src/`）の挙動。移植時は対応する Rust ファイルを読んで仕様を合わせる。
