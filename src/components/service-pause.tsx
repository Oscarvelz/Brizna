import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Hint } from "@/components/hint";
import { invalidateLawn } from "@/components/job-card";
import { useTx } from "@/lib/i18n";
import { setServicePaused } from "@/lib/server/lawn";
import { cn } from "@/lib/utils";

export function ServicePause({
  id,
  name,
  paused,
  labeled = false,
  noHint = false,
}: {
  id: number;
  name: string;
  paused: boolean;
  labeled?: boolean;
  /** 1.4.79: Cobros Media icon row has no room for the ?; the manual still explains Pausa. */
  noHint?: boolean;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await setServicePaused({ data: { id, paused: !paused } });
      toast.success(
        paused
          ? tx(`${name} vuelve a la agenda`, `${name} is back on the schedule`)
          : tx(`${name} quedó en pausa`, `${name} is paused`),
      );
      await invalidateLawn(qc);
      setOpen(false);
    } catch {
      toast.error(tx("No se pudo cambiar la pausa", "The pause could not be changed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        aria-pressed={paused}
        data-spot="pausa"
        data-ref={paused ? "continuar" : undefined}
        aria-label={paused ? tx(`Reanudar a ${name}`, `Resume ${name}`) : tx(`Pausar a ${name}`, `Pause ${name}`)}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex touch-manipulation items-center justify-center gap-1.5 rounded-full bg-hold-bg font-semibold text-hold",
          labeled ? "h-11 px-3 text-sm" : "size-9",
        )}
      >
        {paused ? <Play className="size-4 fill-current" /> : <Pause className="size-4" />}
        {labeled ? (paused ? tx("Continuar", "Play") : tx("Pausa", "Pause")) : null}
      </button>
      {noHint ? null : <Hint compact topic="pausa" alt={paused} />}
      <ConfirmDialog
        open={open}
        title={
          paused
            ? tx(`¿Reanudar el patio de ${name}?`, `Resume ${name}'s yard?`)
            : tx(`¿Pausar el patio de ${name}?`, `Pause ${name}'s yard?`)
        }
        description={
          paused
            ? tx(
                "Vuelve a la agenda automática. Los extras y trabajos de una vez que se cancelaron con la pausa no vuelven solos: quedan en el historial como cancelados.",
                "They go back on the automatic schedule. Extras and one-time jobs cancelled with the pause do not come back on their own: they stay in the history as cancelled.",
              )
            : tx(
                "No se le hará cortes ni trabajos hasta que decidas Continuar. Sus extras y trabajos de una vez pendientes se cancelan a la vista (quedan en el historial, no se borran). Lo que debe se queda en Por cobrar y el caso queda en En espera.",
                "No cuts or jobs until you choose to continue. Their pending extras and one-time jobs are cancelled in plain sight (they stay in the history, not deleted). What they owe stays in To collect and the case stays in Waiting.",
              )
        }
        confirmLabel={paused ? tx("Sí, reanudar", "Yes, resume") : tx("Sí, pausar", "Yes, pause")}
        pending={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setOpen(false)}
      />
    </span>
  );
}
