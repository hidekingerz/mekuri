# deno-app — mekuri の Deno Desktop 版（移行中）

mekuri を Tauri v2 から [Deno Desktop](https://docs.deno.com/runtime/desktop/) へ移行するための
並行ディレクトリ。`src-tauri/`（Rust 実装）と `src/`（React フロント）を正解として、
バックエンド機能を TypeScript に移植していく。

この移行は `loop/`（single-agent-loop）の自律ループで段階的に進める。
設計は `docs/superpowers/specs/2026-06-25-deno-desktop-migration-loop-design.md` を参照。

## 構成

```
deno-app/
  deno.json     tasks(verify/check/test/fmt/lint/dev)、imports
  main.ts       Deno.BrowserWindow でメイン/ビューワー窓を起動（マイルストーン4で作成、要 canary）
  backend/      Rust ロジックの TS 移植（Deno Desktop API 非依存・単体テスト可能）
    sort.ts     自然順ソート（natord 相当・参照実装）
    mod.ts      公開 API の re-export
    archive/    zip.ts / rar.ts / mod.ts（移植予定）
  bindings/     フロントの invoke 相当をプロセス内バインディングで提供（実装予定）
```

## コマンド

```bash
deno task verify   # 品質ゲート: fmt --check && lint && check && test
deno task test     # テストのみ
deno task check    # 型チェックのみ
deno task fmt      # フォーマット
deno task lint     # リント
```

## アプリの起動・ビルド（要 canary on PATH + `../dist/`）

webview は `../dist/`（Vite ビルド成果物）を配信するため、先にリポジトリルートで `pnpm build` を実行して `dist/` を生成しておく。

```bash
deno task dev      # 開発起動（ウィンドウを開く）= deno desktop -A main.ts
deno task build    # .app をビルド = deno desktop --output Mekuri.app -A main.ts
```

**権限**: 実行時に env（`HOME` 等の config dir 解決）・read/write（アーカイブ／settings.json／一時展開）・net（`Deno.serve`）・run（trash）が必要。`deno desktop` はビルド時に渡した権限をアプリへ焼き込むため、権限を指定しないと実行時に `Requires env access to "HOME"` 等で落ちる。現状は `-A`（全許可）で焼き込み。最小権限化する場合は deno.json に permission set を定義し `deno desktop -P <name> ...` を使う。

## 前提

- バックエンドロジックの移植・検証は stable deno（2.7.12+）で可能。
- `Deno.BrowserWindow` / `deno desktop`（マイルストーン4・6）は Deno 2.9.0+（canary）が必要。
