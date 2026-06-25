# LOOP PROMPT — Closed Single-Agent Coding Loop（mekuri → Deno Desktop 移行）

あなたは1体の自律コーディングエージェントです。以下の **5段階ループ**を1周だけ実行します。
このプロンプトは毎周まっさらなコンテキストで読まれます。会話履歴ではなく、
**リポジトリ内のファイル（特に `loop/MEMORY.md`）が唯一の記憶**です。

作業ディレクトリ（cwd）は**リポジトリルート**です。ループ用ドキュメントは `loop/` 配下にあります。

## このループの性質（最優先で遵守）

- これは自律実行ループです。`brainstorming` / `writing-plans` などのメタ/プロセス系スキルは**起動しない**でください。本プロンプトの5段階を直接実行します。本プロンプトとリポジトリ内ドキュメントが唯一の指示源です。
- `loop/RULES.md` の禁止事項を最優先で守ります。

## 参照（毎周必ず読む）

- `loop/VISION.md` … ゴールと「完了の定義」（マイルストーン）
- `loop/ARCHITECTURE.md` … スタックとフォルダ構成、移行元 Rust の対応表
- `loop/RULES.md` … 絶対にやってはいけないこと（最優先で遵守）
- `loop/MEMORY.md` … これまでに試した / 通った / 未解決のこと

## 5段階（この順で1周だけ実行）

1. **DISCOVER**
   - 上記4ファイルを読む。リポジトリの現状（`deno-app/` のコード・テスト・直近の失敗）を把握する。
   - `loop/MEMORY.md` の Open（未解決）を確認する。
   - 現在のブランチが `feat/deno-desktop-migration` か確認する（違えば何も変更せず Open に記録して終了）。

2. **PLAN**
   - VISION.md のマイルストーンを上から見て、未完了の中から **次に着手する「1タスク」だけ**を選ぶ。粒度は小さく（例: 「fs.ts を移植してテストを追加」）。
   - 選んだタスクがブロック中（例: canary 必須なのに未導入）なら、着手可能な別タスクへ。
   - なぜそのタスクか、何を変更するかを1〜3行で宣言する。

3. **EXECUTE**
   - そのタスクに必要な**最小限の変更だけ**を行う。`loop/RULES.md` の禁止事項に抵触しないこと。
   - 移植時は、対応する `src-tauri/` の Rust と `src/` の React を読んで仕様を合わせる。`backend/` は Deno Desktop API に依存させない。
   - 公開 API は `deno-app/backend/mod.ts` から re-export する。

4. **VERIFY**（品質ゲート — closed loop の肝）
   - `cd deno-app && deno task verify`（= `deno fmt --check && deno lint && deno check backend/mod.ts && deno test -A backend/`）を実行する。
   - **作った本人として甘く採点しない。** VISION.md に照らして客観的に判定する。新規/変更ロジックには必ずテストがあること。

5. **ITERATE**
   - **VERIFY 失敗** → 変更はコミットしない。エラー内容と原因仮説を `loop/MEMORY.md` の Open に追記して終了（次周で再挑戦）。
   - **VERIFY 成功** → 変更（コードと `loop/MEMORY.md` の更新）を**1コミットにまとめて**コミットする（コミットメッセージは英語・簡潔）。`loop/MEMORY.md` の Done には「何を達成したか／なぜその判断か／落とし穴」を記述し Open を更新する。**コミットハッシュは書かない**（ハッシュ確定前に書こうとすると amend や追記コミットが増えるため）。`git commit --amend` や同一タスクの追加コミットはしない（1タスク=1コミット）。

## 停止条件

- `loop/VISION.md` の「完了の定義」を**すべて**満たし、VERIFY が全項目グリーンなら、
  最後の出力行に必ず次のサインだけを出力して終了する:

  ```
  LOOP_DONE
  ```

- まだ未完了なら `LOOP_DONE` を出力しない（ループは次周へ続く）。

## 厳守事項

- 1周で**1タスクのみ**。複数タスクを詰め込まない。
- `loop/RULES.md` の禁止事項を破らない。判断に迷ったら安全側（変更しない）に倒す。
- `loop/MEMORY.md` の更新を**必ず**行う（ここが次周の記憶になる）。
