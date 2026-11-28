import { expect, test, WINDOWS_USER_AGENT } from "./helpers";

test.describe("ファイルをゴミ箱へ", () => {
  test("メニューからの確認は 1 回で、キャンセルすれば消えない", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a1.zip").click();
    await main.file("a2.zip").click({ modifiers: ["Meta"] });
    await main.file("a2.zip").click({ button: "right" });
    await expect(main.menuItem("ゴミ箱")).toHaveText("2 件をゴミ箱に移動");
    await main.menuItem("ゴミ箱").click();

    await expect(main.dialog()).toHaveCount(1);
    await expect(main.dialog().getByRole("button", { name: "キャンセル" })).toBeFocused();
    expect(await main.calls("trash_files")).toEqual([]);

    // 開いた直後の Enter はキャンセルになる
    await main.page.keyboard.press("Enter");
    await expect(main.dialog()).toHaveCount(0);
    expect(await main.calls("trash_files")).toEqual([]);
    expect(await main.folderContents("/m/manga/作者A")).toContain("a1.zip");
    expect(await main.selectedFiles()).toEqual(["a1.zip", "a2.zip"]);
  });

  test("Delete と Cmd+Backspace で確認が出て、Backspace 単独では出ない", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a1.zip").click();
    await main.page.keyboard.press("Backspace");
    await expect(main.dialog()).toHaveCount(0);

    await main.page.keyboard.press("Delete");
    await expect(main.dialog()).toBeVisible();
    await main.page.keyboard.press("Escape");
    await expect(main.dialog()).toHaveCount(0);

    await main.page.keyboard.press("Control+Backspace");
    await expect(main.dialog()).toHaveCount(0);

    await main.page.keyboard.press("Meta+Backspace");
    await expect(main.dialog()).toBeVisible();
    await main.cancelTrash();
    expect(await main.calls("trash_files")).toEqual([]);
  });

  test.describe("Windows", () => {
    test.use({ userAgent: WINDOWS_USER_AGENT });

    test("Delete だけで確認が出て、Backspace は修飾キーつきでも出ない", async ({ main }) => {
      await main.openAuthorA();
      await main.file("a1.zip").click();
      await main.page.keyboard.press("Control+Backspace");
      await main.page.keyboard.press("Meta+Backspace");
      await expect(main.dialog()).toHaveCount(0);

      await main.page.keyboard.press("Delete");
      await expect(main.dialog()).toBeVisible();
    });
  });

  test("確認すると、選んだ全件を 1 回の呼び出しで移し、一覧から消える", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a1.zip").click();
    await main.file("a3.zip").click({ modifiers: ["Shift"] });
    await main.page.keyboard.press("Delete");
    await expect(main.dialog().locator(".confirm-dialog__line")).toHaveText([
      "a1.zip",
      "a2.zip",
      "a3.zip",
    ]);
    await main.confirmTrash();

    await expect(main.fileNames()).toHaveText(["a4.cbz", "a5.pdf"]);
    await expect(main.dialog()).toHaveCount(0);
    expect(await main.calls("trash_files")).toEqual([
      { paths: ["/m/manga/作者A/a1.zip", "/m/manga/作者A/a2.zip", "/m/manga/作者A/a3.zip"] },
    ]);
    expect(await main.selectedFiles()).toEqual([]);
  });

  test("選択外の項目を右クリックすると、その 1 件だけが対象になる", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a4.cbz").click();
    await main.file("a5.pdf").click({ button: "right" });
    await expect(main.menuItem("ゴミ箱")).toHaveText("ゴミ箱に移動");
    expect(await main.selectedFiles()).toEqual(["a5.pdf"]);
    await main.menuItem("ゴミ箱").click();
    await main.confirmTrash();
    await expect(main.file("a5.pdf")).toHaveCount(0);
    expect(await main.calls("trash_files")).toEqual([{ paths: ["/m/manga/作者A/a5.pdf"] }]);
  });

  test("確認を閉じたあとも、クリックし直さずにキー操作が続けられる", async ({ main }) => {
    await main.openAuthorA();
    // キーボードから出した確認を Esc で閉じる
    await main.file("a1.zip").click();
    await main.page.keyboard.press("Delete");
    await expect(main.dialog()).toBeVisible();
    await main.page.keyboard.press("Escape");
    await main.page.keyboard.press("ArrowDown");
    expect(await main.selectedFiles()).toEqual(["a2.zip"]);

    // メニューから出した確認をキャンセルする。↓ は右クリックした項目から動く
    await main.file("a4.cbz").click({ button: "right" });
    await main.menuItem("ゴミ箱").click();
    await main.cancelTrash();
    await main.page.keyboard.press("ArrowDown");
    expect(await main.selectedFiles()).toEqual(["a5.pdf"]);
    await main.page.keyboard.press("Delete");
    await expect(main.dialog()).toBeVisible();
  });

  test("別のウィンドウで消えたファイルは選択から外れ、残りだけを移す", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a1.zip").click();
    await main.file("a2.zip").click({ modifiers: ["Meta"] });
    await main.trashedElsewhere("/m/manga/作者A", "a2.zip");
    await expect(main.file("a2.zip")).toHaveCount(0);
    expect(await main.selectedFiles()).toEqual(["a1.zip"]);

    await main.file("a1.zip").focus();
    await main.page.keyboard.press("Delete");
    await expect(main.dialog().locator(".confirm-dialog__line")).toHaveText(["a1.zip"]);
    await main.confirmTrash();
    await expect(main.file("a1.zip")).toHaveCount(0);
  });

  test("ドラッグで移したファイルは選択から外れる", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a2.zip").click();
    await main.file("a3.zip").click({ modifiers: ["Meta"] });
    await main.file("a2.zip").dragTo(main.treeNode("作者B"));
    await expect(main.file("a2.zip")).toHaveCount(0);
    await main.file("a4.cbz").click({ modifiers: ["Meta"] });
    await main.page.keyboard.press("Delete");
    await expect(main.dialog().locator(".confirm-dialog__line")).toHaveText(["a4.cbz"]);
  });

  test("検索結果から移したファイルは、検索結果からも消える", async ({ main }) => {
    await main.favorite("manga").click();
    await main.searchBox().fill("a1");
    // 作者A と 連載中 に同じ名前の a1.zip がある
    const results = main.page.locator('.file-list__item[data-path$="/a1.zip"]');
    await expect(results).toHaveCount(2);
    await results.nth(0).click();
    await results.nth(1).click({ modifiers: ["Meta"] });
    await main.page.keyboard.press("Delete");
    await expect(main.dialog().locator(".confirm-dialog__line")).toHaveCount(2);
    await main.confirmTrash();
    await expect(results).toHaveCount(0);
    expect((await main.calls("trash_files"))[0].paths).toHaveLength(2);
  });
});

test.describe("ゴミ箱への移動に失敗したとき", () => {
  test.use({ mockOptions: { fail: { trash_files: "Operation not permitted" } } });

  test("理由を表示し、ファイルは残る", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a1.zip").click();
    await main.page.keyboard.press("Delete");
    await main.confirmTrash();
    await expect(main.alerts()).toContainText(
      "ゴミ箱に移動できませんでした: Operation not permitted",
    );
    await expect(main.file("a1.zip")).toBeVisible();
  });
});
