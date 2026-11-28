import { expect, test } from "./helpers";

test.describe("Finder からのドロップ", () => {
  test.beforeEach(async ({ main }) => {
    await main.favorite("manga").click();
    await main.addFolder("/ext", ["new1.zip", "new2.zip", "new3.zip", "a1.zip", "フォルダ/"]);
    await main.addFolder("/ext/フォルダ", []);
  });

  test("ツリーのフォルダ・お気に入り・ファイル一覧へ落とすと、そこへ移動する", async ({ main }) => {
    await main.finderDrop(main.treeNode("作者B"), ["/ext/new1.zip"]);
    await expect.poll(() => main.folderContents("/m/manga/作者B")).toContain("new1.zip");

    await main.finderDrop(main.favorite("mag"), ["/ext/new2.zip"]);
    await expect.poll(() => main.folderContents("/m/mag")).toContain("new2.zip");

    await main.treeNode("作者A").click();
    await expect(main.file("a1.zip")).toBeVisible();
    await main.finderDrop(main.page.locator(".file-list"), ["/ext/new3.zip"]);
    await expect(main.file("new3.zip")).toBeVisible();
    expect(await main.folderContents("/m/manga/作者A")).toContain("new3.zip");
  });

  test("同名のファイルがあるときは移動せず、エラーを出す", async ({ main }) => {
    await main.treeNode("作者A").click();
    await expect(main.file("a1.zip")).toBeVisible();
    await main.finderDrop(main.page.locator(".file-list"), ["/ext/a1.zip"]);
    await expect(main.alerts()).toContainText("移動できませんでした");
    expect(await main.folderContents("/ext")).toContain("a1.zip");
  });

  test("フォルダを落としたときは移動せず、エラーを出す", async ({ main }) => {
    await main.finderDrop(main.treeNode("作者B"), ["/ext/フォルダ"]);
    await expect(main.alerts()).toContainText("移動できませんでした");
    expect(await main.folderContents("/ext/フォルダ")).toEqual([]);
  });

  test("ペーストボードの中身が落としたファイルと違うときは、何も移動しない", async ({ main }) => {
    await main.finderDrop(main.treeNode("作者B"), ["/ext/new1.zip"], { names: ["別の名前.zip"] });
    await main.page.waitForTimeout(200);
    expect(await main.calls("move_file")).toEqual([]);
  });
});

test.describe("アプリ内のドラッグ", () => {
  test("1 件をツリーのフォルダへ、複数選択をお気に入りへ移動できる", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a5.pdf").dragTo(main.treeNode("作者B"));
    await expect(main.file("a5.pdf")).toHaveCount(0);
    expect(await main.folderContents("/m/manga/作者B")).toContain("a5.pdf");

    await main.file("a2.zip").click();
    await main.file("a3.zip").click({ modifiers: ["Meta"] });
    await main.file("a2.zip").dragTo(main.favorite("mag"));
    await expect(main.file("a3.zip")).toHaveCount(0);
    expect(await main.folderContents("/m/mag")).toEqual(
      expect.arrayContaining(["a2.zip", "a3.zip"]),
    );
  });

  test("一部が同名で失敗しても、ほかは移動し、失敗はエラーに出る", async ({ main }) => {
    await main.openAuthorA();
    await main.treeNode("作者A").dblclick();
    // 連載中 には a1.zip がすでにある
    await main.file("a1.zip").click();
    await main.file("a4.cbz").click({ modifiers: ["Meta"] });
    await main.file("a1.zip").dragTo(main.treeNode("連載中"));
    await expect(main.alerts()).toContainText("移動できませんでした");
    await expect(main.file("a4.cbz")).toHaveCount(0);
    await expect(main.file("a1.zip")).toBeVisible();
  });
});

test.describe("検索中のフォルダの行へのドロップ", () => {
  test.beforeEach(async ({ main }) => {
    await main.favorite("manga").click();
    await main.addFolder("/ext", ["new1.zip", "new2.zip", "new3.zip"]);
  });

  test("Finder から、真ん中の列の行と右の列のフォルダの行へ落とせる", async ({ main }) => {
    await main.searchBox().fill("作者B");
    await expect(main.matchedFolder("作者B")).toBeVisible();

    await main.finderDrop(main.matchedFolder("作者B"), ["/ext/new1.zip"], { events: ["dragover"] });
    await expect(main.matchedFolder("作者B")).toHaveClass(/tree-node--drop-target/);
    await main.finderDrop(main.matchedFolder("作者B"), ["/ext/new1.zip"]);
    await expect.poll(() => main.folderContents("/m/manga/作者B")).toContain("new1.zip");
    await expect(main.matchedFolder("作者B")).not.toHaveClass(/tree-node--drop-target/);

    await main.finderDrop(main.resultFolder("作者B"), ["/ext/new2.zip"], { events: ["dragover"] });
    await expect(main.resultFolder("作者B")).toHaveClass(/file-list__item--drop-target/);
    await main.finderDrop(main.resultFolder("作者B"), ["/ext/new2.zip"]);
    await expect.poll(() => main.folderContents("/m/manga/作者B")).toContain("new2.zip");
  });

  test("検索結果の余白では受け付けない", async ({ main }) => {
    await main.searchBox().fill("作者B");
    await expect(main.matchedFolder("作者B")).toBeVisible();
    await main.finderDrop(main.page.locator(".file-list__items"), ["/ext/new3.zip"]);
    await main.page.waitForTimeout(200);
    expect(await main.calls("move_file")).toEqual([]);
  });

  test("検索結果のファイルをフォルダの行へドラッグでき、結果が新しい場所で出る", async ({
    main,
  }) => {
    await main.searchBox().fill("b");
    await expect(main.fileAt("/m/manga/作者A/a4.cbz")).toBeVisible();
    await main.fileAt("/m/manga/作者A/a4.cbz").dragTo(main.matchedFolder("作者B"));
    await expect(main.fileAt("/m/manga/作者B/a4.cbz")).toBeVisible();
    await expect(main.fileAt("/m/manga/作者A/a4.cbz")).toHaveCount(0);
  });

  test("検索を抜けたあとに遅れて届いた応答で、検索結果へ戻らない", async ({ main }) => {
    await main.searchBox().fill("作者B");
    await expect(main.matchedFolder("作者B")).toBeVisible();
    await main.matchedFolder("作者B").click();
    await expect(main.file("b1.zip")).toBeVisible();
    // 別のウィンドウの変更で取り直しが走っても、検索の表示には戻らない
    await main.trashedElsewhere("/m/manga/作者B", "b2.zip");
    await expect(main.file("b2.zip")).toHaveCount(0);
    await expect(main.page.locator(".file-list__header-title")).toContainText("ファイル");
    await expect(main.searchBox()).toHaveValue("");
  });
});
