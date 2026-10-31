// Browser stand-in for @tanstack/react-start: Brizna's "server functions" run on the
// device against the local database. Same call shape: fn({ data }).
import { markDirty } from "./sync";
import { flushDb } from "./db";

type Handler = (args: { data: any; context: { userId: string } }) => any;

export const LOCAL_USER_ID = "dev-user";

// Write counter: lets reads skip work (like topping up the schedule) when nothing changed.
const G = globalThis as any;
G.__bzWriteEpoch ??= 0;
G.__bzInPost ??= 0;

function chain(method: string) {
  let validate: ((d: unknown) => unknown) | null = null;
  const api: any = {
    middleware: () => api,
    validator: (v: (d: unknown) => unknown) => { validate = v; return api; },
    inputValidator: (v: (d: unknown) => unknown) => { validate = v; return api; },
    handler: (fn: Handler) => {
      const call = async (opts?: { data?: unknown }) => {
        const raw = opts?.data;
        const data = validate ? validate(raw) : raw;
        const trace = (globalThis as any).__bzTrace as unknown[] | undefined;
        const t0 = Date.now();
        trace?.push(["start", fn.name || String(fn).slice(0, 60), t0]);
        let out;
        if (method === "POST") { G.__bzWriteEpoch += 1; G.__bzInPost += 1; }
        try { out = await fn({ data, context: { userId: LOCAL_USER_ID } }); }
        catch (e) { trace?.push(["err", String(fn).slice(0, 60), String(e)]); throw e; }
        finally { if (method === "POST") { G.__bzInPost -= 1; G.__bzWriteEpoch += 1; } }
        trace?.push(["end", String(fn).slice(0, 60), Date.now() - t0]);
        if (method === "POST") { await flushDb(); markDirty(); }
        // Server functions returned JSON; keep the same shapes (Dates -> strings).
        return out === undefined ? undefined : JSON.parse(JSON.stringify(out));
      };
      return call;
    },
  };
  return api;
}

export function createServerFn(opts?: { method?: string }) { return chain(String(opts?.method ?? "GET").toUpperCase()); }
export function createMiddleware(_opts?: unknown) {
  const m: any = { client: () => m, server: () => m, middleware: () => m };
  return m;
}
export function useServerFn<T>(fn: T): T { return fn; }
export function createIsomorphicFn() { const f: any = { client: (fn: any) => fn, server: () => f }; return f; }
