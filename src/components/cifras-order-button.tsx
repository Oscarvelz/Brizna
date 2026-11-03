import { ChevronDown, ChevronUp, ListOrdered } from "lucide-react";
import { useBackClose } from "@/lib/back-close";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  CIFRAS_DEFAULT,
  cifraLabel,
  readCifrasOrder,
  writeCifrasOrder,
  type CifraId,
} from "@/lib/cifras-order";
import { emphasize, useTx, useI18n } from "@/lib/i18n";
import { rememberOrigin } from "@/lib/manual/nav";

export function CifrasOrderButton() {
  const tx = useTx();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  useBackClose(open, () => setOpen(false));
  const [ask, setAsk] = useState(false);
  const [draft, setDraft] = useState<CifraId[]>([...CIFRAS_DEFAULT]);

  function start() {
    setDraft(readCifrasOrder());
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

  function sameAsSaved() {
    const saved = readCifrasOrder();
    return draft.length === saved.length && draft.every((id, i) => id === saved[i]);
  }

  return (
    <>
      <button
        type="button"
        aria-label={tx("Orden de las cifras", "Order of the figures")}
        onClick={start}
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
      >
        <ListOrdered className="size-5" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[80] grid place-items-end overflow-y-auto p-3 sm:place-items-center sm:p-4">
              <button
                type="button"
                aria-label={tx("Cerrar", "Close")}
                className="absolute inset-0 bz-scrim"
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="cifras-order-title"
                className="relative my-auto flex max-h-[88dvh] w-full min-w-0 max-w-md flex-col rounded-xl bg-surface p-4 shadow-card sm:p-5"
              >
                <h2 id="cifras-order-title" className="font-display text-xl font-semibold">
                  {tx("Orden de las cifras", "Order of the figures")}
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {emphasize(
                    tx(
                      "Sube o baja cada bloque. Orden de siempre prepara el orden original, pero no lo guarda solo. Al guardar, Estudio queda en ese orden en este teléfono. No se borra nada.",
                      "Move each block up or down. Usual order prepares the original order, but it does not save by itself. When you save, Stats stays in that order on this phone. Nothing is deleted.",
                    ),
                  )}
                </p>
                <Link
                  to="/manual"
                  search={{ t: "orden-cifras" }}
                  resetScroll={false}
                  className="mt-2 inline-block text-sm underline opacity-80"
                  onClick={() => {
                    setOpen(false);
                    rememberOrigin("/estadisticas");
                  }}
                >
                  {t("common.more")}
                </Link>
                <ol className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                  {draft.map((id, index) => (
                    <li key={id} className="flex min-w-0 items-center gap-1 rounded-sm bg-surface-2 px-2 py-1">
                      <span className="min-w-0 flex-1 text-sm font-semibold">{cifraLabel(id, tx)}</span>
                      <button
                        type="button"
                        aria-label={tx(`Subir ${cifraLabel(id, tx)}`, `Move ${cifraLabel(id, tx)} up`)}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        className="grid size-11 shrink-0 place-items-center rounded-full text-fg disabled:opacity-30"
                      >
                        <ChevronUp className="size-5" />
                      </button>
                      <button
                        type="button"
                        aria-label={tx(`Bajar ${cifraLabel(id, tx)}`, `Move ${cifraLabel(id, tx)} down`)}
                        disabled={index === draft.length - 1}
                        onClick={() => move(index, 1)}
                        className="grid size-11 shrink-0 place-items-center rounded-full text-fg disabled:opacity-30"
                      >
                        <ChevronDown className="size-5" />
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 grid gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      if (sameAsSaved()) setOpen(false);
                      else setAsk(true);
                    }}
                  >
                    {tx("Guardar", "Save")}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setDraft([...CIFRAS_DEFAULT])}>
                    {tx("Orden de siempre", "Usual order")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    {tx("Cancelar", "Cancel")}
                  </Button>
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
        description={tx(
          "Las cifras de esta pantalla se mostrarán en el orden que elegiste.",
          "The figures on this screen will show in the order you chose.",
        )}
        confirmLabel={tx("Sí, guardar", "Yes, save")}
        cancelLabel={tx("No, seguir editando", "No, keep editing")}
        onConfirm={() => {
          writeCifrasOrder(draft);
          setAsk(false);
          setOpen(false);
        }}
        onCancel={() => setAsk(false)}
      />
    </>
  );
}
