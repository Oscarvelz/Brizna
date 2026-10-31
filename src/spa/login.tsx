import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_BUSINESS_NAME, PRODUCT_NAME } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { emitUser, rememberUser, supabase } from "./cloud";

type Mode = "in" | "up" | "forgot" | "reset";

function friendly(err: unknown, tx: (es: string, en: string) => string) {
  const raw = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err ?? "");
  if (/invalid login|credential|invalid/i.test(raw)) return tx("Correo o contraseña incorrectos.", "Email or password is wrong.");
  if (/already|registered|exist/i.test(raw)) return tx("Ese correo ya tiene cuenta (la misma de Faro y Vela). Entra con él.", "That email already has an account (the same as Faro and Vela). Sign in with it.");
  if (/not confirmed/i.test(raw)) return tx("Confirma tu correo y luego entra.", "Confirm your email, then sign in.");
  if (/rate|too many/i.test(raw)) return tx("Demasiados intentos. Espera un minuto.", "Too many tries. Wait a minute.");
  if (/password/i.test(raw)) return tx("La contraseña debe tener al menos 8 caracteres.", "The password needs at least 8 characters.");
  if (/fetch|network/i.test(raw)) return tx("Sin conexión. Conéctate a internet para entrar.", "No connection. Connect to the internet to sign in.");
  return tx("No se pudo entrar. Inténtalo otra vez.", "Could not sign in. Try again.");
}

