# mekuri - 技術スタック

## フレームワーク

| 項目 | 技術 | 備考 |
|------|------|------|
| アプリフレームワーク | **Tauri v2** | Rust + Web のデスクトップアプリフレームワーク |
| フロントエンド | **React 19** + **TypeScript** | Vite でバンドル |
| バックエンド | **Rust** (Tauri 内蔵) | |
| ビルドツール | **Vite** | Tauri の推奨構成 |

## フロントエンド依存ライブラリ

| ライブラリ | 用途 |
|-----------|------|
| `@tauri-apps/api` | Tauri IPC 呼び出し（invoke, event, window） |
| `@tauri-apps/plugin-dialog` | フォルダ選択ダイアログ |
| `@tauri-apps/plugin-store` | 設定・お気に入りの永続化 |
| `pdfjs-dist` | PDF のページレンダリング（CMap/標準フォント対応で CJK 文字表示可能） |
| `react`, `react-dom` | UI コンポーネント |

最小限の依存で構成する方針とする。アイコンは外部ライブラリを使わず、カスタム SVG コンポーネントで実装している。

### pdfjs-dist の静的アセット配信

pdfjs-dist が必要とする CMap ファイルと標準フォントファイルは、Vite カスタムプラグイン（`pdfjsStaticPlugin`）で配信する。

- **開発時**: dev サーバーのミドルウェアで `node_modules/pdfjs-dist/` から直接配信
- **ビルド時**: `generateBundle` フックで出力ディレクトリにコピー
- **URL パス**: `/pdfjs/cmaps/`, `/pdfjs/standard_fonts/`

## Rust 依存クレート

| クレート | 用途 | 備考 |
|---------|------|------|
| `tauri` | アプリフレームワーク | v2 |
| `tauri-plugin-dialog` | ダイアログプラグイン | |
| `tauri-plugin-store` | キーバリューストアプラグイン | 設定・お気に入りの永続化 |
| `serde`, `serde_json` | JSON シリアライズ / デシリアライズ | IPC データ変換用 |
| `zip` | ZIP/CBZ ファイル展開 | deflate 機能のみ有効 |
| `unrar` | RAR/CBR ファイル展開 | |
| `natord` | 自然順ソート | ファイル名ソート用 |
| `base64` | Base64 エンコーディング | 画像データ転送用 |
| `tempfile` | 一時ファイル/ディレクトリ作成 | ネストアーカイブ展開用 |

## 開発ツール

| ツール | 用途 |
|--------|------|
| `pnpm` | パッケージマネージャ |
| `biome` | フロントエンドリンタ + フォーマッタ |
| `vitest` | フロントエンドテストフレームワーク |
| `clippy` | Rust リンタ |
| `rustfmt` | Rust フォーマッタ |

## 対応プラットフォーム

| OS | 状態 |
|----|------|
| Windows 10/11 | 対応 |
| macOS 12+ | 対応 |
| Linux (Ubuntu 22.04+) | 対応 |

## Rust エディション

- **Rust 2021 edition** を使用する
- MSRV（最小対応 Rust バージョン）は Tauri v2 の要件に準ずる
