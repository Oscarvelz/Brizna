import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { disableLock, enableLock, lockCredential, lockSupported } from "@/lib/device-lock";
import { useTx } from "@/lib/i18n";

/** Turn fingerprint / face unlock on or off for this account on this device. */
export function FingerprintControl() {
  const tx = useTx();
  const user = useCurrentUser();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void lockSupported().then(setSupported);
  }, []);
  useEffect(() => {
    if (user) setOn(Boolean(lockCredential(user.id)));
  }, [user]);

  if (!user || user.isDevFallback || user.id === "local") return null;

  async function toggle() {
    if (!user) return;
    if (on) {
      disableLock(user.id);
      setOn(false);
      toast(tx("Huella quitada en este equipo.", "Fingerprint removed on this device."));
      return;
    }
    setBusy(true);
    try {
      const ok = await enableLock(user.id, user.primaryEmail ?? "");
      setOn(ok);
      if (ok) toast.success(tx("Huella activada. Brizna la pedirá al abrir.", "Fingerprint on. Brizna will ask for it when it opens."));
    } catch {
      toast.error(tx("No se pudo activar la huella.", "Could not turn on the fingerprint."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 rounded-md bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <Fingerprint className="size-6 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{tx("Desbloqueo con huella", "Fingerprint unlock")}</p>
          <p className="text-xs text-muted">
            {supported === false
              ? tx("Este equipo no tiene huella o bloqueo de pantalla disponible.", "This device has no fingerprint or screen lock available.")
              : tx("Pide tu huella o tu cara al abrir Brizna en este equipo. Funciona sin internet.", "Asks for your fingerprint or face when Brizna opens on this device. Works offline.")}
          </p>
        </div>
        {supported ? (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={busy}
            onClick={() => void toggle()}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-surface-2"}`}
          >
            <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.4rem]" : "left-0.5"}`} />
          </button>
        ) : null}
      </div>
      {user.primaryEmail ? (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
          {tx("Cuenta:", "Account:")} {user.primaryEmail} · {tx("se sincroniza sola cuando hay internet.", "syncs on its own when online.")}
        </p>
      ) : null}
    </div>
  );
}
