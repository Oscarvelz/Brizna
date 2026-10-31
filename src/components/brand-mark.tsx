import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/__grok/icon-512.png"
      alt=""
      draggable={false}
      className={cn("object-contain", className)}
    />
  );
}
