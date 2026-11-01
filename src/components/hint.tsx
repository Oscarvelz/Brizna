import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowRight, CircleHelp, Lightbulb } from "lucide-react";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NameLink } from "@/components/name-jump";
import { useI18n, emphasize } from "@/lib/i18n";
import { findTopic, pick } from "@/lib/manual/topics";
import { rememberOrigin } from "@/lib/manual/nav";
import { cn } from "@/lib/utils";

/** Manual/hint text: [[Term]] is an explicit link to that place in the app; known names get emphasis. */
export function richText(text: string): ReactNode {
  if (!text.includes("[[")) return emphasize(text);
  return text.split(/(\[\[[^\]]+\]\])/g).map((part, i) =>
    part.startsWith("[[") && part.endsWith("]]") ? (
      <NameLink key={i} term={part.slice(2, -2)} />
    ) : (
      <Fragment key={i}>{emphasize(part)}</Fragment>
    ),
  );
}

/**
 * The (?) bubble. Give it a `topic`: its text comes from the manual (lib/manual/topics.ts), word for
 * word, and "Más en el manual" opens that exact entry. `text` is only for a bubble with no entry.
 */
export function Hint({
  topic,
  text,
  alt = false,
  label,
  manual,
  className,
  compact = false,
}: {
  topic?: string;
  text?: ReactNode;
  /** Use the topic's second text (e.g. while paused). */
  alt?: boolean;
  label?: string;
  /** @deprecated old name for `topic`. */
  manual?: string;
  className?: string;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const entry = findTopic(topic ?? manual);
  const body: ReactNode = text ?? (entry ? pick(locale, alt && entry.whatAlt ? entry.whatAlt : entry.what) : "");
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number; maxHeight: number; below: boolean; arrow: number } | null>(
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
      const width = Math.min(300, Math.max(180, window.innerWidth - gutter * 2));
      let left = rect.left + rect.width / 2 - width / 2;
      left = Math.max(gutter, Math.min(left, window.innerWidth - width - gutter));
      const spaceBelow = window.innerHeight - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      const preferBelow = spaceBelow >= 88 || spaceBelow >= spaceAbove;
      const maxHeight = Math.max(64, Math.min(240, preferBelow ? spaceBelow : spaceAbove));
      const top = preferBelow ? rect.bottom + 6 : Math.max(gutter, rect.top - 6 - maxHeight);
      const arrow = Math.max(18, Math.min(width - 18, rect.left + rect.width / 2 - left));
      setBox({ top, left, width, maxHeight, below: preferBelow, arrow });
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
    <span data-topic={entry?.id} className={cn("relative inline-flex shrink-0 align-middle", className)}>
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
          "bz-hint-btn relative z-10 grid place-items-center rounded-full text-subtle transition-colors hover:bg-surface-2 hover:text-fg",
          open && "is-open",
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
              data-side={box.below ? "below" : "above"}
              style={{
                top: box.below ? box.top : undefined,
                bottom: box.below ? undefined : window.innerHeight - (box.top + box.maxHeight),
                left: box.left,
                width: box.width,
                ["--bz-arrow" as string]: `${box.arrow}px`,
              }}
              className="bz-hint fixed z-[140]"
            >
              <span className="bz-hint-arrow" aria-hidden />
              <span className="bz-hint-body" style={{ maxHeight: box.maxHeight }}>
                <span className="bz-hint-icon" aria-hidden>
                  <Lightbulb className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{typeof body === "string" ? richText(body) : body}</span>
                  {entry ? (
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={() => {
                        setOpen(false);
                        rememberOrigin(pathname);
                        void navigate({ to: "/manual", search: { t: entry.id }, resetScroll: false });
                      }}
                      className="bz-hint-more"
                    >
                      {t("common.more")}
                      <ArrowRight className="size-3" />
                    </button>
                  ) : null}
                </span>
              </span>
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
