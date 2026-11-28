import { expect, LANDSCAPE, PORTRAIT, pagesOf, test, VIEWER_FILE } from "./helpers";

const P = PORTRAIT;
const W = LANDSCAPE;

test.describe("見開き表示（既定は右綴じ）", () => {
  test("表紙は 1 ページ、以降は 2 ページずつで、若いページが右に出る", async ({ viewer }) => {
    // 10 ページ → 表紙 + 4 組 + 最後の 1 ページ
    await expect(viewer.position()).toHaveText("1 / 6");
    await expect(viewer.button("見開き表示")).toHaveAttribute("aria-pressed", "true");
    expect(await viewer.settledPages()).toEqual([1]);
    await expect(viewer.directionButton()).toHaveAttribute("aria-label", /^読み方向: 右から左/);

    await viewer.page.keyboard.press("Space");
    await expect(viewer.position()).toHaveText("2 / 6");
    expect(await viewer.settledPages()).toEqual([3, 2]);
  });

  test("タイトルとプログレスバーが、いまの位置を示す", async ({ viewer }) => {
    await expect.poll(() => viewer.title()).toBe("a1.zip [1/6] - mekuri");
    await viewer.page.keyboard.press("Space");
    await expect.poll(() => viewer.title()).toBe("a1.zip [2/6] - mekuri");
    await expect(viewer.progress()).toHaveAttribute("aria-valuenow", "2");
    await expect(viewer.progress()).toHaveAttribute("aria-valuemax", "6");
  });

  for (const [count, expected] of [
    [1, [[1]]],
    [2, [[1], [2]]],
    [3, [[1], [3, 2]]],
  ] as const) {
    test.describe(`${count} ページのアーカイブ`, () => {
      test.use({
        mockOptions: {
          archives: { [VIEWER_FILE]: pagesOf(Array.from({ length: count }, () => P)) },
        },
      });

      test("組み方と、端で止まること", async ({ viewer }) => {
        const seen: number[][] = [];
        for (let i = 0; i < expected.length; i++) {
          seen.push(await viewer.settledPages());
          await viewer.page.keyboard.press("Space");
        }
        expect(seen).toEqual(expected);
        await expect(viewer.position()).toHaveText(`${expected.length} / ${expected.length}`);
        await expect(viewer.button("次の見開き")).toBeDisabled();
      });
    });
  }
});

test.describe("キーボードでのページ送り", () => {
  test("Space・Home・End と、右綴じの ← →。端より先へは進まない", async ({ viewer }) => {
    await expect(viewer.button("前の見開き")).toBeDisabled();
    await viewer.page.keyboard.press("ArrowRight"); // 右綴じでは → が「前」
    await expect(viewer.position()).toHaveText("1 / 6");

    await viewer.page.keyboard.press("Space");
    await expect(viewer.position()).toHaveText("2 / 6");
    await viewer.page.keyboard.press("ArrowLeft");
    await expect(viewer.position()).toHaveText("3 / 6");
    await viewer.page.keyboard.press("ArrowRight");
    await expect(viewer.position()).toHaveText("2 / 6");

    await viewer.page.keyboard.press("End");
    await expect(viewer.position()).toHaveText("6 / 6");
    await expect(viewer.button("次の見開き")).toBeDisabled();
    await viewer.page.keyboard.press("Space");
    await viewer.page.keyboard.press("ArrowLeft");
    await expect(viewer.position()).toHaveText("6 / 6");

    await viewer.page.keyboard.press("Home");
    await expect(viewer.position()).toHaveText("1 / 6");
  });

  test("左綴じに切り替えると ← → の向きが逆になり、Space・Home・End は変わらない", async ({
    viewer,
  }) => {
    await viewer.page.keyboard.press("Space");
    await viewer.directionButton().click();
    await expect(viewer.directionButton()).toHaveAttribute("aria-label", /^読み方向: 左から右/);
    await expect(viewer.position()).toHaveText("2 / 6");
    expect(await viewer.settledPages()).toEqual([2, 3]);

    await viewer.page.keyboard.press("ArrowRight");
    await expect(viewer.position()).toHaveText("3 / 6");
    await viewer.page.keyboard.press("ArrowLeft");
    await expect(viewer.position()).toHaveText("2 / 6");
    await viewer.page.keyboard.press("Space");
    await expect(viewer.position()).toHaveText("3 / 6");
    await viewer.page.keyboard.press("End");
    await expect(viewer.position()).toHaveText("6 / 6");
    await viewer.page.keyboard.press("Home");
    await expect(viewer.position()).toHaveText("1 / 6");
    expect((await viewer.savedSettings())?.readingDirection).toBe("ltr");
  });

  test("修飾キーを押しながらでは、ページを送らない", async ({ viewer }) => {
    await viewer.page.keyboard.press("Space");
    await expect(viewer.position()).toHaveText("2 / 6");
    for (const combo of [
      "Shift+Space",
      "Alt+Space",
      "Shift+ArrowLeft",
      "Alt+ArrowLeft",
      "Control+ArrowLeft",
      "Meta+ArrowLeft",
      "Shift+ArrowRight",
      "Meta+ArrowRight",
      "Shift+End",
      "Meta+Home",
    ]) {
      await viewer.page.keyboard.press(combo);
      await expect(viewer.position(), combo).toHaveText("2 / 6");
    }
  });

  test("フッターのボタンにフォーカスがあっても、Space はページ送りになる", async ({ viewer }) => {
    await viewer.button("単ページ表示").focus();
    await viewer.page.keyboard.press("Space");
    await expect(viewer.position()).toHaveText("2 / 6");
    await expect(viewer.button("単ページ表示")).toHaveAttribute("aria-pressed", "false");
  });

  test("ゴミ箱の確認が開いているあいだは裏のページが動かず、Space でボタンを押せる", async ({
    viewer,
  }) => {
    await viewer.page.keyboard.press("Space");
    await viewer.page.keyboard.press("Delete");
    await expect(viewer.dialog()).toBeVisible();
    await viewer.page.keyboard.press("ArrowLeft");
    await viewer.page.keyboard.press("End");
    await viewer.wheelBurst(1, 0);
    await expect(viewer.position()).toHaveText("2 / 6");

    // フォーカスはキャンセルにある
    await viewer.page.keyboard.press("Space");
    await expect(viewer.dialog()).toHaveCount(0);
    await expect(viewer.position()).toHaveText("2 / 6");
  });
});

