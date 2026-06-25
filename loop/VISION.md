# VISION — このループのゴール

> エージェントは毎周これを読み、「完了の定義」を満たしたかで停止を判断する。
> 全項目が検証可能でグリーンになるまで `LOOP_DONE` を出力しない。

## ゴール（1〜2文）

mekuri（Tauri v2 製の圧縮ファイル見開きビューワー）を、Deno の新デスクトップ機能
（`deno desktop` / `Deno.BrowserWindow`、Deno v2.9.0・canary）へ作り変える。
React フロント（`src/`）は流用し、Rust バックエンド（`src-tauri/`）の機能を `deno-app/` に TypeScript で移植する。

進め方は **並行ディレクトリ方式**。`src-tauri/` と `src/` の React 本体は壊さず、`deno-app/` を新設して段階的に構築する。

## 完了の定義（Definition of Done）— 上から順に進める

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
- [ ] `deno desktop deno-app/main.ts` でビルドでき、アプリが起動する

## スコープ外（やらないこと）

- `src-tauri/` の削除・改変（参照・ロールバック用に残す）
- `src/components/` の React 本体の機能変更（API 層の配線替えのみ許可）
- canary deno をユーザーの stable に勝手に上書きすること（マイルストーン6はユーザーが canary を用意する前提）

## 進行上の注意

- マイルストーン1〜3・5 は **stable deno（2.7.12）で検証可能**。`Deno.BrowserWindow` / `deno desktop` を要する 4・6 は canary が前提。
- canary 未導入で 4・6 に着手できない場合は、`MEMORY.md` の Open にブロック理由を記録し、**着手可能な他マイルストーンを先に進める**。全項目が揃うまで `LOOP_DONE` を出さない。
