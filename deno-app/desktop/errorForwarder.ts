/**
 * webview の未捕捉エラー / 未処理 reject をプロセス stderr（`[web]` 行）へ転送する
 * `<script>` を生成する純粋ロジック。`main.ts` がこれを HTML の `<head>` へ注入する。
 *
 * GUI 無しでも実行時クラッシュ（例: 移行漏れの Tauri API が `__TAURI_INTERNALS__` を
 * 触る、bind 経由の invoke が reject する）を検知でき、smoke test
 * （`scripts/smoke.sh`）の判定材料になる。表示には影響しない。
 *
 * reason が Error のとき、`stack` だけを出すと WebKit など一部の webview では
 * stack に message が含まれず `[web] reject: @user-script:…`（位置情報のみ）と
 * なって原因が掴めない。そこで `name`/`message`/`stack` を明示的に連結して出す。
 */

/** webview 側で reason を人間可読な1行へ整形する関数の本体（JS ソース文字列）。 */
const DESCRIBE_FN =
  `function D(r){if(r==null)return String(r);if(typeof r==='string')return r;` +
  `try{var n=r.name||'Error';var m=r.message||'';var s=r.stack?(' | '+r.stack):'';` +
  `var d=n+': '+m+s;return d.trim()===':'?String(r):d;}catch(_){return String(r);}}`;

/**
 * エラー転送スクリプト（`<script>…</script>`）を返す。`<head>` 直後へ挿入する。
 * `/__log?m=…` へ fetch することで `main.ts` の serve ハンドラが `[web]` 行として
 * stderr へ書き出す。
 */
export function errorForwarderScript(): string {
  return `<script>function L(m){try{fetch('/__log?m='+encodeURIComponent(String(m)))}catch(_){}}` +
    DESCRIBE_FN +
    `addEventListener('error',function(e){L('error: '+e.message+' | '+D(e.error))});` +
    `addEventListener('unhandledrejection',function(e){L('reject: '+D(e.reason))});</script>`;
}
