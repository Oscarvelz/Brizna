import { Redo, Undo } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTx } from "@/lib/i18n";
import { useUndo } from "@/lib/undo";
import { cn } from "@/lib/utils";

export function UndoBar({ compact = false, confirm = true }: { compact?: boolean; confirm?: boolean }) {
  const tx = useTx();
  const past = useUndo((s) => s.past);
  const future = useUndo((s) => s.future);
  const busy = useUndo((s) => s.busy);
  const undo = useUndo((s) => s.undo);
  const redo = useUndo((s) => s.redo);
  const [ask, setAsk] = useState<"undo" | "redo" | null>(null);
  if (past.length === 0 && future.length === 0) return null;
  const last = past[past.length - 1];
  const next = future[0];
  const label = ask === "redo" ? next?.label : last?.label;
  return (
    <>
      <div className={cn("flex items-center", compact ? "gap-0" : "gap-0.5")}>
        <button
          type="button"
          data-present="deshacer-barra"
          aria-label={last ? tx(`Deshacer: ${last.label}`, `Undo: ${last.label}`) : tx("Deshacer", "Undo")}
          disabled={busy || past.length === 0}
          onClick={() => {
            if (!confirm) {
              void undo();
              return;
            }
            setAsk("undo");
          }}
          className={cn(
            "grid place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30",
            compact ? "size-8" : "size-11",
          )}
        >
          <Undo className={compact ? "size-3.5" : "size-5"} />
        </button>
        <button
          type="button"
          aria-label={next ? tx(`Rehacer: ${next.label}`, `Redo: ${next.label}`) : tx("Rehacer", "Redo")}
          disabled={busy || future.length === 0}
          onClick={() => {
            if (!confirm) {
              void redo();
              return;
            }
            setAsk("redo");
          }}
          className={cn(
            "grid place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30",
            compact ? "size-8" : "size-11",
          )}
        >
          <Redo className={compact ? "size-3.5" : "size-5"} />
        </button>
      </div>
      {confirm ? (
      <ConfirmDialog
        open={ask != null}
        presentConfirm="deshacer-confirmar"
        title={ask === "redo" ? tx("¿Rehacer este cambio?", "Redo this change?") : tx("¿Deshacer este cambio?", "Undo this change?")}
        description={
          ask === "redo"
            ? tx(
                `Rehacer vuelve a aplicar lo que acabas de deshacer${label ? `: ${label}` : ""}. No borra clientes ni cobros por su cuenta.`,
                `Redo applies again what you just undid${label ? `: ${label}` : ""}. It does not delete clients or payments on its own.`,
              )
            : tx(
                `Deshacer vuelve atrás el cambio más reciente${label ? `: ${label}` : ""}. Sirve para corregir un toque sin querer.`,
                `Undo goes back on the latest change${label ? `: ${label}` : ""}. It fixes an accidental tap.`,
              )
        }
        confirmLabel={ask === "redo" ? tx("Sí, rehacer", "Yes, redo") : tx("Sí, deshacer", "Yes, undo")}
        pending={busy}
        onConfirm={() => {
          const action = ask;
          setAsk(null);
          if (action === "redo") void redo();
          else void undo();
        }}
        onCancel={() => setAsk(null)}
      />
      ) : null}
    </>
  );
}
