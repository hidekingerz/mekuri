# mekuri - アーキテクチャ設計書

## 全体構成

```
┌───────────────────────────────────────────────────────┐
│   OS ネイティブ webview（Deno.BrowserWindow）           │
│  ┌──────────────┐            ┌────────────────────┐    │
│  │ メインウィンドウ │            │ ビューワーウィンドウ   │    │
│  │  (React)     │──開く──────▶│  (React)           │    │
│  └──────┬───────┘            └────────┬───────────┘    │
└─────────┼─────────────────────────────┼────────────────┘
          │ fetch POST /__invoke        │ （SSE GET /__events で push）
          ▼                             ▼
┌───────────────────────────────────────────────────────┐
│   Deno プロセス（deno desktop でバンドルした自己完結アプリ） │
│                                                       │
│  Deno.serve（127.0.0.1）                              │
│    ① dist/ 配信  ② POST /__invoke  ③ SSE GET /__events │
│         │                                             │
│  desktop/ → bindings/ → backend/（純ロジック）          │
│  ┌─────────────┐  ┌────────────────────┐              │
│  │ フォルダ走査   │  │ アーカイブ画像抽出   │              │
│  │ (backend/fs)│  │ (backend/archive) │              │
│  └─────────────┘  └────────────────────┘              │
└───────────────────────────────────────────────────────┘
```

要求/応答は HTTP `POST /__invoke`（body: `{command, args, windowLabel}`、戻り: `{ok, value|error}`）に集約し、
main→webview の push（窓をまたぐイベント・ネイティブメニューのクリック）は SSE `GET /__events`（PushHub）で配送する。
`win.bind`/`executeJs` は framework が採用する表示窓に届かない（白画面の真因）ため、HTTP/SSE を採用している。
詳細は `docs/tauri-to-deno-migration.md` を参照。

## レイヤー構成

### 1. フロントエンド（React / TypeScript）

UI の描画とユーザー操作を担当する。Tauri 互換 `invoke` shim（`deno-app/frontend/invoke.ts` = `fetch("/__invoke")`）経由でバックエンドと通信する。

| コンポーネント | 責務 |
|---------------|------|
| `FavoritesSidebar` | お気に入りフォルダの一覧表示・選択・削除（コンテキストメニュー） |
| `FolderTree` | ディレクトリ階層のツリー表示・操作 |
| `TreeNode` | ツリーノード描画・展開/折りたたみ・コンテキストメニュー（お気に入り追加） |
| `FileList` | 選択中フォルダ内のアーカイブファイル一覧表示 |
| `SpreadViewer` | 見開き/単ページ画像表示・ページ送り・プログレスバー・読み方向切替。`SpreadViewerHandle` を `useImperativeHandle` で公開し、外部からモード切替が可能 |
| `PageImage` | 個別の画像表示 |
| `Icons` | カスタム SVG アイコン（ChevronRight, FolderIcon, ArchiveIcon, PdfIcon, RtlIcon, LtrIcon 等） |

### 2. バックエンド / デスクトップ（TypeScript / Deno）

ファイルシステム操作とアーカイブ処理を担当する。`backend/` の純ロジックを `bindings/` でコマンド名に紐付け、`desktop/` が `Deno.serve` 経由の `POST /__invoke` として公開し、フロントエンドから呼び出す。トランスポートを差し替えてもロジックは Desktop API 非依存に保ち単体テスト可能にする、という方針（旧 `commands/` と `archive/` の分離）を引き継ぐ。

| レイヤ / モジュール | 責務 |
|-------------------|------|
| `frontend/` | webview に置く Tauri 互換 `invoke`/`event` shim（`backend` を import しないブラウザセーフ実装） |
| `desktop/` | `Deno.serve`・`Deno.BrowserWindow` への配線（httpInvoke / pushHub / window / viewer / menu） |
| `bindings/` | コマンド名 → `backend` のディスパッチ |
| `backend/fs` | ディレクトリ走査、ファイル一覧取得、ファイル読み込み、trash |
| `backend/archive` | アーカイブ処理の実装ロジック（Desktop 非依存、拡張子で ZIP/RAR を振り分け） |
| `backend/archive/zip` | ZIP/CBZ ファイル処理（`@zip-js/zip-js`） |
| `backend/archive/rar` | RAR/CBR ファイル処理（`node-unrar-js`） |
| `backend/sort` | 自然順ソート |
| `backend/settings` / `backend/store` | 設定永続化（自前 `Store` クラス → `settings.json`） |

`main.ts` は「Desktop API への配線のみ」を担い、ロジックは持たない（薄い配線層）。

