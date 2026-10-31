import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icon-512.png`}
      alt=""
      draggable={false}
      className={cn("object-contain", className)}
    />
  );
}
