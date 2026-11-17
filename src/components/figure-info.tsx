import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useTx } from "@/lib/i18n";
import { rememberOrigin } from "@/lib/manual/nav";
import { cn } from "@/lib/utils";

/** 1.6.34 (Oscar, la ola del censo de cifras): la tarjeta que abre una
 *  cifra al tocarla. La ley: todo número que no se explica solo se
 *  explica al tocarlo, en lenguaje sencillo — qué es y de dónde sale.
 *  La forma es la de la casa (la tarjetita del estado del trabajo):
 *  una tarjeta breve y diseñada, no texto suelto; y cuando el Manual
 *  lleva la fórmula entera, la tarjeta cierra con su puerta. */
export type Figure = { title: string; body: string; topic?: string };

export function FigureInfo({ figure, onClose }: { figure: Figure; onClose: () => void }) {
  const tx = useTx();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-6 backdrop-blur-[2px]" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-xs overflow-hidden rounded-3xl bg-surface shadow-2xl ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={figure.title}
      >
        <div className="h-1.5 w-full bg-primary" aria-hidden />
        <div className="p-5">
          <p className="font-display text-lg font-semibold leading-tight tracking-tight">{figure.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-fg/90">{figure.body}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            {figure.topic ? (
              <button
                type="button"
                className="text-sm font-semibold text-primary touch-manipulation"
                onClick={() => {
                  rememberOrigin(pathname);
                  onClose();
                  void navigate({ to: "/manual", search: { t: figure.topic }, resetScroll: false });
                }}
              >
                {tx("Más en el manual →", "More in the manual →")}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white touch-manipulation"
              onClick={onClose}
            >
              {tx("Cerrar", "Close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** El estado de la cifra abierta en una superficie: `openFigure(fig)`
 *  desde el toque de la cifra, y `figureNode` al final del árbol. */
export function useFigureInfo(): { openFigure: (fig: Figure) => void; figureNode: ReactNode } {
  const [fig, setFig] = useState<Figure | null>(null);
  return {
    openFigure: setFig,
    figureNode: fig ? <FigureInfo figure={fig} onClose={() => setFig(null)} /> : null,
  };
}

/** El envoltorio del toque: la cifra conserva su cara y gana el gesto.
 *  Dentro de una tarjeta que ya navega, el toque se queda con la
 *  explicación (stopPropagation + preventDefault) — la cifra manda. */
export function FigureTap({
  onTap,
  className,
  children,
  label,
}: {
  onTap: () => void;
  className?: string;
  children: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn("touch-manipulation cursor-pointer", className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onTap();
      }}
    >
      {children}
    </button>
  );
}