test.describe("クリックとホイールでのページ送り", () => {
  test("右綴じでは左半分が次、左綴じでは右半分が次", async ({ viewer }) => {
    await viewer.clickHalf("left");
    await expect(viewer.position()).toHaveText("2 / 6");
    await viewer.clickHalf("right");
    await expect(viewer.position()).toHaveText("1 / 6");

    await viewer.directionButton().click();
    await viewer.clickHalf("right");
    await expect(viewer.position()).toHaveText("2 / 6");
    await viewer.clickHalf("left");
    await expect(viewer.position()).toHaveText("1 / 6");
  });

  test("ホイールで前後に送れる", async ({ viewer }) => {
    await viewer.page.mouse.move(600, 300);
    await viewer.page.mouse.wheel(0, 120);
    await expect(viewer.position()).toHaveText("2 / 6");
    await viewer.page.waitForTimeout(250);
    await viewer.page.mouse.wheel(0, -120);
    await expect(viewer.position()).toHaveText("1 / 6");
  });

  test("修飾キーを押しながらのホイール（ピンチなど）や、横だけのホイールでは送らない", async ({
    viewer,
  }) => {
    await viewer.page.evaluate(() => {
      for (const init of [
        { ctrlKey: true },
        { metaKey: true },
        { shiftKey: true },
        { altKey: true },
      ]) {
        window.dispatchEvent(
          new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true, ...init }),
        );
      }
      window.dispatchEvent(
        new WheelEvent("wheel", { deltaX: 120, deltaY: 0, bubbles: true, cancelable: true }),
      );
    });
    await viewer.page.waitForTimeout(100);
    await expect(viewer.position()).toHaveText("1 / 6");
    // 横だけのホイールは、次の縦のホイールを止めない
    await viewer.wheelBurst(1, 0);
    await expect(viewer.position()).toHaveText("2 / 6");
  });

  test("200ms のあいだに続けて届いたホイールでは、1 回ぶんだけ進む", async ({ viewer }) => {
    await viewer.wheelBurst(4, 20);
    await viewer.page.waitForTimeout(100);
    await expect(viewer.position()).toHaveText("2 / 6");
    // 間隔が空けば、また進める
    await viewer.page.waitForTimeout(250);
    await viewer.wheelBurst(1, 0);
    await expect(viewer.position()).toHaveText("3 / 6");
  });
});

test.describe("プログレスバー", () => {
  test("右綴じでは右端から伸び、左寄りをクリックするほど後ろへ飛ぶ", async ({ viewer }) => {
    await viewer.page.keyboard.press("Space");
    const fill = viewer.page.locator(".spread-viewer__progress-fill");
    const edges = async () => {
      const bar = await viewer.progress().boundingBox();
      const f = await fill.boundingBox();
      if (!bar || !f) throw new Error("progress bar is not visible");
      return {
        left: Math.round(f.x - bar.x),
        right: Math.round(bar.x + bar.width - f.x - f.width),
      };
    };
    expect((await edges()).right).toBe(0);
    expect((await edges()).left).toBeGreaterThan(0);

    await viewer.clickProgress(0.2); // 右端から 80% → 6 組のうち 5 つ目
    await expect(viewer.position()).toHaveText("5 / 6");
    await viewer.clickProgress(0.999);
    await expect(viewer.position()).toHaveText("1 / 6");

    await viewer.directionButton().click();
    await viewer.clickProgress(0.2);
    await expect(viewer.position()).toHaveText("2 / 6");
    expect((await edges()).left).toBe(0);
  });
});

