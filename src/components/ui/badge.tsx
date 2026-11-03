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
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold tracking-tight",
        item.className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.4} />
      {item.label}
    </span>
  );
}
