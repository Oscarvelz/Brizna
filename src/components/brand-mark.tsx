import { cn } from "@/lib/utils";

/** Brizna logo drawn inline, so only the grass and the sun can move; the green tile stays still. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" aria-hidden="true" className={cn("bm", className)}>
      <rect width="256" height="256" rx="60" fill="#1f6a3a" />
      <g className="bm-sun">
        <circle cx="177.5" cy="76.5" r="26.5" fill="#f4c45c" />
      </g>
      <g fill="#efe8d6">
        <path className="bm-blade bm-blade-a" d="M84 189 L92 98 L104.5 189 Z" />
        <path className="bm-blade bm-blade-b" d="M120 189 L128.5 68 L143.5 189 Z" />
        <path className="bm-blade bm-blade-c" d="M157 189 L165 114 L176.5 189 Z" />
      </g>
      <rect x="45" y="186" width="165" height="10" rx="5" fill="#efe8d6" />
    </svg>
  );
}
