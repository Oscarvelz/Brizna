import { useNavigate } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n, emphasize } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Hint({
  text,
  label,
  manual,
  className,
  compact = false,
}: {
  text: ReactNode;
  label?: string;
  manual?: string;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
    null,
  );
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const aria = label ?? t("hint.label");

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => {
      const rect = btn.current!.getBoundingClientRect();
      const gutter = 12;
      const width = Math.min(280, Math.max(168, window.innerWidth - gutter * 2));
      let left = rect.left + rect.width / 2 - width / 2;
      left = Math.max(gutter, Math.min(left, window.innerWidth - width - gutter));
      const spaceBelow = window.innerHeight - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      const preferBelow = spaceBelow >= 88 || spaceBelow >= spaceAbove;
      const maxHeight = Math.max(64, Math.min(240, preferBelow ? spaceBelow : spaceAbove));
      const top = preferBelow ? rect.bottom + 8 : Math.max(gutter, rect.top - 8 - maxHeight);
      setBox({ top, left, width, maxHeight });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      const node = e.target as Node;
      if (btn.current?.contains(node)) return;
      const tip = document.getElementById(id);
      if (tip?.contains(node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, id]);

  return (
    <span className={cn("relative inline-flex shrink-0 align-middle", className)}>
      <button
        ref={btn}
        type="button"
        aria-label={aria}
        aria-expanded={open}
        aria-controls={id}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "relative z-10 grid place-items-center rounded-full text-subtle hover:bg-surface-2 hover:text-fg",
          compact ? "size-8" : "size-11",
        )}
      >
        <CircleHelp className="size-4" />
      </button>
      {open && box && typeof document !== "undefined"
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              style={{
                top: box.top,
                left: box.left,
                width: box.width,
                maxHeight: box.maxHeight,
              }}
              className="fixed z-[140] overflow-auto rounded-md bg-hint px-3 py-2 text-left text-xs leading-snug font-medium break-words text-hint-fg shadow-card"
            >
              {typeof text === "string" ? emphasize(text) : text}
              {manual ? (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => {
                    setOpen(false);
                    void navigate({ to: "/ajustes", hash: `ayuda-${manual}` });
                  }}
                  className="mt-2 block text-left underline opacity-80"
                >
                  {t("common.more")}
                </button>
              ) : null}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
