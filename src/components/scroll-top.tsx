import { ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ScrollTop({ lift = false, aboveFab = false }: { lift?: boolean; aboveFab?: boolean }) {
  const tx = useTx();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label={tx("Subir", "Go up")}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        // 1.4.68 (Oscar): same round button as the View button on the left (.bz-roundfab: size, ring, icon,
        // surface), mirrored from the right edge on the same row; on Hoy/Clientes it stays centered over the +.
        "bz-roundfab bz-scrolltop fixed z-30",
        aboveFab && "is-above",
        aboveFab
          ? "right-[1.625rem] bottom-[calc(9.75rem+var(--bz-chin))]"
          : lift
            ? "right-3 bottom-[calc(9.125rem+var(--bz-chin))]"
            : "right-3 bottom-[calc(5.875rem+var(--bz-chin))]",
      )}
    >
      <ChevronUp />
    </button>
  );
}
