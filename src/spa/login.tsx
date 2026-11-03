import { useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, CloudOff, Eye, EyeOff, Fingerprint, Loader2, LockKeyhole, LogOut, Mail, ShieldCheck, Sprout, UserRound } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { DEFAULT_BUSINESS_NAME, PRODUCT_NAME } from "@/lib/format";
import { useI18n, useTx } from "@/lib/i18n";
import { LOCALE_PICKED_KEY } from "@/lib/theme";
import { emitUser, keepSignedIn, rememberUser, setKeepSignedIn, supabase } from "./cloud";
import { LawnScene } from "./lawn-scene";

type Mode = "in" | "up" | "forgot" | "reset";

function friendly(err: unknown, tx: (es: string, en: string) => string) {
  const raw = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err ?? "");
  if (/invalid login|credential|invalid/i.test(raw)) return tx("Correo o contraseña incorrectos.", "Email or password is wrong.");
  if (/already|registered|exist/i.test(raw)) return tx("Ese correo ya tiene cuenta. Entra con él.", "That email already has an account. Sign in with it.");
  if (/not confirmed/i.test(raw)) return tx("Confirma tu correo y luego entra.", "Confirm your email, then sign in.");
  if (/rate|too many/i.test(raw)) return tx("Demasiados intentos. Espera un minuto.", "Too many tries. Wait a minute.");
  if (/password/i.test(raw)) return tx("La contraseña debe tener al menos 8 caracteres.", "The password needs at least 8 characters.");
  if (/fetch|network/i.test(raw)) return tx("Sin conexión. Conéctate a internet para entrar.", "No connection. Connect to the internet to sign in.");
  return tx("No se pudo entrar. Inténtalo otra vez.", "Could not sign in. Try again.");
}

