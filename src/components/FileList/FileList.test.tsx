// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readDirectoryFiles, trashFiles } from "../../api/directory";
import { emitFileSortChanged, onFileChanged } from "../../api/fileEvents";
import { getFileSort, saveFileSort } from "../../api/settings";
import type { DirectoryEntry } from "../../types";
import { FileList } from "./FileList";

// Rust 側との境界（IPC）だけを差し替える。一覧・選択・確認・キー操作は本物のコンポーネントで動かす
vi.mock("../../api/directory", () => ({
  readDirectoryFiles: vi.fn(),
  trashFiles: vi.fn(),
}));
vi.mock("../../api/fileEvents", () => ({
  emitFileTrashed: vi.fn(async () => {}),
  emitFileSortChanged: vi.fn(async () => {}),
  onFileChanged: vi.fn(async () => () => {}),
}));
vi.mock("../../api/settings", () => ({
  getFileSort: vi.fn(),
  saveFileSort: vi.fn(async () => {}),
}));
vi.mock("../../api/fileDrop", () => ({ readDroppedPaths: vi.fn(async () => []) }));

const FOLDER = "/m/A";
const entry = (name: string): DirectoryEntry => ({
  name,
  path: `${FOLDER}/${name}`,
  is_dir: false,
  is_archive: true,
  is_pdf: false,
  has_subfolders: false,
  modified_ms: 0,
  size: 1,
});

/** 仮のフォルダの中身。trashFiles が成功するとここから消える。 */
let folder: string[];

const onOpenFiles = vi.fn();
const onTrashError = vi.fn();

async function renderList() {
  const user = userEvent.setup();
  render(
    <FileList
      folderPath={FOLDER}
      onArchiveSelect={vi.fn()}
      onOpenFiles={onOpenFiles}
      onFolderSelect={vi.fn()}
      searchResults={null}
      onTrashError={onTrashError}
    />,
  );
  await screen.findByRole("option", { name: "a1.zip" });
  return user;
}

// 並べ替えの選択欄にも option があるので、ファイルの一覧（listbox）の中だけを見る
const list = () => within(screen.getByRole("listbox", { name: "ファイル" }));
const item = (name: string) => list().getByRole("option", { name });
const selectedNames = () =>
  list()
    .queryAllByRole("option", { selected: true })
    .map((el) => el.textContent);
const dialog = () => screen.queryByRole("dialog");

