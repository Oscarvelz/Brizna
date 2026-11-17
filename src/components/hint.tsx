import { closeAllSheets } from "@/lib/back-close";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowRight, CircleHelp, Lightbulb } from "lucide-react";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NameLink } from "@/components/name-jump";
import { useI18n, emphasize } from "@/lib/i18n";
import { findHint, pick } from "@/lib/manual/topics";
import { rememberOrigin } from "@/lib/manual/nav";
import { cn } from "@/lib/utils";

/* 1.6.39 (Prejuicio R11, R12D-2 — la cura de 1.6.38 nació ROTA y la
 * caza la probó): la marca de «esta burbuja mandó al alumno al
 * Manual» vive en el MÓDULO, no en la instancia. La versión anterior
 * la guardaba en un useRef de la burbuja, pero el clic navega a
 * /manual y el <Outlet/> desmonta la pantalla de origen: la
 * instancia moría con su ref y al volver nacía otra que no sabía
 * nada. El módulo no se recarga al navegar dentro de la SPA, así
 * que la marca sobrevive a la visita y la consume la burbuja del
 * mismo tema al remontar, solo con una lección viva en pantalla. */
let pendingHintReopen: string | null = null;
/* 1.6.54 (Prejuicio R14, R15D-1/R15D-2): la marca se ata a la
 * SESIÓN de la lección que la armó, y la jueza de los 900 ms se
 * retira. La jueza solo se sentaba donde una burbuja monta: la
 * vuelta que aterriza en una pantalla sin burbujas (Clima,
 * Fichero — salidas «go» del propio Manual) no citaba a nadie y
 * la marca, sin caducidad, se disparaba sola en una lección
 * posterior; y donde sí se sentaba, su fusible quemaba el
 * montaje tardío lícito de la burbuja dentro de un pliegue
 * cerrado, que monta cuando el alumno lo abre, no cuando la
 * pantalla pinta. La ley nueva no depende de qué monte ni de
 * cuándo: la marca guarda el número de sesión que la raíz de la
 * lección lleva estampado (data-pres-session, presentacion.tsx)
 * y solo puede consumirse con ESA MISMA sesión viva — una
 * lección posterior trae otro número y la marca muere en su
 * primer juicio, sin dispararse; dentro de la misma sesión, el
 * montaje perezoso de un pliegue es lícito a cualquier demora.
 * Si ninguna burbuja del tema vuelve a montar, la marca queda
 * armada pero inerte: no tiene ningún otro camino de disparo. */
let pendingHintSession: string | null = null;
const livePresRoot = (): Element | null =>
  typeof document !== "undefined"
    ? document.querySelector(".pres-root[role='dialog'], .pres-root:has(.pres-parked)")
    : null;
const livePresSession = (): string | null => livePresRoot()?.getAttribute("data-pres-session") ?? null;

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
  const entry = findHint(topic ?? manual);
  const body: ReactNode = text ?? (entry ? pick(locale, alt && entry.whatAlt ? entry.whatAlt : entry.what) : "");
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number; maxHeight: number; below: boolean; arrow: number } | null>(
    null,
  );
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const aria = label ?? t("hint.label");
  // 1.6.39 (R12D-2): al volver del Manual, la burbuja cuyo tema
  // coincide con la marca del módulo se reabre si hay una lección
  // viva (la raíz con diálogo o la barra aparcada) — el paso que
  // la enseña (show pista-burbuja) la espera viva; sin esto la
  // escena moría saltada en q6-pista y q6-mas.
  const myTopic = entry?.topic.id;
  useEffect(() => {
    if (pathname === "/manual" || !pendingHintReopen) return;
    if (pendingHintReopen !== myTopic) return;
    // 1.6.54 (R15D-1/R15D-2): la burbuja del tema juzga la marca
    // contra la sesión viva: solo abre si la lección que la armó
    // sigue viva (su raíz trae el mismo número estampado). En
    // cualquier otro caso — la lección terminó durante la visita,
    // la que vive es OTRA lección, o no vive ninguna — la marca
    // muere aquí, sin dispararse (la ley de 1.6.43, ahora con
    // identidad: antes una lección posterior del mismo tema la
    // consumía como si fuera la suya).
    const root = livePresRoot();
    const session = root?.getAttribute("data-pres-session") ?? null;
    pendingHintReopen = null;
    const armedSession = pendingHintSession;
    pendingHintSession = null;
    if (root && session === armedSession) setOpen(true);
  }, [pathname, myTopic]);

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
        data-present="pista-boton"
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
              data-present="pista-burbuja"
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
                        if (entry) { pendingHintReopen = entry.topic.id; pendingHintSession = livePresSession(); }
                        setOpen(false);
                        rememberOrigin(pathname);
                        closeAllSheets(() => void navigate({ to: "/manual", search: { t: entry.topic.id }, resetScroll: false }));
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
