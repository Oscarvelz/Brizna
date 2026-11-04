import { Ban, Check, Clock, TriangleAlert } from "lucide-react";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ComputedStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: ComputedStatus }) {
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
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold tracking-tight",
        big ? "h-8 px-3 text-sm" : "h-7 px-2.5 text-xs",
        item.className,
      )}
    >
      <Icon className={big ? "size-4" : "size-3.5"} strokeWidth={2.4} />
      {item.label}
    </span>
  );
}
