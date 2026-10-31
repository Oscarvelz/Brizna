// Browser stand-in for @tanstack/react-start: Brizna's "server functions" run on the
// device against the local database. Same call shape: fn({ data }).
import { markDirty } from "./sync";

type Handler = (args: { data: any; context: { userId: string } }) => any;

export const LOCAL_USER_ID = "dev-user";

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
        try { out = await fn({ data, context: { userId: LOCAL_USER_ID } }); }
        catch (e) { trace?.push(["err", String(fn).slice(0, 60), String(e)]); throw e; }
        trace?.push(["end", String(fn).slice(0, 60), Date.now() - t0]);
        if (method === "POST") markDirty();
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