export function Login({ recovery, note }: { recovery?: boolean; note?: string }) {
  const tx = useTx();
  const [mode, setMode] = useState<Mode>(recovery ? "reset" : "in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(note ?? "");
  const here = location.origin + location.pathname;
  const making = mode === "up" || mode === "reset";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    if (!navigator.onLine) { setError(tx("Sin conexión. La primera vez necesitas internet para entrar.", "No connection. The first time you need internet to sign in.")); return; }
    if (making && password !== confirm) { setError(tx("Las contraseñas no coinciden.", "The passwords do not match.")); return; }
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: here });
        if (e) throw e;
        setInfo(tx("Te enviamos un correo para cambiar la contraseña.", "We sent you an email to change the password."));
        setMode("in");
        return;
      }
      if (mode === "reset") {
        const { error: e } = await supabase.auth.updateUser({ password });
        if (e) throw e;
        history.replaceState(null, "", here);
        const { data } = await supabase.auth.getSession();
        emitUser(rememberUser(data.session));
        return;
      }
      if (mode === "up") {
        const { data, error: e } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() || email.trim() }, emailRedirectTo: here } });
        if (e) throw e;
        if (!data.session) { setInfo(tx("Revisa tu correo para confirmar la cuenta y luego entra.", "Check your email to confirm the account, then sign in.")); setMode("in"); return; }
        emitUser(rememberUser(data.session));
        return;
      }
      const { data, error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (e) throw e;
      emitUser(rememberUser(data.session));
    } catch (err) {
      setError(friendly(err, tx));
    } finally {
      setBusy(false);
    }
  }

  const swap = (next: Mode) => { setError(""); setInfo(""); setConfirm(""); setMode(next); };
  const passType = show ? "text" : "password";

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-bg text-fg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-sun" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark className="mb-4 size-16" />
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">{tx("Desde el patio", "From the yard")}</p>
          <h1 className="mt-3 flex items-center justify-center gap-2">
            <span className="font-display text-3xl font-semibold tracking-tight">{PRODUCT_NAME}</span>
            <span className="h-5 w-px bg-border" aria-hidden />
            <span className="font-display text-lg font-medium text-muted">{DEFAULT_BUSINESS_NAME}</span>
          </h1>
          <p className="mt-2 max-w-xs text-sm text-muted">
            {tx("Clientes, cortes y cobros en el teléfono o la tablet, siempre al día.", "Clients, cuts, and payments on the phone or tablet, always up to date.")}
          </p>
        </div>

        <div className="rounded-xl bg-surface p-5 shadow-card">
          {mode === "forgot" || mode === "reset" ? (
            <h2 className="mb-3 font-display text-xl font-semibold">
              {mode === "reset" ? tx("Nueva contraseña", "New password") : tx("Olvidé mi contraseña", "Forgot my password")}
            </h2>
          ) : null}
          <form className="grid gap-3" onSubmit={(e) => void submit(e)}>
            {mode === "up" ? (
              <Input autoComplete="name" placeholder={tx("Tu nombre", "Your name")} value={name} onChange={(e) => setName(e.target.value)} />
            ) : null}
            {mode !== "reset" ? (
              <Input type="email" autoComplete="email" inputMode="email" required placeholder={tx("Correo", "Email")} value={email} onChange={(e) => setEmail(e.target.value)} />
            ) : null}
            {mode !== "forgot" ? (
              <div className="relative">
                <Input
                  type={passType}
                  autoComplete={making ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  placeholder={mode === "reset" ? tx("Nueva contraseña", "New password") : tx("Contraseña", "Password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12"
                />
                <button type="button" onClick={() => setShow((on) => !on)} aria-label={show ? tx("Ocultar contraseña", "Hide password") : tx("Mostrar contraseña", "Show password")} className="absolute inset-y-0 right-1 grid w-10 place-items-center text-muted">
                  {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            ) : null}
            {making ? (
              <Input type={passType} autoComplete="new-password" required minLength={8} placeholder={tx("Confirma la contraseña", "Confirm the password")} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            ) : null}
            {info ? <p className="text-sm text-primary">{info}</p> : null}
            {error ? <p className="text-sm text-late">{error}</p> : null}
            <Button type="submit" disabled={busy}>
              {busy
                ? "…"
                : mode === "up" ? tx("Crear cuenta", "Create account")
                : mode === "forgot" ? tx("Enviar correo", "Send email")
                : mode === "reset" ? tx("Guardar contraseña", "Save password")
                : tx("Entrar", "Sign in")}
            </Button>
            {mode === "in" || mode === "up" ? (
              <button type="button" className="text-sm font-semibold text-primary" onClick={() => swap(mode === "in" ? "up" : "in")}>
                {mode === "up" ? tx("Ya tengo cuenta", "I already have an account") : tx("Crear una cuenta nueva", "Create a new account")}
              </button>
            ) : null}
            {mode === "in" ? (
              <button type="button" className="text-sm text-muted" onClick={() => swap("forgot")}>{tx("Olvidé mi contraseña", "Forgot my password")}</button>
            ) : null}
            {mode === "forgot" ? (
              <button type="button" className="text-sm text-muted" onClick={() => swap("in")}>{tx("Volver", "Back")}</button>
            ) : null}
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          {tx("La misma cuenta de Faro y Vela. Después funciona sin internet.", "The same account as Faro and Vela. After that it works without internet.")}
        </p>
      </div>
    </main>
  );
}

export function Locked({ onOpen, onSignOut, failed }: { onOpen: () => void; onSignOut: () => void; failed: boolean }) {
  const tx = useTx();
  return (
    <main className="relative grid min-h-dvh place-items-center bg-bg px-5 text-fg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-sun" />
      <div className="relative flex w-full max-w-sm flex-col items-center text-center">
        <BrandMark className="mb-4 size-16" />
        <h1 className="font-display text-3xl font-semibold">{PRODUCT_NAME}</h1>
        <p className="mt-2 text-sm text-muted">{tx("Brizna está bloqueada.", "Brizna is locked.")}</p>
        <Button type="button" className="mt-6 w-full" onClick={onOpen}>
          {failed ? tx("Intentar de nuevo", "Try again") : tx("Desbloquear con huella", "Unlock with fingerprint")}
        </Button>
        {failed ? <p className="mt-3 text-sm text-late">{tx("No se pudo confirmar. Intenta de nuevo.", "Could not confirm. Try again.")}</p> : null}
        <button type="button" className="mt-6 text-sm text-muted" onClick={onSignOut}>{tx("Cerrar sesión", "Sign out")}</button>
      </div>
    </main>
  );
}

export function Splash() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg text-fg">
      <div className="flex flex-col items-center">
        <BrandMark className="mb-4 size-16" />
        <p className="font-display text-3xl font-semibold">{PRODUCT_NAME}</p>
      </div>
    </main>
  );
}
