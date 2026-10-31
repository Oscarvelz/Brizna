import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { enableLock, lockCredential, lockSupported } from "@/lib/device-lock";
import { useTx } from "@/lib/i18n";

const askedKey = (uid: string) => `brizna.lockAsked.${uid}`;

/** First time an account is open on this device, offer fingerprint unlock right away (once). */
export function FingerprintOffer() {
  const tx = useTx();
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.isDevFallback || user.id === "local") return;
    const uid = user.id;
    if (lockCredential(uid)) return;
    try {
      if (localStorage.getItem(askedKey(uid))) return;
    } catch {
      return;
    }
    let live = true;
    void lockSupported().then((ok) => {
      if (live && ok) setOpen(true);
    });
    return () => {
      live = false;
    };
  }, [user]);

  if (!user) return null;

  function done() {
    try {
      localStorage.setItem(askedKey(user!.id), "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  async function yes() {
    setBusy(true);
    try {
      const ok = await enableLock(user!.id, user!.primaryEmail ?? "");
      if (ok) toast.success(tx("Huella activada. Brizna la pedirá al abrir.", "Fingerprint on. Brizna will ask for it when it opens."));
      done();
    } catch {
      toast.error(tx("No se pudo activar la huella. Puedes hacerlo luego en Ajustes.", "Could not turn on the fingerprint. You can do it later in Settings."));
      done();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      front
      title={tx("¿Desbloquear Brizna con tu huella?", "Unlock Brizna with your fingerprint?")}
      description={tx(
        "Brizna pedirá tu huella o tu cara al abrir en este teléfono. Funciona sin internet y puedes quitarlo en Ajustes.",
        "Brizna will ask for your fingerprint or face when it opens on this phone. Works offline, and you can turn it off in Settings.",
      )}
      confirmLabel={tx("Usar huella", "Use fingerprint")}
      cancelLabel={tx("Ahora no", "Not now")}
      pending={busy}
      onConfirm={() => void yes()}
      onCancel={done}
      onDismiss={done}
    />
  );
}
