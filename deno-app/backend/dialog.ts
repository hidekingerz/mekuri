/**
 * ネイティブのフォルダ選択ダイアログ（Tauri 版 `@tauri-apps/plugin-dialog` の
 * `open({ directory: true })` 相当）。
 *
 * Deno Desktop canary にはネイティブのファイル/フォルダ選択 picker op が無いため、
 * OS 標準のダイアログコマンドを `Deno.Command` で起動して選択パスを得る。
 * コマンド組み立ては純粋ロジックとして本体に置き、実行（ネイティブ依存）は注入可能な
 * `CommandRunner` に分離する（`trashFile` の deleter 注入と同じ方針）。これにより
 * `backend/` を Deno Desktop 非依存に保ち、コマンド構築・出力解釈を単体テストできる。
 */

/** picker 起動コマンド（実行ファイルと引数）。 */
export interface PickerCommand {
  cmd: string;
  args: string[];
}

/** picker コマンドを実行する関数（テスト差し替え用）。 */
export type CommandRunner = (
  command: PickerCommand,
) => Promise<{ code: number; stdout: string }>;

/**
 * OS 別のフォルダ選択ダイアログコマンドを組み立てる。
 * - macOS: `osascript` で `choose folder` → POSIX パスを stdout に出す。
 * - Linux: `zenity --file-selection --directory`。
 * - Windows: PowerShell の `FolderBrowserDialog`。
 *
 * 未対応 OS は例外を投げる。
 */
export function buildFolderPickerCommand(
  os: typeof Deno.build.os,
): PickerCommand {
  switch (os) {
    case "darwin":
      return {
        cmd: "osascript",
        args: ["-e", "POSIX path of (choose folder)"],
      };
    case "linux":
      return {
        cmd: "zenity",
        args: ["--file-selection", "--directory"],
      };
    case "windows":
      return {
        cmd: "powershell",
        args: [
          "-NoProfile",
          "-Command",
          "Add-Type -AssemblyName System.Windows.Forms;" +
          "$d = New-Object System.Windows.Forms.FolderBrowserDialog;" +
          "if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }",
        ],
      };
    default:
      throw new Error(`Unsupported OS for folder picker: ${os}`);
  }
}

/**
 * picker の stdout を選択パスへ正規化する。空（キャンセル相当）なら `null`。
 * 末尾の改行・余白を除き、ルート以外の末尾スラッシュ（macOS の POSIX パス）も落とす。
 */
export function parsePickerOutput(stdout: string): string | null {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return null;
  if (trimmed === "/") return trimmed;
  return trimmed.replace(/\/+$/, "");
}

/** 既定の runner。`Deno.Command` で picker を起動し、終了コードと stdout を返す。 */
const defaultRunner: CommandRunner = async ({ cmd, args }) => {
  const output = await new Deno.Command(cmd, { args }).output();
  return {
    code: output.code,
    stdout: new TextDecoder().decode(output.stdout),
  };
};

/**
 * ネイティブのフォルダ選択ダイアログを表示し、選択されたパスを返す。
 * ユーザーがキャンセルした場合（終了コード非 0、または出力が空）は `null` を返す
 * （Tauri 版 `open` がキャンセル時に `null` を返すのと等価）。
 */
export async function pickFolder(
  os: typeof Deno.build.os = Deno.build.os,
  runner: CommandRunner = defaultRunner,
): Promise<string | null> {
  const command = buildFolderPickerCommand(os);
  const { code, stdout } = await runner(command);
  if (code !== 0) return null;
  return parsePickerOutput(stdout);
}