## IPC コマンド設計

各コマンドは `POST /__invoke` の 1 本に集約される。body は `{command, args, windowLabel}`、戻りは `{ok, value|error}`。以下では各コマンドの `command` 名と論理的な入出力を示す。

### フォルダ走査

```
Command: read_directory
Input:   { path: string }
Output:  DirectoryEntry[]

DirectoryEntry {
  name: string
  path: string
  is_dir: boolean
  is_archive: boolean
  is_pdf: boolean
  has_subfolders: boolean
}
```

ツリーの遅延読み込みに対応する。フォルダを展開した時点でそのフォルダの直下のみを取得する。
`has_subfolders` はサブフォルダの有無を示し、UI 側でシェブロン表示の制御に使用する。
結果はディレクトリ優先、自然順ソート済みで返却される。隠しファイルとアーカイブ以外のファイルは除外される。

### アーカイブ内容分析

```
Command: analyze_archive_contents
Input:   { archive_path: string }
Output:  ArchiveContents

ArchiveContents =
  | { type: "Images", names: string[] }       // 画像を含む（自然順ソート済み）
  | { type: "NestedArchives", names: string[] } // ネストアーカイブを含む
  | { type: "Empty" }                          // 画像もアーカイブもなし
```

アーカイブを開く際に最初に呼ばれる。画像を直接含む場合はそのまま表示、ネストアーカイブを含む場合は選択 UI を表示する。

### アーカイブ画像一覧取得

```
Command: list_archive_images
Input:   { archive_path: string }
Output:  string[]   // 画像エントリ名の自然順ソート済みリスト
```

### アーカイブ画像データ取得

```
Command: get_archive_image
Input:   { archive_path: string, entry_name: string }
Output:  string   // Base64 エンコードされた data URL（例: "data:image/jpeg;base64,..."）
```

MIME タイプは拡張子から推定する（`.png` → `image/png`, `.webp` → `image/webp`, `.gif` → `image/gif`, その他 → `image/jpeg`）。

### ネストアーカイブ展開

```
Command: extract_nested_archive
Input:   { parent_path: string, nested_name: string }
Output:  string   // 展開された一時ファイルのパス
```

親アーカイブ内のネストアーカイブを一時ディレクトリに展開し、そのパスを返す。一時ディレクトリはアプリ終了まで保持される。

## ウィンドウ管理

`Deno.BrowserWindow`（OS ネイティブ webview）でマルチウィンドウを実現する。

- メインウィンドウ: アプリ起動時に1つ生成（初期状態は非表示、設定読み込み後に表示）
- ビューワーウィンドウ: アーカイブ選択時に `Deno.BrowserWindow` で動的に生成
  - ウィンドウラベルはアーカイブパスのハッシュ（`viewer-{hash}`）で一意にする（`utils/windowLabel.ts`）
  - 同じアーカイブを二重に開かない制御を行う（既存ウィンドウがあればフォーカス）
  - 最小サイズ: 600 x 400
- ウィンドウタイトル:
  - メインウィンドウ: `{お気に入りフォルダ名} - mekuri`（未選択時は `mekuri`）
  - ビューワーウィンドウ: `{ファイル名} [{現在位置}/{総数}] - mekuri`

## データフロー

### お気に入りフォルダの管理

```
ユーザー操作: 「Add Folder」ボタンクリック
  → React: open() でフォルダ選択ダイアログを表示
  → React: useFavorites.addFavorite() で Store（settings.json）に保存
  → React: FavoritesSidebar を更新

ユーザー操作: お気に入りを右クリック → 削除
  → React: useFavorites.removeFavorite() で Store（settings.json）から削除
  → React: FavoritesSidebar を更新
```

### フォルダツリー表示

```
ユーザー操作: お気に入りフォルダを選択
  → React: invoke("read_directory", { path })
  → backend: fs.readDirectory → フィルタリング・ソート（ディレクトリ優先、自然順）
  → React: ツリーノード描画（has_subfolders でシェブロン表示制御）

ユーザー操作: フォルダ展開
  → React: invoke("read_directory", { path })（遅延読み込み）
  → React: 子ノード追加描画
```

### ファイルリスト表示

```
ユーザー操作: フォルダ選択
  → React: invoke("read_directory", { path })
  → React: アーカイブファイルのみフィルタして FileList に表示
```

### アーカイブ閲覧

