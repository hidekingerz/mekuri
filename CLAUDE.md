# CLAUDE.md - mekuri 開発ガイド

## プロジェクト概要

mekuri は圧縮ファイル（ZIP/RAR）内の画像および PDF ファイルを見開き表示で閲覧するデスクトップアプリ。
Deno Desktop（`Deno.BrowserWindow` + Deno プロセス）で構成され、バックエンドは TypeScript で実装される。

## アーキテクチャ

- **メインウィンドウ**: フォルダツリーで圧縮ファイルを探索（`index.html` + `src/main.tsx`）
- **ビューワーウィンドウ**: 見開き画像表示（`viewer.html` + `src/viewer.tsx`）
- **Deno 側**: フォルダ走査・アーカイブ画像抽出等の純ロジック（`deno-app/backend/`）と、`Deno.serve` / `Deno.BrowserWindow` への配線（`deno-app/desktop/`）
- **React 側**: Tauri 互換 `invoke` shim（`deno-app/frontend/invoke.ts` = `fetch("/__invoke")`）経由でバックエンドを呼び出す
- **IPC**: 要求/応答は HTTP `POST /__invoke`、main→webview の push は SSE `GET /__events`（PushHub）。フロント配信は `Deno.serve` で `dist/` を 127.0.0.1 配信する

詳細は `docs/` 配下のドキュメントを参照:
- `docs/requirements.md` - 要件定義
- `docs/architecture.md` - アーキテクチャ設計・IPC コマンド仕様
- `docs/tech-stack.md` - 技術スタック
- `docs/directory-structure.md` - ディレクトリ構成
- `docs/tauri-to-deno-migration.md` - Tauri → Deno Desktop 移行の設計記録

## 技術スタック

- **フレームワーク**: Deno Desktop（`deno desktop`。Deno 2.9.1+）
- **フロントエンド**: React 19 + TypeScript + Vite
- **バックエンド**: TypeScript（Deno / `deno-app/`）
- **パッケージマネージャ**: pnpm（フロント）/ Deno（バックエンド依存は `deno-app/deno.json` の imports）

## コマンド

```bash
# フロントエンド
pnpm install          # 依存インストール
pnpm dev              # Vite 開発サーバー起動
pnpm build            # プロダクションビルド（tsc && vite build）
pnpm lint             # Biome リント実行
pnpm format           # Biome フォーマット実行
pnpm test             # Vitest テスト実行

# バックエンド / デスクトップ (deno-app/ 配下で実行)
deno task verify       # 品質ゲート: fmt --check && lint && check && test
deno task test         # テスト実行
deno task check        # 型チェック
deno task fmt          # フォーマッタ
deno task lint         # リンタ
deno task dev          # 開発起動 = deno desktop --include ../dist -A main.ts
deno task build        # リリースビルド = deno desktop --output Mekuri.app --include ../dist -A main.ts
```

起動フロー: リポジトリルートで `pnpm build`（dist 生成）→ `cd deno-app && deno task dev`。

## ディレクトリ構成

```
src/                    # フロントエンド (React/TypeScript)
  components/
    FavoritesSidebar/   #   お気に入りサイドバー
    FolderTree/         #   フォルダツリーUI
    FileList/           #   アーカイブファイル一覧
    SpreadViewer/       #   見開きビューワーUI
    Icons/              #   カスタム SVG アイコン
  api/                  #   IPC ラッパー (archive, directory, favorites, settings, store)
  hooks/                #   React カスタムフック (useContextMenu, useWindowResize)
  utils/                #   ユーティリティ (spreadLayout, windowLabel)
  types/                #   型定義

deno-app/               # バックエンド / デスクトップ (TypeScript / Deno)
  main.ts               #   Deno.BrowserWindow / Deno.serve への薄い配線層
  deno.json             #   tasks・imports 定義
  frontend/             #   webview 側の Tauri 互換 shim（ブラウザセーフ・backend 非 import）
  desktop/              #   Desktop API 配線（httpInvoke / pushHub / window / viewer / menu）
  bindings/             #   コマンド名→backend のディスパッチ
  backend/              #   純ロジック（Desktop 非依存・単体テスト可能）
    sort.ts             #     自然順ソート（natord 相当）
    fs.ts               #     ディレクトリ走査・ファイル読み込み・trash
    settings.ts / store.ts  # 設定永続化（settings.json）
    archive/            #     zip.ts / rar.ts / mod.ts（内容分析・画像取得・ネスト展開）
  scripts/              #   補助スクリプト（check-no-tauri, make-test-cbz, smoke）
```

