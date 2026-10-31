import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { readStoredLocale } from "@/lib/theme";

function errorMessage(error: unknown): { title: string; body: string; reconnect: boolean; action: string } {
  const en = readStoredLocale() === "en";
  const raw =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const lower = raw.toLowerCase();
  if (
    lower.includes("content-type") ||
    lower.includes("invariant") ||
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("web server is down")
  ) {
    return {
      title: en ? "Connection dropped" : "Se cortó la conexión",
      body: en
        ? "The app lost the network for a moment. Tap to come back: your account and clients are still saved."
        : "La app se quedó un rato sin red. Toca para volver: tu cuenta y tus clientes siguen guardados.",
      reconnect: true,
      action: en ? "Sign in again" : "Volver a entrar",
    };
  }
  return {
    title: en ? "Something went wrong" : "Algo salió mal",
    body: raw || (en ? "Something unexpected happened. Reload the page." : "Ocurrió un error inesperado. Recarga la página."),
    reconnect: false,
    action: en ? "Reload" : "Recargar",
  };
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const info = errorMessage(error);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-late" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-xl font-semibold">{info.title}</h1>
      <p className="max-w-md text-sm break-words text-muted">{info.body}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 h-12 rounded-md bg-primary px-5 font-semibold text-primary-fg"
      >
        {info.action}
      </button>
    </main>
  );
}