test.describe("表示モード", () => {
  test("単ページ・3 ページ・ウィンドウ追従に切り替えても、読んでいた位置を保つ", async ({
    viewer,
  }) => {
    for (let i = 0; i < 3; i++) await viewer.page.keyboard.press("Space");
    expect(await viewer.settledPages()).toEqual([7, 6]);

    await viewer.button("単ページ表示").click();
    await expect(viewer.position()).toHaveText("6 / 10");
    expect(await viewer.settledPages()).toEqual([6]);

    await viewer.button("3ページ表示").click();
    await expect(viewer.position()).toHaveText("2 / 4");
    expect(await viewer.settledPages()).toEqual([6, 5, 4]);

    await viewer.button("見開き表示").click();
    expect(await viewer.settledPages()).toEqual([7, 6]);

    await viewer.button("ウィンドウ追従表示").click();
    const narrow = await viewer.settledPages();
    expect(narrow).toContain(6);
    await viewer.page.setViewportSize({ width: 2200, height: 760 });
    await expect
      .poll(async () => (await viewer.shownPages()).length)
      .toBeGreaterThan(narrow.length);
    expect(await viewer.settledPages()).toContain(6);
    expect((await viewer.savedSettings())?.viewMode).toBe("fit");
  });

  test.describe("保存された設定があるとき", () => {
    test.use({
      mockOptions: {
        viewerSettings: { width: 1200, height: 900, viewMode: "single", readingDirection: "ltr" },
      },
    });

    test("保存された表示モードと読み方向で開く", async ({ viewer }) => {
      await expect(viewer.position()).toHaveText("1 / 10");
      await expect(viewer.directionButton()).toHaveAttribute("aria-label", /^読み方向: 左から右/);
    });
  });

  for (const viewport of [
    { width: 1400, height: 700 },
    { width: 700, height: 1100 },
    { width: 600, height: 400 },
  ]) {
    test(`${viewport.width}x${viewport.height} でも画像が領域に収まり、スクロールが出ない`, async ({
      viewer,
    }) => {
      await viewer.page.setViewportSize(viewport);
      for (const mode of ["見開き表示", "単ページ表示", "3ページ表示"]) {
        await viewer.button(mode).click();
        await viewer.page.keyboard.press("Home");
        await viewer.page.keyboard.press("Space");
        await viewer.settledPages();
        const layout = await viewer.page.evaluate(() => {
          const pages = document.querySelector(".spread-viewer__pages")?.getBoundingClientRect();
          const footer = document.querySelector(".spread-viewer__footer")?.getBoundingClientRect();
          if (!pages || !footer) return null;
          const images = [
            ...document.querySelectorAll<HTMLImageElement>(".spread-viewer__cell img"),
          ];
          return {
            inside: images.every((img) => {
              const b = img.getBoundingClientRect();
              return (
                b.left >= pages.left - 0.5 &&
                b.right <= pages.right + 0.5 &&
                b.top >= pages.top - 0.5 &&
                b.bottom <= pages.bottom + 0.5 &&
                getComputedStyle(img).objectFit === "contain"
              );
            }),
            count: images.length,
            footerVisible: footer.bottom <= window.innerHeight,
            scrolls:
              document.documentElement.scrollHeight > window.innerHeight ||
              document.documentElement.scrollWidth > window.innerWidth,
          };
        });
        expect(layout, mode).toMatchObject({ inside: true, footerVisible: true, scrolls: false });
        expect(layout?.count, mode).toBeGreaterThan(0);
      }
    });
  }
});

