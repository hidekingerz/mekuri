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
│   ├── Viewer.tsx                 #   ビューワーウィンドウ ルートコンポーネント
│   ├── components/                #   共通コンポーネント
│   │   ├── FolderTree/            #     フォルダツリー
│   │   │   ├── FolderTree.tsx     #       ツリー本体
│   │   │   └── TreeNode.tsx       #       ツリーノード
│   │   └── SpreadViewer/          #     見開きビューワー
│   │       ├── SpreadViewer.tsx   #       ビューワー本体
│   │       └── PageImage.tsx      #       画像表示コンポーネント
│   ├── hooks/                     #   カスタムフック
│   │   ├── useDirectory.ts        #     ディレクトリ読み込み
│   │   └── useArchive.ts          #     アーカイブ操作
│   ├── types/                     #   型定義
│   │   └── index.ts               #     共通型
│   └── styles/                    #   スタイル
│       ├── global.css             #     グローバルスタイル
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
├── package.json                   #   フロントエンド依存定義
├── pnpm-lock.yaml                 #   ロックファイル
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
