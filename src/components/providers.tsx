import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { NameJumpHost } from "@/components/name-jump-host";
import { NoteLeaveGuard } from "@/components/note-leave-guard";
import { ThemeBoot } from "@/components/theme-boot";

function makeQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 12_000,
        retry: 4,
        retryDelay: (n) => Math.min(1500, 300 * 2 ** n),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
      },
    },
  });
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    const channel = new BroadcastChannel("ols-live");
    const original = client.invalidateQueries.bind(client);
    let queued: "all" | readonly unknown[] | null = null;
    let timer = 0;
    const flush = () => {
      timer = 0;
      const key = queued;
      queued = null;
      void original(Array.isArray(key) ? { queryKey: key } : undefined);
    };
    const schedule = (next: "all" | readonly unknown[] | null) => {
      if (next === "all" || queued === "all") queued = "all";
      else if (Array.isArray(next)) queued = next;
      if (timer) return;
      timer = window.setTimeout(flush, 30);
    };
    client.invalidateQueries = ((filters, options) => {
      const result = original(filters, options);
      const key =
        filters && typeof filters === "object" && "queryKey" in filters
          ? (filters.queryKey ?? null)
          : null;
      channel.postMessage({ key });
      return result;
    }) as typeof client.invalidateQueries;
    client.getMutationCache().subscribe((event) => {
      if (event.type !== "updated" || event.mutation.state.status !== "success") return;
      channel.postMessage({ all: true });
    });
    channel.onmessage = (event: MessageEvent<{ key?: unknown; all?: boolean }>) => {
      if (event.data?.all) {
        schedule("all");
        return;
      }
      const key = event.data?.key;
      schedule(Array.isArray(key) ? key : "all");
    };
  }
  return client;
}

function LocaleGuards() {
  const { locale } = useI18n();
  useEffect(() => {
    const msg = locale === "en" ? "Please fill out this field." : "Completa este campo.";
    const onInvalid = (event: Event) => {
      const el = event.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
      el.setCustomValidity(msg);
    };
    const clear = (event: Event) => {
      const el = event.target;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        el.setCustomValidity("");
      }
    };
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", clear, true);
    document.addEventListener("change", clear, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", clear, true);
      document.removeEventListener("change", clear, true);
    };
  }, [locale]);

  useEffect(() => {
    let blockUntil = 0;
    let armedByPointer = false;
    const arm = () => {
      blockUntil = Date.now() + 420;
      armedByPointer = false;
    };
    const onPointer = () => {
      if (Date.now() <= blockUntil) armedByPointer = true;
    };
    const onClick = (event: MouseEvent) => {
      if (Date.now() > blockUntil || armedByPointer) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[contenteditable='true'], .note-body, input, textarea, select")) return;
      if (!target.closest("a, button, [role='button']")) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.visualViewport?.addEventListener("resize", arm);
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("click", onClick, true);
    return () => {
      window.visualViewport?.removeEventListener("resize", arm);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <I18nProvider>
        <ThemeBoot />
        <LocaleGuards />
        <NameJumpHost />
        <NoteLeaveGuard />
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            className:
              "!bg-surface !text-fg !shadow-card !border-0 !rounded-[14px] !font-sans",
          }}
        />
      </I18nProvider>
    </QueryClientProvider>
  );
}
