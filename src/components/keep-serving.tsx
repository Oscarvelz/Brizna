import { useQueryClient } from "@tanstack/react-query";
import { HandPlatter } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { invalidateLawn } from "@/components/job-card";
import { useTx } from "@/lib/i18n";
import { setKeepServing } from "@/lib/server/lawn";
import { cn } from "@/lib/utils";

/**
 * Movimiento 1, hallazgo 2: «seguir atendiendo». Un cliente en serio (alto riesgo)
 * deja de recibir visitas nuevas; este interruptor, en su ficha, es el override
 * explícito del usuario. Mismo acabado visual que Pausa (service-pause.tsx).
 */
export function KeepServing({
  id,
  name,
  keepServing,
}: {
  id: number;
  name: string;
  keepServing: boolean;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await setKeepServing({ data: { id, keepServing: !keepServing } });
      toast.success(
        keepServing
          ? tx(`${name} vuelve a la regla de alto riesgo`, `${name} is back under the high-risk rule`)
          : tx(`${name} seguirá recibiendo visitas`, `${name} will keep getting visits`),
      );
      await invalidateLawn(qc);
      setOpen(false);
    } catch {
      toast.error(tx("No se pudo cambiar", "It could not be changed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        data-present="ficha-seguir"
        aria-pressed={keepServing}
        aria-label={
          keepServing
            ? tx(`Dejar de atender siempre a ${name}`, `Stop always serving ${name}`)
            : tx(`Seguir atendiendo a ${name} aunque esté en alto riesgo`, `Keep serving ${name} even at high risk`)
        }
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-11 touch-manipulation items-center justify-center gap-1.5 rounded-full bg-hold-bg px-3 text-sm font-semibold text-hold",
        )}
      >
        <HandPlatter className="size-4" aria-hidden />
        {keepServing ? tx("Atendiendo siempre", "Always serving") : tx("Seguir atendiendo", "Keep serving")}
      </button>
      <ConfirmDialog
        open={open}
        title={
          keepServing
            ? tx(`¿Quitar «seguir atendiendo» a ${name}?`, `Remove "keep serving" from ${name}?`)
            : tx(`¿Seguir atendiendo a ${name}?`, `Keep serving ${name}?`)
        }
        description={
          keepServing
            ? tx(
                "Vuelve la regla: si el caso está en serio (alto riesgo), no se le generan visitas nuevas hasta que pague o se le perdone. Las visitas ya puestas se quedan como aviso.",
                "The rule returns: while the case is serious (high risk), no new visits are generated until they pay or are forgiven. Visits already placed stay as a warning.",
              )
            : tx(
                "Aunque el caso esté en serio (alto riesgo), la agenda le seguirá generando visitas. Úsalo cuando ya acordaste algo con el cliente. Puedes quitarlo cuando quieras desde esta misma ficha.",
                "Even while the case is serious (high risk), the schedule will keep generating visits. Use it when you have already arranged something with the client. You can turn it off any time from this same file.",
              )
        }
        confirmLabel={keepServing ? tx("Sí, quitar", "Yes, remove") : tx("Sí, seguir atendiendo", "Yes, keep serving")}
        pending={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setOpen(false)}
      />
    </span>
  );
}
