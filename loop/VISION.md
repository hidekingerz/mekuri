# VISION — このループのゴール

> エージェントは毎周これを読み、「完了の定義」を満たしたかで停止を判断する。
> 全項目が検証可能でグリーンになるまで `LOOP_DONE` を出力しない。

## ゴール（1〜2文）

mekuri（Tauri v2 製の圧縮ファイル見開きビューワー）を、Deno の新デスクトップ機能
（`deno desktop` / `Deno.BrowserWindow`、Deno v2.9.0・canary）へ作り変える。
React フロント（`src/`）は流用し、Rust バックエンド（`src-tauri/`）の機能を `deno-app/` に TypeScript で移植する。

進め方は **並行ディレクトリ方式**。`src-tauri/` と `src/` の React 本体は壊さず、`deno-app/` を新設して段階的に構築する。

## 完了の定義（Definition of Done）— 上から順に進める

> 状態（2026-06-26）: M1〜M5 と M6 のビルドは完了済み（詳細は `MEMORY.md` の Done 参照）。
> ただし **M6「アプリが実際に描画される」は未達**（起動すると白画面）で、原因の **M7 が残っている**。
> 完了判定は cd deno-app で `deno task verify`・`deno task check-no-tauri`・`deno task smoke`、および `pnpm test`（リポジトリルート）が**すべてグリーン**であること。

### マイルストーン1: スキャフォールド
- [x] `deno-app/deno.json` に `verify` タスクがあり、`cd deno-app && deno task verify` がグリーン（fmt/lint/check/test）

### マイルストーン2: バックエンドロジック移植（各々 `Deno.test` 付き・stable deno で検証可）
- [x] `deno-app/backend/sort.ts` 自然順ソート（natord 相当）＋テスト（スキャフォールドで提供済みの参照実装）
- [ ] `deno-app/backend/fs.ts` フォルダ走査（`src-tauri/src/commands/fs.rs` の `read_directory` 相当）＋テスト
- [ ] `deno-app/backend/archive/zip.ts` ZIP/CBZ 展開（`src-tauri/src/archive/zip.rs` 相当）＋テスト
- [ ] `deno-app/backend/archive/rar.ts` RAR/CBR 展開（`src-tauri/src/archive/rar.rs` 相当）＋テスト
- [ ] `deno-app/backend/archive/mod.ts` アーカイブ共通処理・内容分析・ネスト展開（`src-tauri/src/archive/mod.rs` 相当）＋テスト
- [ ] 画像は Base64 data URL で返す（Rust 実装と同じインターフェース）

### マイルストーン3: フロント API 層の配線替え
- [ ] `src/api/`（`archive.ts`/`directory.ts`/`favorites.ts`/`settings.ts`/`store.ts`）を Deno バインディング呼び出しへ切替
- [ ] React コンポーネント本体（`src/components/`）は無改変（API 層のみ変更）

### マイルストーン4: マルチウィンドウ（要 canary）
- [ ] `deno-app/main.ts` で `Deno.BrowserWindow` を使いメイン窓 + ビューワー窓を起動
- [ ] 同一アーカイブの二重オープン防止を実装

### マイルストーン5: 設定永続化
- [ ] tauri-plugin-store 相当（ウィンドウサイズ・カラム幅・お気に入り・表示モード・読み方向）を Deno 側で実装＋テスト

### マイルストーン6: デスクトップ起動確認（要 canary / deno >= 2.9.0）
- [x] `deno desktop deno-app/main.ts` でビルドでき起動する（`--include ../dist` で dist 同梱、127.0.0.1 へ navigate）
- [ ] アプリが**実際に描画される**（`cd deno-app && deno task smoke` がグリーン＝webview 実行時エラーなし）。M7 完了が前提

### マイルストーン7: フロントの Tauri API 全撤廃（白画面の根本原因）

`src/api/` 以外にもフロントが `@tauri-apps/*` を直接使っており（ウィンドウ/ダイアログ/イベント/メニュー）、Deno Desktop の webview には `__TAURI_INTERNALS__` が無いため起動時にクラッシュ＝白画面になる。これらを Deno Desktop の IPC（`main.ts` のバインディング ＋ webview shim）経由へ移行する。1周1系統を目安に、対応する Tauri 版（`src-tauri/`・元 `src/`）の挙動を正解として移植する。

- [ ] `@tauri-apps/api/window`（getCurrentWindow/LogicalSize: ウィンドウサイズ取得・set・resize 通知）→ `main.ts` のバインディング経由。対象: `src/App.tsx`, `src/ViewerApp.tsx`, `src/hooks/useWindowResize.ts`, `src/hooks/useSiblingNavigation.ts`
- [ ] `@tauri-apps/api/webviewWindow`（WebviewWindow でのビューワー窓生成）→ 既存 `open_viewer` バインディング呼び出しへ。対象: `src/App.tsx`
- [ ] `@tauri-apps/plugin-dialog`（open/ask: ファイル/フォルダ選択・確認）→ ネイティブダイアログのバインディング経由。対象: `src/App.tsx`, `src/components/FileList/FileList.tsx`, `src/ViewerApp.tsx`
- [ ] `@tauri-apps/api/event`（listen/emit: 窓間イベント）→ IPC ベースの pub/sub バインディング経由。対象: `src/components/FileList/FileList.tsx`, `src/ViewerApp.tsx`
- [ ] `@tauri-apps/api/menu`（コンテキストメニュー）→ Deno Desktop のメニュー API / バインディング経由。対象: `src/ViewerApp.tsx`
- [ ] `cd deno-app && deno task check-no-tauri` がグリーン（`src/` に `@tauri-apps` の import 無し）
- [ ] `cd deno-app && deno task smoke` がグリーン（pnpm build → desktop build → 起動 → webview 実行時エラーゼロ＝白画面解消）
- [ ] フロントの挙動は Tauri 版と等価（機能を削らない）。`package.json` からも `@tauri-apps/*` 依存を除去

## スコープ外（やらないこと）

- `src-tauri/` の削除・改変（参照・ロールバック用に残す）
- React 本体の**機能・挙動の変更**（M7 では Tauri API → Deno Desktop 経由への配線替えのため、`src/`〔App.tsx/ViewerApp.tsx/hooks/components〕の import・呼び出しの差し替えは許可。ただし表示・操作の挙動は Tauri 版と等価に保ち、機能は削らない）
- canary deno をユーザーの stable に勝手に上書きすること

## 進行上の注意

- マイルストーン1〜3・5 は **stable deno（2.7.12）で検証可能**。`Deno.BrowserWindow` / `deno desktop` を要する 4・6 は canary が前提。
- canary は導入済み（`~/.deno-canary/bin`、本走では PATH 先頭）。`deno desktop` / `Deno.BrowserWindow` 利用可。
- **「ビルド成功」≠「完了」**。`deno desktop` はビルドが通ってもフロントが Tauri API で実行時クラッシュし得る（実際に M6 で白画面になった）。完了判定は必ず `deno task verify`（fmt/lint/check/test）・`deno task check-no-tauri`（`src/` に @tauri-apps 無し）・`deno task smoke`（ヘッドレス起動で webview 実行時エラー検知。内部で `pnpm build` も走る）・`pnpm test` の**すべてがグリーン**であること。これらが緑になって初めて全 DoD 達成＝`LOOP_DONE`。なお grep/smoke は**毎周の `verify` には含めない**（段階移行の途中でもコミットできるようにするため。`verify` 自体は従来どおり fmt/lint/check/test）。
