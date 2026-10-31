import { useState } from "react";
import { cn } from "@/lib/utils";

export function CueChip({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen((v) => !v);
      }}
      className={cn(
        "inline-flex max-w-full min-w-0 items-baseline rounded-full bg-soil-bg px-2 py-0.5 text-left text-[11px] leading-tight font-semibold text-soil",
        open ? "flex-wrap" : "max-w-[13rem]",
        className,
      )}
      aria-expanded={open}
    >
      <span className="shrink-0 font-medium text-soil/80">Pista · </span>
      <span className={cn("min-w-0", open ? "whitespace-normal break-words" : "truncate")}>{text}</span>
    </button>
  );
}
