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
| React (組み込み) | UI コンポーネント |

最小限の依存で始め、必要に応じて追加する方針とする。

## Rust 依存クレート

| クレート | 用途 | 備考 |
|---------|------|------|
| `tauri` | アプリフレームワーク | v2 |
| `tauri-plugin-dialog` | ダイアログプラグイン | |
| `zip` | ZIP/CBZ ファイル展開 | `zip` crate |
| `unrar` | RAR/CBR ファイル展開 | `unrar` crate |
| `natord` | 自然順ソート | ファイル名ソート用 |
| `base64` | Base64 エンコーディング | 画像データ転送用 |

## 開発ツール

| ツール | 用途 |
|--------|------|
| `pnpm` | パッケージマネージャ |
| `eslint` | フロントエンド静的解析 |
| `prettier` | フロントエンドフォーマッタ |
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
