import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient, authEnabled, GROK_PROVIDERS, readKeepSession, signIn, writeKeepSession } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { DEFAULT_BUSINESS_NAME, PRODUCT_NAME } from "@/lib/format";
import { useTx } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function friendlyAuthError(error: unknown, tx: (es: string, en: string) => string) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/popup|bloquead/i.test(raw)) return tx("El navegador bloqueó la ventana. Permite las ventanas emergentes.", "The browser blocked the window. Allow pop-ups.");
  if (/cancel/i.test(raw)) return tx("La entrada se canceló.", "Sign-in was cancelled.");
  if (/password|credential|invalid/i.test(raw)) return tx("Correo o contraseña incorrectos.", "Email or password is wrong.");
  if (/exist/i.test(raw)) return tx("Ese correo ya tiene cuenta. Entra con él.", "That email already has an account. Sign in with it.");
  return tx("No se pudo entrar. Inténtalo otra vez.", "Could not sign in. Try again.");
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-5">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.3 4.2-4.3 5.5l6.3 5.3C40.2 35.3 44 30.1 44 24c0-1.3-.1-2.7-.4-3.9z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LoginPage() {
  const tx = useTx();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keep, setKeep] = useState(() => readKeepSession());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isPending && user) return <Navigate to="/" />;

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    writeKeepSession(keep);
    let last: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const payload = { email: email.trim(), password, rememberMe: keep };
        const result = mode === "up"
          ? await authClient.signUp.email({ ...payload, name: email.trim().split("@")[0] || "Brizna" })
          : await authClient.signIn.email(payload);
        if (result.error) throw new Error(result.error.message || "auth");
        window.location.href = "/";
        return;
      } catch (err) {
        last = err;
        await sleep(500 * (attempt + 1));
      }
    }
    setError(friendlyAuthError(last, tx));
    setBusy(false);
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-bg text-fg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-sun" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark className="mb-4 size-16" />
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            {tx("Desde el patio", "From the yard")}
          </p>
          <h1 className="mt-3 flex items-center justify-center gap-2">
            <span className="font-display text-3xl font-semibold tracking-tight">{PRODUCT_NAME}</span>
            <span className="h-5 w-px bg-border" aria-hidden />
            <span className="font-display text-lg font-medium text-muted">{DEFAULT_BUSINESS_NAME}</span>
          </h1>
          <p className="mt-2 max-w-xs text-sm text-muted">
            {tx(
              "Clientes, cortes y cobros en el teléfono o la tablet, siempre al día.",
              "Clients, cuts, and payments on the phone or tablet, always up to date.",
            )}
          </p>
        </div>

        <div className="rounded-xl bg-surface p-5 shadow-card">
          {authEnabled ? (
            <form className="grid gap-3" onSubmit={submitEmail}>
              <Input
                type="email"
                autoComplete="email"
                required
                placeholder={tx("Correo", "Email")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Input
                type="password"
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                required
                minLength={8}
                placeholder={tx("Contraseña", "Password")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={keep}
                  onChange={(event) => setKeep(event.target.checked)}
                  className="size-4 accent-primary"
                />
                {tx("Mantener sesión abierta", "Keep me signed in")}
              </label>
              {error ? <p className="text-sm text-late">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? tx("Entrando…", "Signing in…") : mode === "up" ? tx("Crear cuenta", "Create account") : tx("Entrar", "Sign in")}
              </Button>
              <button
                type="button"
                className="text-sm font-semibold text-primary"
                onClick={() => {
                  setMode(mode === "in" ? "up" : "in");
                  setError("");
                }}
              >
                {mode === "up"
                  ? tx("Ya tengo cuenta", "I already have an account")
                  : tx("Crear una cuenta nueva", "Create a new account")}
              </button>
              <div className="grid gap-2 pt-1">
                {GROK_PROVIDERS.map((provider) => (
                  <Button
                    key={provider.providerId}
                    type="button"
                    variant="outline"
                    disabled={busy}
                    className="grid w-full grid-cols-[1.25rem_1fr_1.25rem] items-center"
                    onClick={() => {
                      setBusy(true);
                      void signIn(provider.providerId, { callbackURL: "/" }).catch((err: unknown) => {
                        setError(friendlyAuthError(err, tx));
                        setBusy(false);
                      });
                    }}
                  >
                    {provider.idp === "google" ? <GoogleMark /> : <XMark />}
                    <span className="text-center">
                      {tx(
                        provider.idp === "google" ? "Continuar con Google" : "Continuar con X",
                        provider.idp === "google" ? "Continue with Google" : "Continue with X",
                      )}
                    </span>
                    <span />
                  </Button>
                ))}
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted">{tx("La entrada no está activa en esta copia.", "Sign-in is off in this copy.")}</p>
          )}
        </div>
      </div>
    </main>
  );
}