test.describe("横長のページ", () => {
  test.describe("4 ページ目と 9 ページ目が横長", () => {
    test.use({
      mockOptions: {
        archives: { [VIEWER_FILE]: pagesOf([P, P, P, W, P, P, P, P, W, P]) },
      },
    });

    /** 最初から「次へ」で最後まで送り、出た組を順に返す。 */
    async function readForward(viewer: import("./helpers").ViewerWindow) {
      const seen: number[][] = [];
      for (let i = 0; i < 12; i++) {
        seen.push(await viewer.settledPages());
        if (await viewer.button("次の見開き").isDisabled()) break;
        await viewer.page.keyboard.press("Space");
      }
      return seen;
    }

    test("見開き: 横長のページは単独で出て、前後は 2 ページずつに戻る", async ({ viewer }) => {
      expect(await readForward(viewer)).toEqual([[1], [3, 2], [4], [6, 5], [8, 7], [9], [10]]);
    });

    for (const mode of ["3ページ表示", "ウィンドウ追従表示"]) {
      test(`${mode}: 横長のページは単独で出て、全ページを 1 回ずつ見られる`, async ({ viewer }) => {
        await viewer.page.setViewportSize({ width: 1600, height: 900 });
        await viewer.button(mode).click();
        const seen = await readForward(viewer);
        expect(seen.filter((group) => group.includes(4) || group.includes(9))).toEqual([[4], [9]]);
        expect(seen.flat().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      });
    }

    test("最後から前へ戻るときも、横長のページを飛ばさない", async ({ viewer }) => {
      await viewer.page.keyboard.press("End");
      const seen = [await viewer.settledPages()];
      for (let i = 0; i < 12; i++) {
        if (await viewer.button("前の見開き").isDisabled()) break;
        await viewer.page.keyboard.press("ArrowRight");
        seen.push(await viewer.settledPages());
      }
      // 手前の横長のページは着くまで分からないので、組み合わせは前から読むときと変わることがある。
      // どのページも飛ばされず、横長のページは単独で出る
      expect([...new Set(seen.flat())].sort((a, b) => a - b)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      ]);
      expect(seen.filter((group) => group.includes(4) || group.includes(9))).toEqual([[9], [4]]);
      expect(seen[0]).toEqual([10]);
      expect(seen[1]).toEqual([9]);
    });
  });

  test.describe("表紙だけが横長", () => {
    test.use({
      mockOptions: { archives: { [VIEWER_FILE]: pagesOf([W, P, P, P, P, P, P, P, P, P]) } },
    });

    test("ホイールで次へ送っても、縦長のページを横長と取り違えない", async ({ viewer }) => {
      expect(await viewer.settledPages()).toEqual([1]);
      await viewer.page.mouse.move(600, 300);
      await viewer.page.mouse.wheel(0, 120);
      expect(await viewer.settledPages()).toEqual([3, 2]);
      await expect(viewer.position()).toHaveText("2 / 6");
      await viewer.page.keyboard.press("Space");
      expect(await viewer.settledPages()).toEqual([5, 4]);
    });
  });

  test.describe("最後のページが横長（11 ページ）", () => {
    test.use({
      mockOptions: {
        archives: { [VIEWER_FILE]: pagesOf([P, P, P, P, P, P, P, P, P, P, W]) },
      },
    });

    test("End は最後の見開き（横長の 11 ページ目）に着く", async ({ viewer }) => {
      await viewer.page.keyboard.press("End");
      expect(await viewer.settledPages()).toEqual([11]);
      await expect(viewer.position()).toHaveText("7 / 7");
      await expect(viewer.button("次の見開き")).toBeDisabled();
    });

    test("プログレスバーの端のクリックも、最後の見開きに着く", async ({ viewer }) => {
      await viewer.clickProgress(0.001); // 右綴じでは左端が最後
      expect(await viewer.settledPages()).toEqual([11]);
      await expect(viewer.position()).toHaveText("7 / 7");
    });
  });

  test.describe("先頭から 3 枚続けて横長", () => {
    test.use({ mockOptions: { archives: { [VIEWER_FILE]: pagesOf([W, W, W, P, P, P]) } } });

    test("それぞれ単独で出る", async ({ viewer }) => {
      const seen: number[][] = [];
      for (let i = 0; i < 8; i++) {
        seen.push(await viewer.settledPages());
        if (await viewer.button("次の見開き").isDisabled()) break;
        await viewer.page.keyboard.press("Space");
      }
      expect(seen).toEqual([[1], [2], [3], [5, 4], [6]]);
    });
  });

  test.describe("組の 1 枚目だけが横長（8 ページ目）", () => {
    test.use({
      mockOptions: { archives: { [VIEWER_FILE]: pagesOf([P, P, P, P, P, P, P, W, P, P]) } },
    });

    test("最後から前へ戻ると、組み直したあとの順でたどれる", async ({ viewer }) => {
      await viewer.page.keyboard.press("End");
      const seen = [await viewer.settledPages()];
      for (let i = 0; i < 3; i++) {
        await viewer.page.keyboard.press("ArrowRight");
        seen.push(await viewer.settledPages());
      }
      // 8 が横長と分かると、9 と 10 が組になる。10 → [10, 9] → 8 → [7, 6]
      expect(seen).toEqual([[10], [10, 9], [8], [7, 6]]);
    });
  });
});
