import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

/**
 * 画面の確認（e2e）。ビルド済みの画面を vite preview で配信し、Tauri の IPC を
 * e2e/tauri-mock.js に差し替えて、メインウィンドウとビューワーを操作する。
 * 実機（WKWebView）や本物のファイル操作は対象外。
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "e2e/.output/results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1200, height: 760 },
        // OS で変わる操作（ゴミ箱のショートカット）は、主な対象の macOS として確かめる。
        // Windows での動作を見るテストは、test.use({ userAgent }) で切り替える
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)",
      },
    },
  ],
  webServer: {
    // 開発サーバーだとファイルの変更でページが読み直されるので、ビルドしたものを配信する
    command: `pnpm build && pnpm exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
