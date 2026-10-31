import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import "@/styles.css";
import { APPEARANCE_BOOT_SCRIPT } from "@/lib/theme";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "@/routeTree.gen";
import { getSql } from "@/lib/db";

// Tiny Buffer stand-in for the two report exports that used Node's Buffer.
const g = globalThis as any;
if (!g.Buffer) {
  g.Buffer = {
    from(input: Uint8Array | string, enc?: string) {
      const bytes = typeof input === "string"
        ? (enc === "base64" ? Uint8Array.from(atob(input), (c) => c.charCodeAt(0)) : new TextEncoder().encode(input))
        : input;
      return {
        toString(out?: string) {
          if (out === "base64") {
            let s = "";
            for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            return btoa(s);
          }
          return new TextDecoder().decode(bytes);
        },
      };
    },
  };
}

try { new Function(APPEARANCE_BOOT_SCRIPT)(); } catch { /* look defaults */ }

const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultErrorComponent: AppErrorComponent,
});

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}

const root = createRoot(document.getElementById("root")!);

function start() {
  void getSql(); // open the on-device database early
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

function OtherTab() {
  const es = (document.documentElement.lang || "es").startsWith("es");
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", fontFamily: "Figtree, system-ui, sans-serif" }}>
      <div>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 32, margin: 0 }}>Brizna</h1>
        <p style={{ marginTop: 12 }}>{es ? "Brizna ya está abierta en otra pestaña o ventana. Ciérrala y toca Reintentar." : "Brizna is already open in another tab or window. Close it and tap Retry."}</p>
        <button type="button" onClick={() => location.reload()} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 12, border: 0, background: "#1f6a3a", color: "#fff", fontSize: 16 }}>
          {es ? "Reintentar" : "Retry"}
        </button>
      </div>
    </main>
  );
}

// One tab at a time owns the on-device database (two would overwrite each other).
if (navigator.locks?.request) {
  void navigator.locks.request("brizna-db", { ifAvailable: true }, (lock) => {
    if (!lock) { root.render(<OtherTab />); return; }
    start();
    return new Promise<void>(() => undefined); // hold until the tab closes
  });
} else {
  start();
}

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  window.addEventListener("load", () => { void navigator.serviceWorker.register("./sw.js"); });
}
if (navigator.storage?.persist) void navigator.storage.persist().catch(() => undefined);
