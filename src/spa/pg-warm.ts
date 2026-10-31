// Start loading and compiling the on-device database engine as soon as Brizna opens
// (while the sign-in or fingerprint screen is up), so the data is ready sooner after it.
import pgliteWasmUrl from "../../node_modules/@electric-sql/pglite/dist/pglite.wasm?url";
import initdbWasmUrl from "../../node_modules/@electric-sql/pglite/dist/initdb.wasm?url";
import fsBundleUrl from "../../node_modules/@electric-sql/pglite/dist/pglite.data?url";

export type WarmParts = { pgliteWasmModule: WebAssembly.Module; initdbWasmModule: WebAssembly.Module; fsBundle: Blob };
let warm: Promise<WarmParts | null> | null = null;

function compile(url: string): Promise<WebAssembly.Module> {
  if (typeof WebAssembly.compileStreaming === "function") {
    return WebAssembly.compileStreaming(fetch(url, { credentials: "same-origin" })).catch(async () =>
      WebAssembly.compile(await (await fetch(url)).arrayBuffer()),
    );
  }
  return fetch(url).then((r) => r.arrayBuffer()).then((b) => WebAssembly.compile(b));
}

export function warmPglite(): Promise<WarmParts | null> {
  warm ??= Promise.all([
    compile(pgliteWasmUrl),
    compile(initdbWasmUrl),
    fetch(fsBundleUrl).then((r) => {
      if (!r.ok) throw new Error(`fs bundle ${r.status}`);
      return r.blob();
    }),
  ])
    .then(([pgliteWasmModule, initdbWasmModule, fsBundle]) => ({ pgliteWasmModule, initdbWasmModule, fsBundle }))
    .catch(() => null); // PGlite falls back to loading them itself
  return warm;
}
