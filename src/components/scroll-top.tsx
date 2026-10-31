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
        "fixed right-2 z-30 grid size-10 place-items-center rounded-full bg-surface/90 text-muted shadow-card ring-1 ring-border",
        aboveFab
          ? "right-6 bottom-[calc(9.25rem+var(--bz-chin))]"
          : lift
            ? "right-2 bottom-36"
            : "right-2 bottom-24",
      )}
    >
      <ChevronUp className="size-5" />
    </button>
  );
}
