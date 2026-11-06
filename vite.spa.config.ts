import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { APPEARANCE_BOOT_SCRIPT } from "./src/lib/theme";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Static Brizna for GitHub Pages: no server. Server functions run on the device
// against PGlite (IndexedDB). Sign-in and Supabase sync come later.
export default defineConfig({
  root: "spa",
  base: "./",
  publicDir: r("./spa-public"),
  define: {
    "process.env.XAI_API_KEY": "undefined",
  },
  resolve: {
    alias: [
      { find: /^@tanstack\/react-start$/, replacement: r("./src/spa/start-shim.ts") },
      { find: /^@\/lib\/db$/, replacement: r("./src/spa/db.ts") },
      { find: /^@\/lib\/auth\/client$/, replacement: r("./src/spa/auth/client.ts") },
      { find: /^@\/lib\/auth\/use-current-user$/, replacement: r("./src/spa/auth/use-current-user.ts") },
      { find: /^@\/lib\/auth\/gates$/, replacement: r("./src/spa/auth/gates.tsx") },
      { find: /^@\/lib\/auth\/middleware$/, replacement: r("./src/spa/middleware-shim.ts") },
      { find: "@", replacement: r("./src") },
    ],
  },
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  worker: { format: "es" },
  plugins: [
    {
      name: "brizna-spa-routes",
      enforce: "pre",
      resolveId(id, importer) {
        if (!importer || !importer.endsWith("routeTree.gen.ts")) return null;
        if (id === "./routes/__root") return r("./src/spa/root.tsx");
        if (id === "./routes/api/auth/$") return r("./src/spa/api-stub.ts");
        return null;
      },
    },
    {
      // 1.4.98: the look (theme classes + status bar colour) is set inline in <head>, before the launch splash paints.
      name: "brizna-boot-look",
      transformIndexHtml(html) {
        return html.replace("<!--BZ_BOOT_LOOK-->", `<script>${APPEARANCE_BOOT_SCRIPT}</script>`);
      },
    },
    {
      // 1.4.98: the app stylesheet loads just before #root, so the launch splash (inline, above it) paints at once
      // instead of waiting for the whole stylesheet; the app itself still never paints unstyled.
      name: "brizna-css-after-splash",
      transformIndexHtml: {
        order: "post",
        handler(html) {
          const m = html.match(/\s*<link rel="stylesheet" crossorigin href="\.\/index-[^"]+\.css">/);
          if (!m || !html.includes('<div id="root"></div>')) return html;
          return html.replace(m[0], "").replace('<div id="root"></div>', `${m[0].trim()}\n    <div id="root"></div>`);
        },
      },
    },
    tailwindcss(),
    viteReact(),
  ],
  build: { outDir: "../dist", emptyOutDir: true, assetsDir: "", chunkSizeWarningLimit: 8000, target: "es2022" },
});
