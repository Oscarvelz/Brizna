import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const SNAP = 72;

export function SwipeRow({
  children,
  leftActions,
  rightActions,
  className,
}: {
  children: ReactNode;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  className?: string;
}) {
  const [x, setX] = useState(0);
  const xRef = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const origin = useRef(0);
  const axis = useRef<"h" | "v" | null>(null);
  const dragging = useRef(false);
  const swiped = useRef(false);
  const leftWidth = leftActions ? 148 : 0;
  const rightWidth = rightActions ? 148 : 0;

  function clamp(v: number) {
    return Math.max(-rightWidth, Math.min(leftWidth, v));
  }

  function commit(next: number) {
    xRef.current = next;
    setX(next);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    origin.current = xRef.current;
    axis.current = null;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (!axis.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (axis.current === "v") return;
    }
    if (axis.current === "v") return;
    swiped.current = true;
    e.preventDefault();
    commit(clamp(origin.current + dx));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (axis.current !== "h") {
      axis.current = null;
      return;
    }
    axis.current = null;
    const cur = xRef.current;
    if (cur > SNAP && leftWidth) commit(leftWidth);
    else if (cur < -SNAP && rightWidth) commit(-rightWidth);
    else commit(0);
  }

  return (
    // 1.4.67 (Oscar): a sideways drag that starts on the card belongs to the card (its Baja/Borrar),
    // never to the screen-to-screen swipe; the page swipe ignores touches inside [data-swipe-own].
    // 1.4.77 (Oscar): the action layers sit under the card's rounded corners; at rest their colour bled through the
    // anti-aliased corner pixels as a red/amber arc on the right edge. They are hidden until the card moves
    // (and stay visible until it has slid back: .bz-swipe-act hides after the 180 ms return).
    <div className={cn("bz-swipe relative overflow-hidden rounded-xl touch-pan-y", x !== 0 && "is-open", className)} data-swipe-own data-present="tarjeta-cliente">
      {leftActions ? (
        <div className="bz-swipe-act absolute inset-y-0 left-0 flex w-36 items-stretch">{leftActions}</div>
      ) : null}
      {rightActions ? (
        <div className="bz-swipe-act absolute inset-y-0 right-0 flex w-36 items-stretch">{rightActions}</div>
      ) : null}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (swiped.current || Math.abs(xRef.current) > 8) {
            e.preventDefault();
            e.stopPropagation();
            swiped.current = false;
            commit(0);
          }
        }}
        style={{
          transform: `translate3d(${x}px,0,0)`,
          transition: dragging.current && axis.current === "h" ? "none" : "transform 180ms var(--ease-out-smooth)",
        }}
        className="bz-swipe-face relative z-10 will-change-transform"
      >
        {children}
      </div>
    </div>
  );
}
