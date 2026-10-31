import { ChevronDown, ChevronUp, ListOrdered } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  AJUSTES_DEFAULT,
  ajusteLabel,
  readAjustesOrder,
  writeAjustesOrder,
  type AjusteId,
} from "@/lib/ajustes-order";
import { useTx } from "@/lib/i18n";

export function SettingsOrderButton() {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  const [draft, setDraft] = useState<AjusteId[]>([...AJUSTES_DEFAULT]);

  function start() {
    setDraft(readAjustesOrder());
    setAsk(false);
    setOpen(true);
  }

  function move(index: number, dir: -1 | 1) {
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= draft.length) return;
    const next = draft.slice();
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(nextIndex, 0, item);
    setDraft(next);
  }

  return (
    <>
      <button
        type="button"
        aria-label={tx("Orden de los ajustes", "Order of the settings")}
        onClick={start}
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
      >
        <ListOrdered className="size-5" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[80] grid place-items-end overflow-y-auto p-3 sm:place-items-center sm:p-4">
              <button type="button" aria-label={tx("Cerrar", "Close")} className="absolute inset-0 bg-fg/45" onClick={() => setOpen(false)} />
              <div role="dialog" aria-modal="true" className="relative my-auto flex max-h-[88dvh] w-full min-w-0 max-w-md flex-col rounded-xl bg-surface p-4 shadow-card sm:p-5">
                <h2 className="font-display text-xl font-semibold">{tx("Orden de los ajustes", "Order of the settings")}</h2>
                <p className="mt-2 text-sm text-muted">
                  {tx(
                    "Sube o baja cada bloque. Al guardar, Ajustes queda en ese orden en este teléfono. No se borra nada.",
                    "Move each block up or down. When you save, Settings stays in that order on this phone. Nothing is deleted.",
                  )}
                </p>
                <ol className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                  {draft.map((id, index) => (
                    <li key={id} className="flex min-w-0 items-center gap-1 rounded-sm bg-surface-2 px-2 py-1">
                      <span className="min-w-0 flex-1 text-sm font-semibold">{ajusteLabel(id, tx)}</span>
                      <button type="button" aria-label={tx("Subir", "Move up")} disabled={index === 0} onClick={() => move(index, -1)} className="grid size-11 shrink-0 place-items-center disabled:opacity-30">
                        <ChevronUp className="size-5" />
                      </button>
                      <button type="button" aria-label={tx("Bajar", "Move down")} disabled={index === draft.length - 1} onClick={() => move(index, 1)} className="grid size-11 shrink-0 place-items-center disabled:opacity-30">
                        <ChevronDown className="size-5" />
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 grid gap-2">
                  <Button type="button" onClick={() => setAsk(true)}>{tx("Guardar", "Save")}</Button>
                  <Button type="button" variant="secondary" onClick={() => setDraft([...AJUSTES_DEFAULT])}>{tx("Orden de siempre", "Usual order")}</Button>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{tx("Cancelar", "Cancel")}</Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <ConfirmDialog
        front
        open={ask}
        title={tx("¿Guardar este orden?", "Save this order?")}
        description={tx("Los ajustes de esta pantalla se mostrarán en el orden que elegiste.", "The settings on this screen will show in the order you chose.")}
        confirmLabel={tx("Sí, guardar", "Yes, save")}
        cancelLabel={tx("No, seguir editando", "No, keep editing")}
        onConfirm={() => {
          writeAjustesOrder(draft);
          setAsk(false);
          setOpen(false);
        }}
        onCancel={() => setAsk(false)}
      />
    </>
  );
}
