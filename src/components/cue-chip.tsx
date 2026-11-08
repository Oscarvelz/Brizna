import { useState } from "react";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** "Pista · texto". `full` (client file) always shows the whole text, wrapping if it must; never an ellipsis.
 *  `bubble` (1.5.20, Oscar, for Lista rows): the row never tries to fit the cue text — the bubble says only
 *  «Pista» and a tap opens the cue in a card, where it has all the room it needs. */
export function CueChip({ text, className, full = false, bubble = false, name }: { text: string; className?: string; full?: boolean; bubble?: boolean; name?: string }) {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  const whole = full || open;
  if (bubble) {
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className={cn(
            "bz-cue inline-flex shrink-0 items-baseline rounded-full bg-soil-bg px-2 py-0.5 text-left text-[11px] leading-tight font-semibold text-soil",
            className,
          )}
          aria-haspopup="dialog"
        >
          <span className="font-medium text-soil/80">{tx("Pista", "Cue")}</span>
        </button>
        {open ? (
          <div
            className="fixed inset-0 z-[80] grid place-items-end overflow-y-auto p-3 sm:place-items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label={tx("Pista", "Cue")}
          >
            <button type="button" aria-hidden tabIndex={-1} className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <div className="relative w-full max-w-md rounded-xl bg-surface p-4 shadow-card">
              <h3 className="font-display text-lg font-semibold">{tx("Pista", "Cue")}</h3>
              {name ? <p className="mt-0.5 text-sm font-medium text-muted">{name}</p> : null}
              <p className="mt-2 text-sm leading-relaxed whitespace-normal break-words">{text}</p>
              <button
                type="button"
                className="mt-4 w-full rounded-md bg-sun px-3 py-2 text-sm font-semibold"
                onClick={() => setOpen(false)}
              >
                {tx("Cerrar", "Close")}
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!full) setOpen((v) => !v);
      }}
      className={cn(
        "bz-cue inline-flex max-w-full min-w-0 items-baseline gap-1 rounded-full bg-soil-bg px-2 py-0.5 text-left text-[11px] leading-tight font-semibold text-soil",
        whole ? "flex-wrap" : "max-w-[13rem]",
        className,
      )}
      aria-expanded={full ? undefined : open}
    >
      <span className="shrink-0 font-medium text-soil/80">{tx("Pista", "Cue")}</span>
      <span className="shrink-0 text-soil/60" aria-hidden>
        ·
      </span>
      <span className={cn("min-w-0", whole ? "whitespace-normal break-words" : "truncate")}>{text}</span>
    </button>
  );
}
