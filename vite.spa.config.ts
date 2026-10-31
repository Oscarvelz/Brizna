import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

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
    tailwindcss(),
    viteReact(),
  ],
  build: { outDir: "../dist", emptyOutDir: true, assetsDir: "", chunkSizeWarningLimit: 8000, target: "es2022" },
});
