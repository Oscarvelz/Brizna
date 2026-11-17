import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * La puerta de «Nota nueva» del Bloc, en sus dos cuerpos: el botón flotante
 * del teléfono y la fila de la lista del escritorio. Un solo elemento en el
 * código (la ley de las anclas: una moneda, un elemento) — 1.6.12
 * (Prejuicio R3, R4D-3): antes el ancla `nota-nueva` solo existía en el
 * cuerpo del teléfono y la escena ad11-crear no podía correr en pantallas
 * anchas, donde el Bloc vive en modo escritorio.
 */
export function NewNoteButton({
  variant,
  onPress,
  label,
  drafting = false,
  draftTitle = "",
  newLabel,
  writingLabel,
}: {
  variant: "floating" | "row";
  onPress: () => void;
  /** aria-label de la forma flotante. */
  label: string;
  drafting?: boolean;
  draftTitle?: string;
  /** El texto de la fila («Nota nueva»). */
  newLabel: string;
  /** La coletilla de la fila mientras se escribe («Escribiendo»). */
  writingLabel: string;
}) {
  const floating = variant === "floating";
  return (
    <button
      type="button"
      data-present="nota-nueva"
      onClick={onPress}
      className={
        floating
          ? "fixed right-4 bottom-[calc(5.25rem+var(--bz-chin))] z-20 grid size-14 place-items-center rounded-full bg-primary text-primary-fg shadow-card md:bottom-6"
          : cn("bz-nb-new", drafting && "is-on")
      }
      aria-label={floating ? label : undefined}
      aria-current={!floating && drafting ? "true" : undefined}
    >
      {floating ? (
        <Plus className="size-6" />
      ) : (
        <>
          <Plus className="size-4.5 shrink-0" aria-hidden />
          <span className="bz-nb-row-title">{drafting ? draftTitle.trim() || newLabel : newLabel}</span>
          {drafting ? <span className="bz-nb-row-day">{writingLabel}</span> : null}
        </>
      )}
    </button>
  );
}
