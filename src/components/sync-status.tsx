import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useTx } from "@/lib/i18n";
import { onSyncStatus, syncInfo, syncNow } from "@/spa/sync";
import { SettingsFoldShell } from "@/components/settings-fold-shell";
import { askSignInAgain, sessionGone } from "@/spa/cloud";

function when(iso: string, es: boolean): string {
  if (!iso) return es ? "todavía no" : "not yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return es ? "hace un momento" : "just now";
  if (mins < 60) return es ? `hace ${mins} min` : `${mins} min ago`;
  const loc = es ? "es-US" : "en-US";
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return es ? `hoy, ${time}` : `today, ${time}`;
  return `${d.toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" })}, ${time}`;
}

/** Ajustes: is this account's data safe in the cloud? */
export function SyncStatusCard() {
  const tx = useTx();
  const es = tx("es", "en") === "es";
  const user = useCurrentUser();
  const [info, setInfo] = useState(syncInfo());
  useEffect(() => {
    const off = onSyncStatus(() => setInfo(syncInfo()));
    const t = window.setInterval(() => setInfo(syncInfo()), 20000);
    const onSess = () => setInfo(syncInfo());
    window.addEventListener("brizna-session", onSess);
    return () => { off(); window.clearInterval(t); window.removeEventListener("brizna-session", onSess); };
  }, []);

  if (!user || user.isDevFallback || user.id === "local" || !info.on) return null;

  if (sessionGone()) {
    return (
      <SettingsFoldShell id="aj-nube" topic="nube" icon={<CloudOff className="size-5 shrink-0 text-muted" />} title={tx("Nube", "Cloud")} peek={<span className="text-xs text-muted">{tx("sesión terminada", "signed out")}</span>}>
        <div className="flex items-start gap-3">
          <CloudOff className="mt-0.5 size-6 shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{tx("Tu sesión en la nube terminó", "Your cloud session ended")}</p>
            <p className="mt-1 text-xs text-muted">{tx("Tus datos siguen en este equipo. Entra de nuevo para volver a sincronizar.", "Your data is still on this device. Sign in again to sync.")}</p>
            <button type="button" onClick={askSignInAgain} className="mt-3 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg">
              {tx("Entrar de nuevo", "Sign in again")}
            </button>
          </div>
        </div>
      </SettingsFoldShell>
    );
  }

  const busy = info.status === "syncing";
  const safe = info.status === "idle" && !info.pending && Boolean(info.cloudAt);
  const headline = busy
    ? tx("Sincronizando…", "Syncing…")
    : info.status === "offline"
      ? tx("Sin internet: los cambios se subirán al volver la conexión", "Offline: changes will upload when you're back online")
      : info.status === "error"
        ? tx("No se pudo sincronizar. Toca Sincronizar ahora.", "Couldn't sync. Tap Sync now.")
        : info.pending
          ? tx("Hay cambios que aún no están en la nube", "Some changes aren't in the cloud yet")
          : safe
            ? tx("Todo está guardado en la nube", "Everything is saved in the cloud")
            : tx("Aún sin copia en la nube", "No cloud copy yet");
  const Icon = info.status === "offline" || info.status === "error" ? CloudOff : Cloud;

  return (
    <SettingsFoldShell
      id="aj-nube"
      topic="nube"
      icon={<Icon className={`size-5 shrink-0 ${safe ? "text-primary" : "text-muted"}`} />}
      title={tx("Nube", "Cloud")}
      peek={<span className={`text-xs font-semibold ${safe ? "text-primary" : "text-muted"}`}>{busy ? "…" : safe ? tx("guardado", "saved") : info.status === "offline" ? tx("sin internet", "offline") : tx("pendiente", "pending")}</span>}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{headline}</p>
          <p className="mt-1 text-xs text-muted">
            {tx("Última copia en la nube:", "Last saved to the cloud:")} {when(info.cloudAt, es)}
          </p>
          <p className="text-xs text-muted">
            {tx("Última comprobación:", "Last checked:")} {when(info.checkedAt, es)}
          </p>
          {safe ? (
            <p className="mt-2 text-xs text-muted">
              {tx("Si borras los datos del navegador o cambias de teléfono, entra con tu cuenta y todo vuelve.", "If you clear the browser's data or change phones, sign in and everything comes back.")}
            </p>
          ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => { void syncNow(true).then(() => setInfo(syncInfo())); setInfo(syncInfo()); }}
              className="mt-3 flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
              {tx("Sincronizar ahora", "Sync now")}
            </button>
        </div>
      </div>
    </SettingsFoldShell>
  );
}
