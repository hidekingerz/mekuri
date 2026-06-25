#!/usr/bin/env bash
#
# run.sh — Closed Single-Agent Loop runner (mekuri → Deno Desktop 移行)
#
# エージェントに loop/LOOP_PROMPT.md を毎周フレッシュなコンテキストで渡し、
# 出力に停止サイン（LOOP_DONE）が出るか最大反復回数に達するまで繰り返す。
# 作業ディレクトリはリポジトリルート（このスクリプトの親ディレクトリ）。
#
# 使い方:
#   chmod +x loop/run.sh
#   ./loop/run.sh
#
# 主要な環境変数（必要に応じて上書き）:
#   AGENT_CMD     エージェント1回実行コマンド。プロンプトを stdin で受け取り標準出力に返す。
#                 既定: `claude -p --dangerously-skip-permissions -`
#                 （無人ループのため権限確認をバイパス。feat ブランチ + RULES + VERIFY が安全網）
#   PROMPT_FILE   ループ用プロンプト（既定: loop/LOOP_PROMPT.md）
#   MAX_ITER      最大反復回数（トークン暴走防止。既定: 8）
#   DONE_MARKER   停止サイン（既定: LOOP_DONE）
#   VERIFY_CMD    各周のエージェント実行後に走らせる品質ゲート（二重安全網）。
#                 既定: `cd deno-app && deno task verify`

set -euo pipefail

AGENT_CMD="${AGENT_CMD:-claude -p --dangerously-skip-permissions -}"
PROMPT_FILE="${PROMPT_FILE:-loop/LOOP_PROMPT.md}"
MAX_ITER="${MAX_ITER:-8}"
DONE_MARKER="${DONE_MARKER:-LOOP_DONE}"
VERIFY_CMD="${VERIFY_CMD:-cd deno-app && deno task verify}"

# リポジトリルートへ移動（このスクリプトは loop/ 配下にある想定）
cd "$(dirname "$0")/.."

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "ERROR: prompt file not found: $PROMPT_FILE (cwd=$PWD)" >&2
  exit 1
fi

branch="$(git symbolic-ref --short HEAD 2>/dev/null || echo '?')"

echo "== Closed Single-Agent Loop (mekuri → Deno Desktop) =="
echo "cwd     : $PWD"
echo "branch  : $branch"
echo "agent   : $AGENT_CMD"
echo "prompt  : $PROMPT_FILE"
echo "maxiter : $MAX_ITER"
echo "marker  : $DONE_MARKER"
echo "verify  : $VERIFY_CMD"
echo

if [[ "$branch" == "main" ]]; then
  echo "ERROR: 現在 main ブランチです。feat/deno-desktop-migration へ切り替えてから実行してください。" >&2
  exit 1
fi

for ((i = 1; i <= MAX_ITER; i++)); do
  echo "---- iteration $i / $MAX_ITER ($(date '+%H:%M:%S')) ----"

  # エージェントを毎周フレッシュなコンテキストで起動（記憶は loop/MEMORY.md / リポ状態が担う）
  if ! output="$($AGENT_CMD < "$PROMPT_FILE")"; then
    echo "agent invocation failed on iteration $i — 次周で再挑戦します。"
    continue
  fi
  echo "$output"

  # 外部品質ゲート（closed loop の二重安全網）
  if [[ -n "$VERIFY_CMD" ]]; then
    echo "-- VERIFY: $VERIFY_CMD"
    if ! bash -c "$VERIFY_CMD"; then
      echo "VERIFY failed on iteration $i — 次周で再挑戦します。"
      continue
    fi
  fi

  # 停止サインの検出
  if grep -q "$DONE_MARKER" <<< "$output"; then
    echo
    echo "== $DONE_MARKER detected on iteration $i. Loop complete. =="
    exit 0
  fi
done

echo
echo "== Reached MAX_ITER ($MAX_ITER) without $DONE_MARKER. Stopping. =="
echo "loop/MEMORY.md の Open を確認し、必要なら ./loop/run.sh を再実行してください。"
exit 1
