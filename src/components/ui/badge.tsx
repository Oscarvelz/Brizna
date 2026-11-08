import { Ban, Check, Clock, TriangleAlert } from "lucide-react";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ComputedStatus } from "@/lib/types";

export function StatusBadge({
  status,
  band,
  compact,
}: {
  status: ComputedStatus;
  /** 1.5.12: full-width band (the settled card spec) instead of the pill chip. */
  band?: boolean;
  compact?: boolean;
}) {
  const tx = useTx();
  const map: Record<
    ComputedStatus,
    { label: string; className: string; icon: typeof Clock }
  > = {
    pending: {
      label: tx("Pendiente", "Pending"),
      className: "bg-pending-bg text-pending ring-1 ring-pending/30",
      icon: Clock,
    },
    late: {
      label: tx("Tarde", "Late"),
      className: "bg-late text-primary-fg",
      icon: TriangleAlert,
    },
    done: {
      label: tx("Realizado", "Done"),
      className: "bg-done-bg text-done ring-1 ring-done/30",
      icon: Check,
    },
    cancelled: {
      label: tx("Cancelado", "Cancelled"),
      className: "bg-surface-2 text-muted ring-1 ring-border",
      icon: Ban,
    },
  };
  const item = map[status];
  const Icon = item.icon;
  // 1.4.63 (Oscar): Tarde reads a bit larger than the other states
  const big = status === "late";
  if (band) {
    // 1.5.12 (spec 2026-11-04): the state closes the card as a full-width band, never a chip.
    // Pendiente keeps its original style exactly: pale amber ground, amber ring, dark amber ink, no gradient.
    return (
      <span
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-md font-semibold tracking-tight",
          compact ? "h-8 px-2 text-xs" : "h-9 px-3 text-sm",
          big && "bz-late-pulse", // 1.4.67 (Oscar): a calm "aquí estoy" halo behind Tarde
          item.className,
        )}
      >
        <Icon className={compact ? "size-3.5" : "size-4"} strokeWidth={2.4} />
        {item.label}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold tracking-tight",
        big ? "h-8 px-3 text-sm" : "h-7 px-2.5 text-xs",
        big && "bz-late-pulse", // 1.4.67 (Oscar): a calm "aquí estoy" halo behind Tarde
        item.className,
      )}
    >
      <Icon className={big ? "size-4" : "size-3.5"} strokeWidth={2.4} />
      {item.label}
    </span>
  );
}
