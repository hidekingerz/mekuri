# mekuri - ディレクトリ構成

フロントエンド（React + Vite）と Deno Desktop バックエンド（`deno-app/`）を分離した構成に従う。

```
mekuri/
├── docs/                          # プロジェクトドキュメント
│   ├── requirements.md            #   要件定義書
│   ├── architecture.md            #   アーキテクチャ設計書
│   ├── tech-stack.md              #   技術スタック定義
│   └── directory-structure.md     #   本ファイル
│
├── src/                           # フロントエンド (React/TypeScript)
│   ├── main.tsx                   #   メインウィンドウ エントリポイント
│   ├── viewer.tsx                 #   ビューワーウィンドウ エントリポイント
│   ├── App.tsx                    #   メインウィンドウ ルートコンポーネント
│   ├── ViewerApp.tsx              #   ビューワーウィンドウ ルートコンポーネント
│   ├── components/                #   コンポーネント
│   │   ├── FavoritesSidebar/      #     お気に入りサイドバー
│   │   │   └── FavoritesSidebar.tsx
│   │   ├── FolderTree/            #     フォルダツリー
│   │   │   ├── FolderTree.tsx     #       ツリー本体
│   │   │   └── TreeNode.tsx       #       ツリーノード
│   │   ├── FileList/              #     ファイルリスト（アーカイブ一覧）
│   │   │   └── FileList.tsx
│   │   ├── SpreadViewer/          #     見開きビューワー
│   │   │   ├── SpreadViewer.tsx   #       ビューワー本体
│   │   │   └── PageImage.tsx      #       画像表示コンポーネント
│   │   └── Icons/                 #     カスタム SVG アイコン
│   │       └── Icons.tsx
│   ├── hooks/                     #   カスタムフック
│   │   ├── useArchiveLoader.ts    #     アーカイブ読み込み・内容分析・ネスト展開
│   │   ├── usePdfLoader.ts        #     PDF 読み込み・ページレンダリング
│   │   ├── useSiblingNavigation.ts #    兄弟ファイル間ナビゲーション
│   │   ├── useContextMenu.ts      #     コンテキストメニュー
│   │   └── useWindowResize.ts     #     ウィンドウリサイズ検知
│   ├── utils/                     #   ユーティリティ
│   │   ├── spreadLayout.ts        #     見開きレイアウト計算（RTL/LTR 対応）
│   │   ├── spreadLayout.test.ts   #     spreadLayout テスト
│   │   ├── pdf.ts                 #     PDF 読み込み・レンダリング（pdfjs-dist）
│   │   ├── fileType.ts            #     ファイル種別判定
│   │   ├── fileType.test.ts       #     fileType テスト
│   │   ├── windowLabel.ts         #     ウィンドウラベル生成
│   │   └── windowLabel.test.ts    #     windowLabel テスト
│   ├── types/                     #   型定義
│   │   └── index.ts               #     共通型（DirectoryEntry）
│   └── styles/                    #   スタイル
│       ├── global.css             #     グローバルスタイル（メインウィンドウ）
│       └── viewer.css             #     ビューワー用スタイル
│
├── deno-app/                      # バックエンド / デスクトップ (TypeScript / Deno)
│   ├── deno.json                  #   tasks（verify/check/test/fmt/lint/dev/build）・imports 定義
│   ├── deno.lock                  #   ロックファイル
│   ├── main.ts                    #   Deno.BrowserWindow / Deno.serve への薄い配線層
│   ├── frontend/                  #   webview 側 Tauri 互換 shim（ブラウザセーフ・backend 非 import）
│   │   ├── invoke.ts              #     fetch POST /__invoke による invoke shim
│   │   ├── events.ts              #     SSE /__events 購読
│   │   ├── event.ts               #     emit/listen 互換
│   │   ├── window.ts              #     window 操作互換
│   │   ├── viewer.ts              #     ビューワー起動
│   │   ├── dialog.ts              #     フォルダ選択ダイアログ互換
│   │   ├── menu.ts                #     コンテキストメニュー互換
│   │   ├── store.ts               #     設定ストア互換
│   │   ├── windowLabel.ts         #     ウィンドウラベル生成
│   │   └── mod.ts                 #     公開 API re-export
│   ├── desktop/                   #   Desktop API 配線
│   │   ├── httpInvoke.ts          #     POST /__invoke ハンドラ
│   │   ├── pushHub.ts             #     SSE /__events（PushHub）
│   │   ├── event.ts               #     イベント配送
│   │   ├── bridge.ts              #     invoke ブリッジ
│   │   ├── window.ts              #     窓操作
│   │   ├── windowRegistry.ts      #     label → 窓 の解決
│   │   ├── windowConfig.ts        #     メイン窓設定
│   │   ├── viewer.ts              #     ビューワー窓生成
│   │   ├── menu.ts                #     ネイティブメニュー
│   │   ├── errorForwarder.ts      #     webview のエラー転送
│   │   └── mod.ts                 #     公開 API re-export
│   ├── bindings/                  #   コマンド名 → backend のディスパッチ
│   │   ├── invoke.ts              #     invoke ディスパッチ
│   │   ├── store.ts               #     store コマンド
│   │   └── mod.ts                 #     公開 API re-export
│   ├── backend/                   #   純ロジック（Desktop 非依存・単体テスト可能）
│   │   ├── fs.ts                  #     ディレクトリ走査・ファイル読み込み・trash
│   │   ├── sort.ts                #     自然順ソート
│   │   ├── extensions.ts          #     拡張子・MIME 判定
│   │   ├── dialog.ts              #     フォルダ選択コマンド組み立て
│   │   ├── paths.ts               #     config dir / settings.json パス解決
│   │   ├── settings.ts            #     設定スキーマ・アクセサ
│   │   ├── store.ts               #     Store クラス（settings.json 永続化）
│   │   ├── mod.ts                 #     公開 API re-export
│   │   └── archive/               #     アーカイブ処理ロジック
│   │       ├── zip.ts             #       ZIP/CBZ 処理（@zip-js/zip-js）
│   │       ├── rar.ts             #       RAR/CBR 処理（node-unrar-js）
│   │       ├── cache.ts           #       アーカイブキャッシュ
│   │       └── mod.ts             #       内容分析・画像取得・ネスト展開の統一 API
│   └── scripts/                   #   補助スクリプト（check-no-tauri, make-test-cbz, smoke）
│
├── index.html                     #   メインウィンドウ HTML
├── viewer.html                    #   ビューワーウィンドウ HTML
├── vite.config.ts                 #   Vite 設定
├── tsconfig.json                  #   TypeScript 設定
├── biome.json                     #   Biome 設定（リンタ + フォーマッタ）
├── package.json                   #   フロントエンド依存定義
├── pnpm-lock.yaml                 #   ロックファイル
├── CLAUDE.md                      #   AI アシスタント向け開発ガイド
├── README.md                      #   プロジェクト概要
└── LICENSE                        #   MIT ライセンス
```

## 構成のポイント

### マルチウィンドウ対応

`Deno.BrowserWindow` のマルチウィンドウを使うため、フロントエンドのエントリポイントを2つ用意する。

- `index.html` + `src/main.tsx` → メインウィンドウ
- `viewer.html` + `src/viewer.tsx` → ビューワーウィンドウ

Vite の `build.rollupOptions.input` で複数エントリを指定する。

### deno-app のレイヤ分割

- `frontend/`: webview に置く Tauri 互換 `invoke`/`event` shim。`backend` を import しないブラウザセーフ実装
- `desktop/`: `Deno.serve`・`Deno.BrowserWindow` への配線（HTTP/SSE/窓/メニュー）
- `bindings/`: コマンド名 → `backend` のディスパッチ
- `backend/`: アーカイブ展開・FS・ソート等の純粋なロジック。Desktop API に依存しない

`backend/` を Desktop 非依存に保つことで、アーカイブ処理ロジックの単体テストが書きやすくなる（旧 Tauri 版の `commands/` と `archive/` の分離を引き継いだ方針）。
