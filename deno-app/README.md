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

## 前提

- バックエンドロジックの移植・検証は stable deno（2.7.12+）で可能。
- `Deno.BrowserWindow` / `deno desktop`（マイルストーン4・6）は Deno 2.9.0+（canary）が必要。
