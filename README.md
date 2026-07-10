# mekuri

圧縮ファイル（ZIP/RAR）内の画像を見開き表示で閲覧するデスクトップアプリケーション。

## 特徴

- **お気に入りフォルダ**: よく使うフォルダを登録して素早くアクセス
- **フォルダツリー**: ディレクトリ階層をツリー表示し、アーカイブファイルを探索
- **見開きビューワー**: アーカイブ内の画像を2ページ並列で表示（右綴じ対応）
- **マルチウィンドウ**: メインウィンドウとビューワーウィンドウの分離
- **設定の永続化**: ウィンドウサイズやカラム幅を自動保存

## 必要環境

### システム要件

- **Node.js** 18以上
- **pnpm** 8以上
- **Deno** 2.9.1以上（`deno desktop` を使用）

### macOS

Xcode Command Line Toolsが必要です:

```bash
xcode-select --install
```

## セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/hidekingerz/mekuri.git
cd mekuri

# 依存関係をインストール
pnpm install
```

## 開発

フロントエンド（React）は Vite でビルドし、その成果物（`dist/`）を Deno Desktop アプリが配信する。開発起動は次の手順で行う。

```bash
# 1. フロントエンドをビルド（dist/ を生成）
pnpm build

# 2. Deno Desktop アプリを開発起動
cd deno-app
deno task dev
```

フロントエンドのみを Vite dev サーバーで確認する場合は `pnpm dev` を使う。

## ビルド

```bash
# 1. フロントエンドをビルド
pnpm build

# 2. .app をビルド（dist を埋め込んだ自己完結アプリ）
cd deno-app
deno task build
```

`deno task build` は `deno desktop --output Mekuri.app --include ../dist -A main.ts` を実行し、`deno-app/Mekuri.app` を生成する。

## テスト・リント

```bash
# フロントエンド（React / TypeScript）
pnpm lint      # Biome リント
pnpm format    # Biome フォーマット
pnpm test      # Vitest テスト

# バックエンド / デスクトップ（deno-app/ 配下で実行）
cd deno-app
deno task verify   # 品質ゲート: fmt --check && lint && check && test
deno task test     # テストのみ
deno task check    # 型チェックのみ
deno task fmt      # フォーマット
deno task lint     # リント
```

## キーボードショートカット

### ビューワー

| キー | 動作 |
|------|------|
| `←` / `→` | ページ送り/戻し |
| `Home` / `End` | 最初/最後のページへ |
| `Alt + ↑` | 同一フォルダ内の次のアーカイブを開く |
| `Alt + ↓` | 同一フォルダ内の前のアーカイブを開く |
| マウスホイール | ページ送り/戻し |

## 技術スタック

- **Deno Desktop**（`Deno.BrowserWindow` + Deno プロセス、TypeScript バックエンド）
- **React 19** + TypeScript
- **Vite**

## ドキュメント

- [要件定義書](docs/requirements.md)
- [アーキテクチャ設計書](docs/architecture.md)
- [技術スタック](docs/tech-stack.md)
- [ディレクトリ構成](docs/directory-structure.md)

## ライセンス

MIT
