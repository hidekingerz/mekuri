# mekuri - 技術スタック

## フレームワーク

| 項目 | 技術 | 備考 |
|------|------|------|
| アプリフレームワーク | **Deno Desktop** | `Deno.BrowserWindow` + Deno プロセス。`deno desktop` で main.ts をコンパイルし dist を埋め込んだ自己完結アプリにする |
| フロントエンド | **React 19** + **TypeScript** | Vite でバンドル |
| バックエンド | **TypeScript**（Deno / `deno-app/`） | 純ロジックは Desktop API 非依存 |
| ビルドツール | **Vite** | フロントエンド（`dist/`）のバンドル |

## フロントエンド依存ライブラリ

| ライブラリ | 用途 |
|-----------|------|
| `pdfjs-dist` | PDF のページレンダリング（CMap/標準フォント対応で CJK 文字表示可能） |
| `react`, `react-dom` | UI コンポーネント |

最小限の依存で構成する方針とする。アイコンは外部ライブラリを使わず、カスタム SVG コンポーネントで実装している。

`@tauri-apps/*` への依存は撤去済み。IPC 呼び出しはフロント内の Tauri 互換 `invoke`/`event` shim（`deno-app/frontend/`）が `fetch("/__invoke")` および SSE `/__events` に変換して担う。フォルダ選択ダイアログ・設定/お気に入りの永続化もこの shim 経由でバックエンドが処理する。

### pdfjs-dist の静的アセット配信

pdfjs-dist が必要とする CMap ファイルと標準フォントファイルは、Vite カスタムプラグイン（`pdfjsStaticPlugin`）で配信する。

- **開発時**: dev サーバーのミドルウェアで `node_modules/pdfjs-dist/` から直接配信
- **ビルド時**: `generateBundle` フックで出力ディレクトリにコピー
- **URL パス**: `/pdfjs/cmaps/`, `/pdfjs/standard_fonts/`

## バックエンド / デスクトップ依存（`deno-app/deno.json` の imports）

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `@std/http` | HTTP サーバ補助 | `Deno.serve` による `/__invoke` / `/__events` / dist 配信 |
| `@zip-js/zip-js` | ZIP/CBZ ファイル展開 | |
| `node-unrar-js` | RAR/CBR ファイル展開 | |
| `trash` | ファイルをゴミ箱へ移動 | |
| `@std/fs` | ファイルシステム補助 | |
| `@std/assert` | テスト用アサーション | |

自然順ソートは `deno-app/backend/sort.ts`（自前実装）、設定永続化は自前 `Store` クラス（`settings.json`）、Base64 data URL への変換もバックエンド（TypeScript）で行う。

## 開発ツール

| ツール | 用途 |
|--------|------|
| `pnpm` | フロントエンドのパッケージマネージャ |
| `biome` | フロントエンドリンタ + フォーマッタ |
| `vitest` | フロントエンドテストフレームワーク |
| `deno` | バックエンド / デスクトップのランタイム・リンタ・フォーマッタ・テスト（`deno lint` / `deno fmt` / `deno test`） |

## 対応プラットフォーム

| OS | 状態 |
|----|------|
| macOS 12+ | 対応 |

Deno Desktop（`deno desktop`）が対応する範囲に準ずる。

## 実行要件

- **Deno 2.9.1 以上**（`deno desktop` を使用）
- フロントエンドのビルドに Node.js 18 以上 + pnpm 8 以上
