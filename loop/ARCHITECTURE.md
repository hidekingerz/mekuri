# ARCHITECTURE — 技術スタックとフォルダ構成

> エージェントが DISCOVER を高速化するためのプロジェクト知識。毎周ゼロから推測させない。
> ※ ループの作業ディレクトリ（cwd）は **リポジトリルート**。ループ用ドキュメントは `loop/` 配下にある。

## スタック（移行先 = deno-app/）

- 言語 / ランタイム: TypeScript / Deno（stable 2.7.12。マイルストーン4・6 のみ canary 2.9.0+）
- デスクトップ: Deno Desktop（`deno desktop` / `Deno.BrowserWindow`、OS ネイティブ WebView）
- フロント: React 19 + Vite（`src/` を流用。Deno Desktop が Vite ビルドを配信）
- テスト: `Deno.test`（`*.test.ts`、対象ファイルと同階層）
- Lint / Format: `deno lint` / `deno fmt`
- 依存解決: `deno.json` の `imports`（npm: / jsr: 指定）。npm 全体にアクセス可

## 移行元（参照のみ・改変しない = src-tauri/）

```
src-tauri/src/
  commands/fs.rs        read_directory コマンド（282行）
  commands/archive.rs   アーカイブ IPC エンドポイント（薄い層、21行）
  archive/zip.rs        ZIP/CBZ 展開（201行）
  archive/rar.rs        RAR/CBR 展開（166行）
  archive/mod.rs        共通処理・内容分析・ネスト展開（200行）
```

## 主要ディレクトリ（移行先）

```
deno-app/
  deno.json         tasks(verify/check/test/fmt/lint/dev)、imports
  main.ts           Deno.BrowserWindow でメイン/ビューワー窓を起動（マイルストーン4で作成、要 canary）
  backend/          Rust ロジックの TS 移植（Deno Desktop 非依存・単体テスト可能に保つ）
    sort.ts         自然順ソート（参照実装。提供済み）
    fs.ts           フォルダ走査
    archive/        zip.ts / rar.ts / mod.ts
    *.test.ts       Deno.test
  bindings/         フロントの invoke 相当をプロセス内バインディングで提供
src/                React フロント（流用。src/api/ のみ配線替え可）
  api/              archive.ts / directory.ts / favorites.ts / settings.ts / store.ts
  components/       React 本体（無改変）
```

## 重要な慣習

- `backend/` は Deno Desktop API（`Deno.BrowserWindow` 等）に依存しない純粋ロジックとして実装し、単体テスト可能にする（Tauri 版の `commands/` と `archive/` の分離方針を踏襲）。
- 公開 API は各ディレクトリの `mod.ts` から re-export し、`deno check backend/mod.ts` で型検査される状態を保つ。
- テストは対象ファイルと同階層に `*.test.ts` で置く。
- 画像転送は Base64 data URL（Rust 版と同じインターフェースを維持）。
- 元の Tauri 実装（`src-tauri/`）と React フロント（`src/`）の挙動を正解として移植する。

## ビルド / 実行コマンド（cwd = リポジトリルート）

- 検証（品質ゲート）: `cd deno-app && deno task verify`
- 型チェック: `cd deno-app && deno task check`
- テスト: `cd deno-app && deno task test`
- 起動（要 canary）: `cd deno-app && deno desktop main.ts`
