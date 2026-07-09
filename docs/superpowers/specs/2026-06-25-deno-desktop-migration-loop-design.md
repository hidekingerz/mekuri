# mekuri Tauri → Deno Desktop 自律移行ループ 設計

- 日付: 2026-06-25
- 対象リポジトリ: mekuri
- ブランチ: `feat/deno-desktop-migration`（実行時に作成）

## 1. 目的

mekuri（Tauri v2 製の圧縮ファイル見開きビューワー）を、Deno の新デスクトップ機能
（`deno desktop` / `Deno.BrowserWindow`、Deno v2.9.0・現状 canary）へ作り変える。

作業は手動の逐次実装ではなく、catch-all-favorite の **single-agent-loop** テンプレートを
mekuri リポジトリに設置し、`claude -p -` を回す自律ループで段階的に進める。

このセッションのゴール: **ループ雛形を移行用にセットアップし、そのまま起動する**こと。

## 2. 前提・制約

- 環境: deno 2.7.12 (stable) インストール済み。`deno desktop` サブコマンドは未搭載
  （2.9.0 / canary が必要）。canary 導入は**ユーザーが実施**する。
- claude CLI 2.1.191 利用可（ループ実行エンジン）。
- `main` は保護ブランチ。直接コミット禁止（PreToolUse フックでブロック）。
- Deno Desktop は canary・実験的。API 変更リスクがあるため、依存を後ろのマイルストーンに隔離する。

## 3. 移行戦略: 並行ディレクトリ方式

新規 `deno-app/` を作り、`src/`（React フロント）を流用しつつ Deno バックエンドを別ディレクトリで構築する。
`src-tauri/` は**削除せず現状維持**（比較・ロールバック用）。

```
mekuri/
├── src/                  # React フロント（流用。Vite ビルドを Deno Desktop が配信）
├── src-tauri/            # 現状維持（削除しない。参照・ロールバック用）
├── deno-app/             # 新規。Deno Desktop アプリ
│   ├── deno.json         #   tasks(verify/dev/check/fmt/lint)、imports
│   ├── main.ts           #   Deno.BrowserWindow でメイン/ビューワー窓を起動
│   ├── backend/          #   Rust ロジックの TS 移植（Tauri 非依存・単体テスト可）
│   │   ├── archive/      #     zip.ts / rar.ts
│   │   ├── fs.ts         #     read_directory 相当
│   │   ├── sort.ts       #     自然順ソート（natord 相当）
│   │   └── *.test.ts     #     Deno.test による単体テスト
│   └── bindings/         #   フロントの invoke 相当をプロセス内バインディングで提供
└── loop/                 # single-agent-loop 一式
    ├── VISION.md
    ├── ARCHITECTURE.md
    ├── RULES.md
    ├── MEMORY.md
    ├── LOOP_PROMPT.md
    └── run.sh
```

## 4. 移植対象（現状の Rust/フロント資産）

- Rust 約900行:
  - `commands/fs.rs`（282行） … `read_directory`
  - `archive/zip.rs`（201行） … ZIP/CBZ 展開
  - `archive/rar.rs`（166行） … RAR/CBR 展開
  - `archive/mod.rs`（200行） … アーカイブ共通処理・内容分析・ネスト展開
  - `commands/archive.rs`（21行） … IPC エンドポイント（薄い層）
- フロント `src/api/`: `archive.ts` / `directory.ts` / `favorites.ts` / `settings.ts` / `store.ts`
  （現状 Tauri `invoke` ラッパー。Deno バインディング呼び出しへ配線替え）
- 横断要素: PDF レンダリング（pdfjs-dist、フロント側）、Base64 data URL での画像転送、
  自然順ソート、ネストアーカイブの一時展開、設定永続化（tauri-plugin-store）。

## 5. VISION（完了の定義・マイルストーン順）

1. `deno-app/` スキャフォールド + `deno.json` の `verify` タスクが稼働する。
2. backend ロジック移植（各々 `Deno.test` 付き）:
   `fs` → `archive/zip` → `archive/rar` → 自然順ソート → アーカイブ内容分析/ネスト展開。
3. フロント `src/api/` 層を Deno バインディング呼び出しへ切替（React 本体は無改変が目標）。
4. `Deno.BrowserWindow` でメイン + ビューワーのマルチウィンドウ起動（二重オープン防止を含む）。
5. 設定永続化（tauri-plugin-store 相当: ウィンドウサイズ・カラム幅・お気に入り・表示モード・読み方向）を Deno 側で実装。
6. （canary 導入後）`deno desktop` でビルド・起動確認 → 完了。

完了基準を全て満たしたときのみ `LOOP_DONE` を出力する。

## 6. VERIFY（品質ゲート / `VERIFY_CMD`）

```
cd deno-app && deno task verify
```
`deno task verify` の内容:
```
deno fmt --check && deno lint && deno check . && deno test
```
マイルストーン 1〜5 は stable deno で検証可能。マイルストーン 6 のみ canary を要する。

## 7. RULES（禁止事項）の要点

- `main` へ直接コミット・push しない。作業は `feat/deno-desktop-migration` ブランチ。
- `src-tauri/` と `src/`（React 本体）を破壊しない。`src/api/` の配線差し替えのみ許可。
- VERIFY 不通過のままコミットしない。
- canary deno をユーザーの stable に勝手に上書きしない（マイルストーン 6 はユーザーの canary 導入を前提に進める）。
- 1周につき 1 タスクのみ。毎周 `MEMORY.md` を更新（試した/通った/未解決）。
- 不要なコード・コメントを残さない。コミットメッセージは英語。

## 8. 実行設定（run.sh の環境変数）

| 変数 | 値 |
|------|-----|
| `AGENT_CMD` | `claude -p -` |
| `PROMPT_FILE` | `./loop/LOOP_PROMPT.md` |
| `VERIFY_CMD` | `cd deno-app && deno task verify` |
| `MAX_ITER` | `8`（初回。長丁場のため再実行前提） |
| `DONE_MARKER` | `LOOP_DONE` |

## 9. このセッションでの作業範囲

1. single-agent-loop テンプレートを `loop/` にコピー。
2. VISION/ARCHITECTURE/RULES/MEMORY/LOOP_PROMPT を本設計に沿って記入。
3. `deno-app/` の最小スキャフォールド（`deno.json` + ディレクトリ + verify タスク）を作成。
4. `feat/deno-desktop-migration` ブランチを作成。
5. `./loop/run.sh` を起動。

## 10. 想定リスク

- Deno Desktop が canary・実験的 → API 変更や未実装に当たる可能性。最終マイルストーンに隔離して影響を限定。
- RAR 展開・PDF・自然順ソートに相当する Deno/npm ライブラリの選定が必要（ループの PLAN 段で都度調査）。
- マルチウィンドウ・二重オープン防止・画像 data URL 転送の挙動差。マイルストーン 4 で重点検証。
- 自律ループの暴走防止: `MAX_ITER` と VERIFY ゲート、1周1タスク制約で担保。
