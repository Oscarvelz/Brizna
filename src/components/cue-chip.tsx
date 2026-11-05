import { useState } from "react";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** "Pista · texto". `full` (client file) always shows the whole text, wrapping if it must; never an ellipsis. */
export function CueChip({ text, className, full = false }: { text: string; className?: string; full?: boolean }) {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  const whole = full || open;
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