## コーディング規約

### TypeScript（deno-app / バックエンド）

- `deno lint` の警告をすべて解消すること
- `deno fmt` でフォーマット済みであること
- `desktop/` と `backend/` を分離する。`backend/` は Desktop API に依存しない純粋ロジックとして実装し、単体テスト可能にする
- エラーは throw で伝播し、`bindings/` 層で `POST /__invoke` の `{ok, error}` レスポンスに変換される
- ファイルパスの操作には Deno / `@std` の path API を使う

### TypeScript / React（フロント）

- Biome に準拠（リント + フォーマット）
- コンポーネントは関数コンポーネント + hooks で実装
- IPC 呼び出しは `api/` に集約する（React Hook ではないため `hooks/` には置かない）
- React カスタムフック（`useState` 等を使うもの）は `hooks/` に集約する
- 型定義は `types/` に集約する

### 共通

- コミットメッセージは英語で、変更内容を簡潔に記述する
- 日本語はドキュメント（`docs/`）とコメントで使用可
- 不要なコードやコメントは残さない

### ブランチ運用

- `main` は保護ブランチ。**`main` へ直接コミット・push しない**
- 変更は機能ブランチを切って行う（例: `feat/...`, `fix/...`, `chore/...`）
- リモートへ push したら `gh pr create` で Pull Request を作成し、CI 通過後にマージする
- `main` への直接コミットは PreToolUse フック（`.claude/settings.json`）でブロックされる

## 機能追加時の品質チェック

機能を追加・変更した際は、コミット前に以下を必ず実行し、エラーがあれば修正すること。

### 1. テストコードの追加

- バックエンド: `deno-app/backend/` 配下のロジックには Deno のテストで単体テストを書く（`*.test.ts`）
- フロント: `src/utils/` 等のロジックには Vitest でテストを書く（`*.test.ts`）

### 2. フォーマッタ実行

```bash
cd deno-app && deno fmt       # バックエンド / デスクトップ (Deno)
pnpm format                   # フロント TypeScript (Biome)
```

### 3. リンター実行

```bash
cd deno-app && deno lint      # バックエンド / デスクトップ（警告ゼロであること）
pnpm lint                     # フロント TypeScript (Biome)
```

### 4. テスト実行

```bash
cd deno-app && deno task test # バックエンド / デスクトップ テスト
pnpm test                     # フロント TypeScript テスト (Vitest)
```

### 5. 型チェック

```bash
cd deno-app && deno task check # バックエンド / デスクトップ 型チェック
npx tsc --noEmit               # フロント TypeScript 型チェック
```

deno-app 側は `deno task verify`（fmt --check && lint && check && test）でまとめて実行できる。
エラーが出た場合はすべて修正してからコミットする。

## 重要な設計判断

- **マルチウィンドウ**: Vite の multi-input + `Deno.BrowserWindow` で実現。同じアーカイブの二重オープンを防止する（window label レジストリ）
- **IPC トランスポート**: フレームワーク内蔵ブリッジは使わず、`Deno.serve` のプロセス内 HTTP サーバで繋ぐ。要求/応答は `POST /__invoke`、main→webview の push は SSE `GET /__events`（PushHub）。`win.bind`/`executeJs` は framework が採用する表示窓に届かない（白画面の真因）ため。詳細は `docs/tauri-to-deno-migration.md`
- **3カラムレイアウト**: メインウィンドウはお気に入り | フォルダツリー | ファイルリストの3カラム構成
- **遅延読み込み**: フォルダツリーは展開時にそのフォルダ直下のみ取得する
- **見開き表示**: 右綴じ（RTL）と左綴じ（LTR）を切替可能。アーカイブはデフォルト RTL、PDF はデフォルト LTR。先頭ページは単ページ表示。単ページ表示モードにも切替可能
- **PDF レンダリング**: pdfjs-dist でページ画像にレンダリング。CMap/標準フォント対応で日本語 PDF も表示可能。静的アセットは Vite プラグインで配信
- **画像転送**: バックエンド → React は Base64 エンコードした data URL で渡す
- **自然順ソート**: ファイル名は `deno-app/backend/sort.ts` で自然順ソートする
- **ネストアーカイブ**: 一時ディレクトリに展開し、アプリ終了まで保持する
- **設定永続化**: 自前 `Store` クラス（`settings.json`）でウィンドウサイズ・カラム幅・お気に入り・表示モード・読み方向を自動保存
