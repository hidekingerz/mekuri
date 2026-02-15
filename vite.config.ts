import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

/**
 * Vite plugin to serve pdfjs-dist static assets (CMaps, standard fonts).
 * - Dev: serves files from node_modules via middleware
 * - Build: emits files into the output directory
 */
function pdfjsStaticPlugin(): Plugin {
  const nodeModulesPath = resolve(__dirname, "node_modules/pdfjs-dist");
  const dirs = [
    { src: "cmaps", dest: "pdfjs/cmaps" },
    { src: "standard_fonts", dest: "pdfjs/standard_fonts" },
  ];

  return {
    name: "pdfjs-static",
    configureServer(server) {
      for (const { src, dest } of dirs) {
        const srcPath = join(nodeModulesPath, src);
        server.middlewares.use(`/${dest}`, (req, res, next) => {
          const filePath = join(srcPath, req.url?.replace(/^\//, "") || "");
          try {
            const data = readFileSync(filePath);
            res.end(data);
          } catch {
            next();
          }
        });
      }
    },
    generateBundle() {
      for (const { src, dest } of dirs) {
        const srcPath = join(nodeModulesPath, src);
        for (const file of readdirSync(srcPath)) {
          try {
            const data = readFileSync(join(srcPath, file));
            this.emitFile({
              type: "asset",
              fileName: `${dest}/${file}`,
              source: data,
            });
          } catch {
            // skip subdirectories
          }
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), pdfjsStaticPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        viewer: resolve(__dirname, "viewer.html"),
      },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
