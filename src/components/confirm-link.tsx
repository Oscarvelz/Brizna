import { useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ConfirmLink({
  href,
  kind,
  name,
  label,
  className,
  children,
  onLongPress,
}: {
  href: string;
  kind: "call" | "maps" | "sms";
  name?: string;
  label?: string;
  className?: string;
  children: ReactNode;
  /** 1.5.18 (Oscar): optional press-and-hold action (the job card's map button reveals the hidden
   * address). When it fires, the click that ends the press is swallowed — the confirm never opens. */
  onLongPress?: () => void;
}) {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const clearPress = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const who = name ? ` ${name}` : "";
  const copy =
    kind === "call"
      ? {
          title: tx(`¿Llamar${name ? ` a ${name}` : ""}?`, `Call${who}?`),
          description: tx("Así no se llama a otro cliente por error.", "So you do not call the wrong client."),
          confirm: tx("Sí, llamar", "Yes, call"),
        }
      : kind === "sms"
        ? {
            title: tx(`¿Escribir${name ? ` a ${name}` : ""}?`, `Text${who}?`),
            description: tx(
              "Se abre Mensajes de Google (o la app de SMS) con este cliente.",
              "Opens Messages (or the phone's SMS app) for this client.",
            ),
            confirm: tx("Sí, abrir mensajes", "Yes, open messages"),
          }
        : {
            title: tx("¿Abrir el mapa?", "Open the map?"),
            description: tx("Se abre Google Maps con esta dirección.", "Opens Google Maps with this address."),
            confirm: tx("Sí, abrir", "Yes, open"),
          };
  return (
    <>
      <button
        type="button"
        aria-label={label}
        className={cn("text-left", className)}
        onClick={() => {
          if (longFired.current) {
            longFired.current = false;
            return;
          }
          setOpen(true);
        }}
        onPointerDown={
          onLongPress
            ? () => {
                longFired.current = false;
                clearPress();
                pressTimer.current = window.setTimeout(() => {
                  longFired.current = true;
                  onLongPress();
                }, 550);
              }
            : undefined
        }
        onPointerUp={onLongPress ? clearPress : undefined}
        onPointerLeave={onLongPress ? clearPress : undefined}
        onPointerCancel={onLongPress ? clearPress : undefined}
        onContextMenu={onLongPress ? (e) => e.preventDefault() : undefined}
      >
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title={copy.title}
        description={copy.description}
        confirmLabel={copy.confirm}
        onConfirm={() => {
          setOpen(false);
          if (kind === "maps") window.open(href, "_blank", "noopener,noreferrer");
          else window.location.href = href;
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