export function Login({ recovery, note }: { recovery?: boolean; note?: string }) {
  const tx = useTx();
  const { locale, setLocale } = useI18n();
  const [mode, setMode] = useState<Mode>(recovery ? "reset" : "in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(keepSignedIn);
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
        setKeepSignedIn(keep);
        const { data, error: e } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() || email.trim() }, emailRedirectTo: here } });
        if (e) throw e;
        if (!data.session) { setInfo(tx("Revisa tu correo para confirmar la cuenta y luego entra.", "Check your email to confirm the account, then sign in.")); setMode("in"); return; }
        emitUser(rememberUser(data.session));
        return;
      }
      setKeepSignedIn(keep);
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
  const eye = (
    <button type="button" onClick={() => setShow((on) => !on)} aria-label={show ? tx("Ocultar contraseña", "Hide password") : tx("Mostrar contraseña", "Show password")} aria-pressed={show} className="bz-eye">
      {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
    </button>
  );
  const heading =
    mode === "up" ? [tx("Crea tu cuenta", "Create your account"), tx("Tus clientes y cobros, guardados en tu cuenta.", "Your clients and payments, saved to your account.")]
    : mode === "forgot" ? [tx("Olvidé mi contraseña", "Forgot my password"), tx("Te enviamos un enlace para crear una nueva.", "We will send you a link to make a new one.")]
    : mode === "reset" ? [tx("Nueva contraseña", "New password"), tx("Escríbela dos veces para guardarla.", "Type it twice to save it.")]
    : [tx("Hola de nuevo", "Welcome back"), tx("Entra para ver tus patios de hoy.", "Sign in to see today's yards.")];
  const busyText =
    mode === "up" ? tx("Creando cuenta…", "Creating account…")
    : mode === "forgot" ? tx("Enviando…", "Sending…")
    : mode === "reset" ? tx("Guardando…", "Saving…")
    : tx("Entrando…", "Signing in…");

  // An explicit pick here wins over the saved setting once the app opens (app-shell saves it).
  const pickLocale = (next: "es" | "en") => {
    setLocale(next);
    try {
      window.localStorage.setItem(LOCALE_PICKED_KEY, next);
    } catch {
      /* ignore */
    }
  };

  return (
    <main className="bz-login">
      <LawnScene />
      <div className="bz-lang" role="group" aria-label={tx("Idioma", "Language")}>
        <button type="button" aria-pressed={locale === "es"} onClick={() => pickLocale("es")}>ES</button>
        <button type="button" aria-pressed={locale === "en"} onClick={() => pickLocale("en")}>EN</button>
      </div>
      <div className="bz-shell">
        <header className="bz-brand">
          <BrandMark className="bz-mark" />
          <p className="bz-eyebrow">{tx("Desde el patio", "From the yard")}</p>
          <h1 className="bz-title">{PRODUCT_NAME}</h1>
          <p className="bz-business">{DEFAULT_BUSINESS_NAME}</p>
          <p className="bz-tagline">
            {tx("Clientes, cortes y cobros en el teléfono o la tablet, siempre al día.", "Clients, cuts, and payments on the phone or tablet, always up to date.")}
          </p>
        </header>

        <section className="bz-card" aria-labelledby="bz-card-title">
          <h2 id="bz-card-title" className="bz-card-title">{heading[0]}</h2>
          <p className="bz-card-sub">{heading[1]}</p>
          <form className="grid gap-3.5" onSubmit={(e) => void submit(e)} noValidate={false}>
            {mode === "up" ? (
              <div className="bz-field">
                <label className="bz-label" htmlFor="bz-name">{tx("Tu nombre", "Your name")}</label>
                <div className="bz-input-wrap">
                  <UserRound className="bz-icon" aria-hidden />
                  <input id="bz-name" className="bz-input" autoComplete="name" placeholder={tx("Como quieras que te llamemos", "What we should call you")} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
            ) : null}
            {mode !== "reset" ? (
              <div className="bz-field">
                <label className="bz-label" htmlFor="bz-email">{tx("Correo", "Email")}</label>
                <div className="bz-input-wrap">
                  <Mail className="bz-icon" aria-hidden />
                  <input id="bz-email" className="bz-input" type="email" autoComplete="email" inputMode="email" required placeholder={tx("tu@correo.com", "you@email.com")} value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
            ) : null}
            {mode !== "forgot" ? (
              <div className="bz-field">
                <div className="bz-label">
                  <label htmlFor="bz-pass">{mode === "reset" ? tx("Nueva contraseña", "New password") : tx("Contraseña", "Password")}</label>
                  {mode === "in" ? (
                    <button type="button" className="bz-link" onClick={() => swap("forgot")}>{tx("Olvidé mi contraseña", "Forgot my password")}</button>
                  ) : null}
                </div>
                <div className="bz-input-wrap">
                  <LockKeyhole className="bz-icon" aria-hidden />
                  <input
                    id="bz-pass"
                    className="bz-input has-eye"
                    type={passType}
                    autoComplete={making ? "new-password" : "current-password"}
                    required
                    minLength={8}
                    placeholder={making ? tx("Mínimo 8 caracteres", "At least 8 characters") : "••••••••"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {eye}
                </div>
              </div>
            ) : null}
            {making ? (
              <div className="bz-field">
                <label className="bz-label" htmlFor="bz-confirm">{tx("Confirma la contraseña", "Confirm the password")}</label>
                <div className="bz-input-wrap">
                  <ShieldCheck className="bz-icon" aria-hidden />
                  <input id="bz-confirm" className="bz-input" type={passType} autoComplete="new-password" required minLength={8} placeholder={tx("Otra vez, igual", "Same again")} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
              </div>
            ) : null}
            {mode === "in" || mode === "up" ? (
              <label className="bz-keep">
                <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
                <span>{tx("Mantener sesión abierta", "Keep me signed in")}</span>
              </label>
            ) : null}
            {info ? <p className="bz-msg bz-msg-info" role="status"><CheckCircle2 aria-hidden />{info}</p> : null}
            {error ? <p className="bz-msg bz-msg-error" role="alert"><AlertCircle aria-hidden />{error}</p> : null}
            <button type="submit" className="bz-submit mt-1" disabled={busy} data-busy={busy ? "1" : undefined} aria-busy={busy}>
              {busy ? (
                <>
                  <Loader2 className="bz-spinner" aria-hidden />
                  {busyText}
                </>
              ) : (
                <>
                  {mode === "up" ? tx("Crear cuenta", "Create account")
                    : mode === "forgot" ? tx("Enviar correo", "Send email")
                    : mode === "reset" ? tx("Guardar contraseña", "Save password")
                    : tx("Entrar", "Sign in")}
                  <ArrowRight className="size-[1.1rem]" aria-hidden />
                </>
              )}
            </button>
            {mode === "in" ? (
              <>
                <div className="bz-divider">{tx("o", "or")}</div>
                <button type="button" className="bz-alt" onClick={() => swap("up")}>
                  <Sprout className="size-[1.05rem]" aria-hidden />
                  {tx("Crear una cuenta nueva", "Create a new account")}
                </button>
              </>
            ) : null}
            {mode === "up" ? (
              <button type="button" className="bz-link justify-self-center py-1" onClick={() => swap("in")}>{tx("Ya tengo cuenta", "I already have an account")}</button>
            ) : null}
            {mode === "forgot" ? (
              <button type="button" className="bz-link inline-flex items-center gap-1 justify-self-center py-1" onClick={() => swap("in")}>
                <ArrowLeft className="size-4" aria-hidden />
                {tx("Volver", "Back")}
              </button>
            ) : null}
          </form>
        </section>
        <p className="bz-foot">
          <CloudOff aria-hidden />
          {tx("Tus datos se guardan en tu cuenta y funcionan sin internet.", "Your data is saved to your account and works offline.")}
        </p>
      </div>
    </main>
  );
}

export function Locked({ onOpen, onSignOut, failed }: { onOpen: () => void; onSignOut: () => void; failed: boolean }) {
  const tx = useTx();
  return (
    <main className="bz-login">
      <LawnScene calm />
      <div className="bz-shell" style={{ maxWidth: "24rem", display: "flex" }}>
        <header className="bz-brand">
          <BrandMark className="bz-mark" />
          <h1 className="bz-title">{PRODUCT_NAME}</h1>
          <p className="bz-tagline">{tx("Brizna está bloqueada.", "Brizna is locked.")}</p>
        </header>
        <section className="bz-card grid gap-3">
          <button type="button" className="bz-submit" onClick={onOpen}>
            <Fingerprint className="size-5" aria-hidden />
            {failed ? tx("Intentar de nuevo", "Try again") : tx("Desbloquear con huella", "Unlock with fingerprint")}
          </button>
          {failed ? <p className="bz-msg bz-msg-error" role="alert"><AlertCircle aria-hidden />{tx("No se pudo confirmar. Intenta de nuevo.", "Could not confirm. Try again.")}</p> : null}
          <button type="button" className="bz-link inline-flex items-center justify-center gap-1.5 py-1" onClick={onSignOut}>
            <LogOut className="size-4" aria-hidden />
            {tx("Cerrar sesión", "Sign out")}
          </button>
        </section>
      </div>
    </main>
  );
}

export function Splash() {
  return (
    <main className="bz-login grid place-items-center">
      <div className="bz-scene" aria-hidden="true"><div className="bz-sky" /></div>
      <div className="flex flex-col items-center">
        <BrandMark className="bz-mark mb-4" />
        <p className="font-display text-3xl font-semibold">{PRODUCT_NAME}</p>
      </div>
    </main>
  );
}