beforeEach(() => {
  folder = ["a1.zip", "a2.zip", "a3.zip", "a4.zip"];
  vi.mocked(readDirectoryFiles).mockImplementation(async () => folder.map(entry));
  vi.mocked(getFileSort).mockResolvedValue({ key: "name", direction: "asc" });
  vi.mocked(trashFiles).mockImplementation(async (paths) => {
    folder = folder.filter((name) => !paths.includes(`${FOLDER}/${name}`));
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const MAC_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const WINDOWS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const runOn = (userAgent: string) =>
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);

describe("selection", () => {
  it("selects only the clicked file", async () => {
    const user = await renderList();
    await user.click(item("a2.zip"));
    await user.click(item("a3.zip"));
    expect(selectedNames()).toEqual(["a3.zip"]);
  });

  it("toggles a file with Cmd+click", async () => {
    const user = await renderList();
    await user.click(item("a1.zip"));
    await user.keyboard("{Meta>}");
    await user.click(item("a3.zip"));
    expect(selectedNames()).toEqual(["a1.zip", "a3.zip"]);
    await user.click(item("a3.zip"));
    await user.keyboard("{/Meta}");
    expect(selectedNames()).toEqual(["a1.zip"]);
  });

  it("replaces the selection with the range from the anchor on Shift+click", async () => {
    const user = await renderList();
    await user.click(item("a1.zip"));
    await user.keyboard("{Shift>}");
    await user.click(item("a4.zip"));
    expect(selectedNames()).toEqual(["a1.zip", "a2.zip", "a3.zip", "a4.zip"]);
    await user.click(item("a2.zip"));
    await user.keyboard("{/Shift}");
    expect(selectedNames()).toEqual(["a1.zip", "a2.zip"]);
  });

  it("moves the selection with the arrow keys and clears it with Escape", async () => {
    const user = await renderList();
    await user.click(item("a1.zip"));
    await user.keyboard("{ArrowDown}");
    expect(selectedNames()).toEqual(["a2.zip"]);
    await user.keyboard("{Escape}");
    expect(selectedNames()).toEqual([]);
  });
});

describe("Enter", () => {
  it("opens every selected file in list order", async () => {
    const user = await renderList();
    await user.click(item("a3.zip"));
    await user.keyboard("{Meta>}");
    await user.click(item("a1.zip"));
    await user.keyboard("{/Meta}{Enter}");
    expect(onOpenFiles).toHaveBeenCalledTimes(1);
    expect(onOpenFiles).toHaveBeenCalledWith([`${FOLDER}/a1.zip`, `${FOLDER}/a3.zip`]);
  });

  it("does not open a file that was taken out of the selection", async () => {
    const user = await renderList();
    await user.click(item("a1.zip"));
    await user.keyboard("{Meta>}");
    await user.click(item("a3.zip"));
    await user.click(item("a3.zip"));
    await user.keyboard("{/Meta}{Enter}");
    expect(onOpenFiles).toHaveBeenCalledWith([`${FOLDER}/a1.zip`]);
  });

  it("opens nothing after the selection is cleared", async () => {
    const user = await renderList();
    await user.click(item("a2.zip"));
    await user.keyboard("{Escape}{Enter}");
    expect(onOpenFiles).not.toHaveBeenCalled();
  });
});

describe("moving files to the trash", () => {
  it("asks once and trashes all selected files after confirming", async () => {
    const user = await renderList();
    await user.click(item("a1.zip"));
    await user.keyboard("{Shift>}");
    await user.click(item("a3.zip"));
    await user.keyboard("{/Shift}{Delete}");

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(trashFiles).not.toHaveBeenCalled();
    await user.click(within(dialog() as HTMLElement).getByRole("button", { name: "ゴミ箱に移動" }));

    await waitFor(() => expect(screen.queryByRole("option", { name: "a1.zip" })).toBeNull());
    expect(trashFiles).toHaveBeenCalledTimes(1);
    expect(trashFiles).toHaveBeenCalledWith([
      `${FOLDER}/a1.zip`,
      `${FOLDER}/a2.zip`,
      `${FOLDER}/a3.zip`,
    ]);
    expect(dialog()).toBeNull();
    expect(screen.getByRole("option", { name: "a4.zip" })).toBeTruthy();
  });

  it("trashes nothing when the confirm dialog is cancelled", async () => {
    const user = await renderList();
    await user.click(item("a1.zip"));
    await user.keyboard("{Delete}");
    await user.click(within(dialog() as HTMLElement).getByRole("button", { name: "キャンセル" }));

    expect(dialog()).toBeNull();
    expect(trashFiles).not.toHaveBeenCalled();
    expect(selectedNames()).toEqual(["a1.zip"]);
  });

  it("puts the initial focus on cancel, so Enter right after opening trashes nothing", async () => {
    const user = await renderList();
    await user.click(item("a1.zip"));
    await user.keyboard("{Delete}");
    expect(document.activeElement?.textContent).toBe("キャンセル");
    await user.keyboard("{Enter}");

    expect(dialog()).toBeNull();
    expect(trashFiles).not.toHaveBeenCalled();
  });

  it("asks with Cmd+Backspace on macOS but not with Backspace alone or Ctrl+Backspace", async () => {
    runOn(MAC_USER_AGENT);
    const user = await renderList();
    await user.click(item("a1.zip"));
    await user.keyboard("{Backspace}");
    expect(dialog()).toBeNull();
    await user.keyboard("{Control>}{Backspace}{/Control}");
    expect(dialog()).toBeNull();
    await user.keyboard("{Meta>}{Backspace}{/Meta}");
    expect(dialog()).not.toBeNull();
  });

  it("asks only with Delete outside macOS", async () => {
    runOn(WINDOWS_USER_AGENT);
    const user = await renderList();
    await user.click(item("a1.zip"));
    await user.keyboard("{Meta>}{Backspace}{/Meta}");
    expect(dialog()).toBeNull();
    await user.keyboard("{Control>}{Backspace}{/Control}");
    expect(dialog()).toBeNull();
    await user.keyboard("{Delete}");
    expect(dialog()).not.toBeNull();
  });

  it("keeps the keyboard working after cancelling", async () => {
    const user = await renderList();
    await user.click(item("a1.zip"));
    await user.keyboard("{Delete}");
    await user.click(within(dialog() as HTMLElement).getByRole("button", { name: "キャンセル" }));
    await user.keyboard("{ArrowDown}");
    expect(selectedNames()).toEqual(["a2.zip"]);
  });

  it("reports the reason when the trash fails", async () => {
    vi.mocked(trashFiles).mockRejectedValueOnce("Operation not permitted");
    const user = await renderList();
    await user.click(item("a1.zip"));
    await user.keyboard("{Delete}");
    await user.click(within(dialog() as HTMLElement).getByRole("button", { name: "ゴミ箱に移動" }));

    await waitFor(() => expect(onTrashError).toHaveBeenCalledWith("Operation not permitted"));
    expect(screen.getByRole("option", { name: "a1.zip" })).toBeTruthy();
  });

  it("leaves out a selected file that disappeared from the list", async () => {
    let notifyFileChanged = () => {};
    vi.mocked(onFileChanged).mockImplementation(async (listener) => {
      notifyFileChanged = listener;
      return () => {};
    });
    const user = await renderList();
    await user.click(item("a1.zip"));
    await user.keyboard("{Meta>}");
    await user.click(item("a2.zip"));
    await user.keyboard("{/Meta}");

    // 別のウィンドウで a2 が消えた
    folder = folder.filter((name) => name !== "a2.zip");
    notifyFileChanged();
    await waitFor(() => expect(screen.queryByRole("option", { name: "a2.zip" })).toBeNull());

    // 選択（a1 と、消えた a2）を保ったまま a3 を足して、ゴミ箱へ
    await user.keyboard("{Meta>}");
    await user.click(item("a3.zip"));
    await user.keyboard("{/Meta}{Delete}");
    await user.click(within(dialog() as HTMLElement).getByRole("button", { name: "ゴミ箱に移動" }));

    await waitFor(() => expect(trashFiles).toHaveBeenCalledTimes(1));
    expect(trashFiles).toHaveBeenCalledWith([`${FOLDER}/a1.zip`, `${FOLDER}/a3.zip`]);
  });
});

describe("sort order", () => {
  const names = () =>
    list()
      .getAllByRole("option")
      .map((el) => el.textContent);

  it("restores the order saved last time", async () => {
    vi.mocked(getFileSort).mockResolvedValue({ key: "name", direction: "desc" });
    await renderList();
    await waitFor(() => expect(names()).toEqual(["a4.zip", "a3.zip", "a2.zip", "a1.zip"]));
    expect(screen.getByRole("button", { name: "降順。クリックで昇順" })).toBeTruthy();
  });

  it("saves a changed order and then tells the viewer windows", async () => {
    const user = await renderList();
    await user.click(screen.getByRole("button", { name: "昇順。クリックで降順" }));
    expect(names()).toEqual(["a4.zip", "a3.zip", "a2.zip", "a1.zip"]);
    expect(saveFileSort).toHaveBeenLastCalledWith({ key: "name", direction: "desc" });
    await waitFor(() => expect(emitFileSortChanged).toHaveBeenCalledTimes(1));

    await user.selectOptions(screen.getByRole("combobox", { name: "並び順" }), "サイズ");
    expect(saveFileSort).toHaveBeenLastCalledWith({ key: "size", direction: "desc" });
    await waitFor(() => expect(emitFileSortChanged).toHaveBeenCalledTimes(2));
  });

  it("keeps the order the user picked while the saved one was still loading", async () => {
    let finishLoading: (sort: { key: "name"; direction: "asc" }) => void = () => {};
    vi.mocked(getFileSort).mockReturnValue(
      new Promise((resolve) => {
        finishLoading = resolve;
      }),
    );
    const user = await renderList();
    await user.click(screen.getByRole("button", { name: "昇順。クリックで降順" }));
    finishLoading({ key: "name", direction: "asc" });
    // 読み終えた値が届くのを待つ
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(names()).toEqual(["a4.zip", "a3.zip", "a2.zip", "a1.zip"]);
  });
});
