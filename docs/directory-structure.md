# mekuri - ディレクトリ構成

Tauri v2 + React + Vite の標準的な構成に従う。

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
├── src-tauri/                     # バックエンド (Rust/Tauri)
│   ├── Cargo.toml                 #   Rust 依存定義
│   ├── tauri.conf.json            #   Tauri 設定（ウィンドウ、権限等）
│   ├── capabilities/              #   Tauri v2 権限設定
│   │   └── default.json           #     デフォルト権限
│   ├── src/
│   │   ├── main.rs                #     エントリポイント
│   │   ├── lib.rs                 #     ライブラリルート
│   │   ├── commands/              #     Tauri コマンド
│   │   │   ├── mod.rs             #       モジュール定義
│   │   │   ├── fs.rs              #       フォルダ走査コマンド
│   │   │   └── archive.rs         #       アーカイブ操作コマンド
│   │   └── archive/               #     アーカイブ処理ロジック
│   │       ├── mod.rs             #       モジュール定義
│   │       ├── zip.rs             #       ZIP 処理
│   │       └── rar.rs             #       RAR 処理
│   └── icons/                     #   アプリアイコン
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

Tauri v2 のマルチウィンドウ機能を使うため、フロントエンドのエントリポイントを2つ用意する。

- `index.html` + `src/main.tsx` → メインウィンドウ
- `viewer.html` + `src/viewer.tsx` → ビューワーウィンドウ

Vite の `build.rollupOptions.input` で複数エントリを指定する。

### Rust モジュール分割

- `commands/`: Tauri の `#[tauri::command]` を定義するレイヤー。入出力の変換を行う
- `archive/`: アーカイブ処理の実装レイヤー。Tauri に依存しない純粋なロジック

この分離により、アーカイブ処理ロジックの単体テストが書きやすくなる。
