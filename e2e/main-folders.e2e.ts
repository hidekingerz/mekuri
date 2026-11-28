import { expect, test } from "./helpers";

test.describe("フォルダをゴミ箱へ", () => {
  test("確認に一覧に出るファイルの数を出し、キャンセルすれば消えない", async ({ main }) => {
    await main.favorite("manga").click();
    await main.askToTrashFolder("作者A");
    // 作者A 5 件 + 完結 1 件 + シリーズX 3 件 + 連載中 2 件。メモ.txt と .DS_Store は数えない
    await expect(main.dialog()).toContainText(
      "中のファイル 11 件（サブフォルダを含む）も一緒に移動します",
    );
    await expect(main.dialog().getByRole("button", { name: "キャンセル" })).toBeFocused();
    expect(await main.calls("trash_folder")).toEqual([]);

    await main.page.keyboard.press("Enter");
    await expect(main.dialog()).toHaveCount(0);
    expect(await main.calls("trash_folder")).toEqual([]);
    await expect(main.treeNode("作者A")).toBeVisible();

    // キャンセルのあと、そのままツリーの ↑↓ が効く
    await main.page.keyboard.press("ArrowDown");
    await expect(main.treeNode("作者B")).toBeFocused();
  });

  test("確認するとツリーから消える。空のフォルダはその旨を出す", async ({ main }) => {
    await main.favorite("manga").click();
    await main.askToTrashFolder("空フォルダ");
    await expect(main.dialog()).toContainText("フォルダの中にアーカイブや PDF はありません");
    await main.confirmTrash();
    await expect(main.treeNode("空フォルダ")).toHaveCount(0);
    expect(await main.calls("trash_folder")).toEqual([{ path: "/m/manga/空フォルダ" }]);
  });

  test("ツリーにはゴミ箱のショートカットが無く、↑↓ で項目を移動できる", async ({ main }) => {
    await main.favorite("manga").click();
    await main.treeNode("作者A").click();
    await main.treeNode("作者A").focus();
    await main.page.keyboard.press("Delete");
    await main.page.keyboard.press("Meta+Backspace");
    await expect(main.dialog()).toHaveCount(0);
    expect(await main.calls("count_files")).toEqual([]);

    await main.page.keyboard.press("ArrowDown");
    await expect(main.treeNode("作者B")).toBeFocused();
    await main.page.keyboard.press("ArrowUp");
    await expect(main.treeNode("作者A")).toBeFocused();
  });

  test("お気に入りの一覧のメニューにはゴミ箱が無い", async ({ main }) => {
    await main.favorite("manga").click({ button: "right" });
    await expect(main.page.locator(".context-menu__item")).toHaveText(["お気に入りから削除"]);
  });

  for (const [selected, expected] of [
    ["シリーズX", []],
    ["完結", []],
    ["作者A", []],
    ["作者B", ["作者B"]],
  ] as const) {
    test(`作者A を消す。${selected} を選んでいた場合`, async ({ main }) => {
      await main.favorite("manga").click();
      await main.treeNode("作者A").dblclick();
      await main.treeNode("完結").dblclick();
      await main.treeNode(selected).click();
      await main.askToTrashFolder("作者A");
      await main.confirmTrash();
      await expect(main.treeNode("作者A")).toHaveCount(0);
      // 作者A の親はお気に入りの直下で、ツリーに項目が無い。その場合は選択なしになる
      await expect(main.selectedTreeNodes()).toHaveText([...expected]);
    });
  }

  test("消したフォルダの中を選んでいたら、親のフォルダを選んで中身を出す", async ({ main }) => {
    await main.favorite("manga").click();
    await main.treeNode("作者A").dblclick();
    await main.treeNode("完結").dblclick();
    await main.treeNode("シリーズX").click();
    await main.askToTrashFolder("完結");
    await main.confirmTrash();
    await expect(main.selectedTreeNodes()).toHaveText(["作者A"]);
    await expect(main.file("a1.zip")).toBeVisible();
  });
});

test.describe("お気に入りに登録したフォルダをツリーから消す", () => {
  test.use({
    mockOptions: {
      favorites: ["/m/manga", "/m/mag", "/m/manga/作者B", "/m/manga/作者A/完結"],
    },
  });

  test("登録も外すことを確認に出し、キャンセルすれば残る", async ({ main }) => {
    await main.favorite("manga").first().click();
    await main.askToTrashFolder("作者B");
    await expect(main.dialog()).toContainText("お気に入り 1 件の登録も外します");
    await main.cancelTrash();
    expect(await main.favorites()).toContain("/m/manga/作者B");
    expect(await main.calls("trash_folder")).toEqual([]);
  });

  test("消すと登録が外れ、サイドバーからも消える", async ({ main }) => {
    await main.favorite("manga").first().click();
    await main.askToTrashFolder("作者B");
    await main.confirmTrash();
    await expect(main.page.locator(".favorites-sidebar__name")).toHaveText([
      "manga",
      "mag",
      "完結",
    ]);
    expect(await main.favorites()).toEqual(["/m/manga", "/m/mag", "/m/manga/作者A/完結"]);
  });

  test("お気に入りを中に含むフォルダを消すと、中のお気に入りの登録も外れる", async ({ main }) => {
    await main.favorite("manga").first().click();
    await main.askToTrashFolder("作者A");
    await expect(main.dialog()).toContainText("お気に入り 1 件の登録も外します");
    await main.confirmTrash();
    await expect(main.page.locator(".favorites-sidebar__name")).toHaveText([
      "manga",
      "mag",
      "作者B",
    ]);
  });
});
