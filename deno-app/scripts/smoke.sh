#!/usr/bin/env bash
#
# smoke.sh — ヘッドレス GUI スモークテスト（macOS）。
#
# 現在の `src/` を `pnpm build`（= tsc && vite build）してから `deno desktop` でアプリを
# ビルドし、`open --stderr` で起動して webview の未捕捉エラー（main.ts の ERR_FORWARDER が
# `[web]` 行として stderr へ転送）が出たら FAIL する。移行漏れの Tauri API
# （`__TAURI_INTERNALS__` 参照）や bind 不達による白画面を、GUI を見ずに自動検知する。
#
# 2 段階: ①メイン窓の起動描画、②テスト CBZ を `open_viewer`（HTTP）で開いてビューワー窓の
# 起動描画。どちらの窓の `[web]` エラーも検知する（ビューワーの移行漏れも捕まえる）。
#
# 前提: macOS ＋ canary deno（`deno desktop`）が PATH 先頭にあること。
# 使い方: deno-app/ で `deno task smoke`

set -uo pipefail
cd "$(dirname "$0")/.." # deno-app/

if [[ "$(uname)" != "Darwin" ]]; then
  echo "[smoke] SKIP: macOS 専用（open --stderr を使用）"
  exit 0
fi

TMP="$(mktemp -d)"
APP="$TMP/Smoke.app"
LOG="$TMP/app.err"
CBZ="$TMP/smoke.cbz"
cleanup() {
  pkill -f "Smoke.app/Contents" 2>/dev/null
  pkill laufey_webview 2>/dev/null
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "[smoke] building frontend (pnpm build)..."
if ! (cd .. && pnpm build) >"$TMP/vite.log" 2>&1; then
  echo "[smoke] FAIL: frontend build (tsc && vite build) error"
  tail -25 "$TMP/vite.log"
  exit 1
fi

echo "[smoke] building desktop app (deno desktop)..."
if ! deno desktop --output "$APP" --include ../dist -A main.ts >"$TMP/build.log" 2>&1; then
  echo "[smoke] FAIL: desktop build error"
  tail -25 "$TMP/build.log"
  exit 1
fi

echo "[smoke] making test cbz..."
deno run -A scripts/make-test-cbz.ts "$CBZ" >>"$TMP/build.log" 2>&1

: >"$LOG"
echo "[smoke] launching main window (4s)..."
open --stderr "$LOG" "$APP"
sleep 4

# main.ts の `Deno.serve` が出す "Listening on http://127.0.0.1:PORT" から動的ポートを取得し、
# `open_viewer` を HTTP で叩いてビューワー窓を開く（ユーザーのアーカイブ・ダブルクリック相当）。
port="$(grep -oE '127\.0\.0\.1:[0-9]+' "$LOG" | head -1 | cut -d: -f2)"
if [[ -n "$port" ]]; then
  echo "[smoke] opening viewer via /__invoke (port $port)..."
  curl -s -X POST "http://127.0.0.1:$port/__invoke" \
    -H 'content-type: application/json' \
    -d "{\"command\":\"open_viewer\",\"args\":{\"archivePath\":\"$CBZ\"},\"windowLabel\":\"main\"}" \
    >/dev/null 2>&1 || true
  sleep 4
else
  echo "[smoke] WARN: serve port not found in stderr; skipping viewer phase"
fi

pkill -f "Smoke.app/Contents" 2>/dev/null
pkill laufey_webview 2>/dev/null

errs="$(grep -E '\[web\]|__TAURI_INTERNALS__' "$LOG" || true)"
if [[ -n "$errs" ]]; then
  echo "[smoke] FAIL — webview 実行時エラー（メイン窓 or ビューワー窓）:"
  echo "$errs"
  exit 1
fi

echo "[smoke] OK — メイン窓・ビューワー窓ともに webview 実行時エラーなし"
exit 0
