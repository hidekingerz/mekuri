# CLAUDE.md - mekuri 開発ガイド

## プロジェクト概要

mekuri は圧縮ファイル（ZIP/RAR）内の画像を見開き表示で閲覧するデスクトップアプリ。
Tauri v2（Rust バックエンド + React フロントエンド）で構成される。

## アーキテクチャ

- **メインウィンドウ**: フォルダツリーで圧縮ファイルを探索（`index.html` + `src/main.tsx`）
- **ビューワーウィンドウ**: 見開き画像表示（`viewer.html` + `src/viewer.tsx`）
- **Rust 側**: フォルダ走査（`commands/fs.rs`）、アーカイブ画像抽出（`commands/archive.rs`）
- **React 側**: Tauri IPC（`invoke`）経由で Rust を呼び出す

詳細は `docs/` 配下のドキュメントを参照:
- `docs/requirements.md` - 要件定義
- `docs/architecture.md` - アーキテクチャ設計・IPC コマンド仕様
- `docs/tech-stack.md` - 技術スタック
- `docs/directory-structure.md` - ディレクトリ構成

## 技術スタック

- **フレームワーク**: Tauri v2
- **フロントエンド**: React 19 + TypeScript + Vite
- **バックエンド**: Rust (2021 edition)
- **パッケージマネージャ**: pnpm

## コマンド

```bash
# フロントエンド
pnpm install          # 依存インストール
pnpm dev              # 開発サーバー起動（Tauri 経由）
pnpm build            # プロダクションビルド
pnpm lint             # Biome リント実行
pnpm format           # Biome フォーマット実行

# Rust (src-tauri/ 配下で実行)
cargo clippy           # リンタ
cargo fmt              # フォーマッタ
cargo test             # テスト実行

# Tauri
pnpm tauri dev         # 開発モード起動
pnpm tauri build       # リリースビルド
```

## ディレクトリ構成

```
src/                    # フロントエンド (React/TypeScript)
  components/
    FolderTree/         #   フォルダツリーUI
    SpreadViewer/       #   見開きビューワーUI
  hooks/                #   カスタムフック (useDirectory, useArchive)
  types/                #   型定義

src-tauri/              # バックエンド (Rust)
  src/
    commands/           #   Tauri コマンド層（IPC エンドポイント）
      fs.rs             #     read_directory コマンド
      archive.rs        #     list_archive_images, get_archive_image コマンド
    archive/            #   アーカイブ処理ロジック（Tauri 非依存）
      zip.rs            #     ZIP/CBZ 処理
      rar.rs            #     RAR/CBR 処理
```

## コーディング規約

### Rust

- `cargo clippy` の警告をすべて解消すること
- `cargo fmt` でフォーマット済みであること
- `commands/` と `archive/` を分離する。`archive/` は Tauri に依存しない純粋ロジックとして実装し、単体テスト可能にする
- エラーは `Result<T, String>` で返す（Tauri コマンドの制約）
- ファイルパスの操作には `std::path::PathBuf` を使う

### TypeScript / React

- Biome に準拠（リント + フォーマット）
- コンポーネントは関数コンポーネント + hooks で実装
- Tauri IPC 呼び出しはカスタムフック（`hooks/`）に集約する
- 型定義は `types/` に集約する

### 共通

- コミットメッセージは英語で、変更内容を簡潔に記述する
- 日本語はドキュメント（`docs/`）とコメントで使用可
- 不要なコードやコメントは残さない

## 機能追加時の品質チェック

機能を追加・変更した際は、コミット前に以下を必ず実行し、エラーがあれば修正すること。

### 1. テストコードの追加

- Rust: `archive/` 配下のロジックには `#[cfg(test)]` モジュールで単体テストを書く
- TypeScript: `utils/` 等のロジックには Vitest でテストを書く（`*.test.ts`）

### 2. フォーマッタ実行

```bash
cargo fmt                     # Rust
pnpm format                   # TypeScript (Biome)
```

### 3. リンター実行

```bash
cargo clippy                  # Rust（警告ゼロであること）
pnpm lint                     # TypeScript (Biome)
```

### 4. テスト実行

```bash
cd src-tauri && cargo test    # Rust テスト
pnpm test                     # TypeScript テスト (Vitest)
```

### 5. 型チェック

```bash
npx tsc --noEmit              # TypeScript 型チェック
```

エラーが出た場合はすべて修正してからコミットする。

## 重要な設計判断

- **マルチウィンドウ**: Vite の multi-input + Tauri の `WebviewWindow` で実現。同じアーカイブの二重オープンを防止する
- **遅延読み込み**: フォルダツリーは展開時にそのフォルダ直下のみ取得する
- **見開き表示**: 右綴じ（右→左）がデフォルト。先頭ページは単ページ表示
- **画像転送**: Rust → React は Base64 エンコードした data URL で渡す
- **自然順ソート**: ファイル名は `natord` クレートで自然順ソートする