```
ユーザー操作: アーカイブファイルをクリック
  → React (メイン): 既存ウィンドウを検索 → あればフォーカス、なければ新規生成
  → React (ビューワー): invoke("analyze_archive_contents", { archive_path })
  → backend: archive.analyzeContents → 内容判定

  [画像を含む場合]
  → React (ビューワー): 先頭見開きの画像を取得・表示

  [ネストアーカイブを含む場合]
  → React (ビューワー): ネストアーカイブ選択 UI を表示
  → ユーザー操作: アーカイブを選択
  → React: invoke("extract_nested_archive", { parent_path, nested_name })
  → backend: 一時ディレクトリに展開 → パス返却
  → React: invoke("list_archive_images", { archive_path: 展開パス })
  → React (ビューワー): 画像表示

ユーザー操作: ページ送り
  → React (ビューワー): invoke("get_archive_image", { archive_path, entry_name })
  → backend: archive.getImageBase64 → data URL 返却
  → React (ビューワー): <img src={dataUrl}> で表示

ユーザー操作: Alt+矢印で兄弟ファイル移動
  → React: invoke("read_directory", { path: 親フォルダ })
  → React: 兄弟ファイルリストから次/前のファイルを特定
  → React: 新しいファイルで閲覧を再開
```

### PDF 閲覧

```
ユーザー操作: PDF ファイルをクリック
  → React (メイン): ビューワーウィンドウを生成
  → React (ビューワー): invoke("read_file_base64", { path }) で PDF バイナリを取得
  → React (ビューワー): pdfjs-dist で PDF をロード（CMap/標準フォント設定付き）
  → React (ビューワー): ページ数を取得し SpreadViewer に渡す（デフォルト LTR）

ユーザー操作: ページ送り
  → React (ビューワー): pdfjs-dist でページを Canvas にレンダリング → data URL 変換
  → React (ビューワー): <img src={dataUrl}> で表示
```

### 設定の永続化

```
ウィンドウリサイズ/カラムリサイズ
  → React: 500ms デバウンス後に useSettings.saveWindowSettings() 呼び出し
  → backend: Store（自前クラス）が settings.json に保存

アプリ起動
  → React: useSettings.getWindowSettings() で設定読み込み
  → React: ウィンドウサイズ・カラム幅を復元 → ウィンドウ表示
```

## エラーハンドリング方針

### バックエンド（TypeScript / Deno）

- `backend` のロジックはエラーを throw で伝播し、`bindings/` → `desktop/` 層が `POST /__invoke` の `{ok, error}` レスポンスに変換する
- エラーメッセージは英語で、原因が分かる程度に詳細に記述する

### フロントエンド（React）

各コンポーネントでエラー状態を管理し、ユーザーに視覚的にフィードバックする。

| コンポーネント | エラー発生箇所 | 表示方法 |
|---------------|---------------|---------|
| `FolderTree` | ルートディレクトリ読み込み失敗 | ツリー領域にエラーメッセージを表示 |
| `FolderTree` | サブフォルダ展開失敗 | 子ノードを空配列として扱い、静かに処理 |
| `ViewerApp` | アーカイブ内容分析の失敗 | エラー画面を表示（エラー詳細付き） |
| `ViewerApp` | アーカイブ内に画像なし | 「No images found」メッセージを表示 |
| `ViewerApp` | ネストアーカイブ展開失敗 | エラー画面を表示 |
| `SpreadViewer` | 個別の画像読み込み失敗 | ページ上部にエラーメッセージを表示（ナビゲーションは維持） |

## フロントエンドフック設計

| フック / モジュール | 責務 |
|-------------------|------|
| `useDirectory` | `read_directory` の呼び出し、フォルダ/ファイルのフィルタリング、兄弟ファイル取得 |
| `useArchiveLoader` | アーカイブの読み込み・内容分析・ネストアーカイブ展開 |
| `usePdfLoader` | PDF ファイルの読み込み・ページレンダリング（pdfjs-dist 経由） |
| `useFavorites` | お気に入りフォルダの CRUD（自前 `Store`（settings.json）経由で永続化） |
| `useSiblingNavigation` | Alt+矢印キーによる兄弟ファイル間のナビゲーション |

## ユーティリティ

| モジュール | 責務 |
|-----------|------|
| `spreadLayout` | 見開きレイアウトの計算（RTL/LTR 対応。先頭単ページ、以降ペア、末尾が奇数なら単ページ） |
| `windowLabel` | アーカイブパスからウィンドウラベルのハッシュ生成、ファイル名抽出 |
| `pdf` | PDF ファイルの読み込みとページレンダリング（pdfjs-dist 使用、CMap/標準フォント対応） |
| `fileType` | ファイルパスの拡張子からファイル種別（archive/pdf/unknown）を判定 |
