import type { QuadCols } from "@/lib/density";
import { cn } from "@/lib/utils";

export function MeshName({ name, cols, className }: { name: string; cols: QuadCols; className?: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? name;
  const rest = parts.slice(1).join(" ");
  if (cols >= 3) {
    return (
      <span className={cn("block min-w-0 font-semibold leading-tight", className)}>
        <span className="block break-words text-xs">{first}</span>
        {rest ? <span className="block break-words text-[11px] font-medium leading-tight">{rest}</span> : null}
      </span>
    );
  }
  return <span className={cn("block break-words text-xs font-semibold leading-snug", className)}>{name}</span>;
}
