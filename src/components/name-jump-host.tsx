import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Info, MapPin } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { closeNameJump, subscribeNameJump, type NameDest } from "@/components/name-jump";
import { closeAllSheets, useBackClose } from "@/lib/back-close";
import { useI18n } from "@/lib/i18n";
import { rememberScroll, requestFocus } from "@/lib/manual/nav";
import { refCopy, refSelector, type Ref } from "@/lib/manual/refs";

/** Text that must not turn its own words into links again (the dialog line names the term). */
function Plain({ text }: { text: string }) {
  return <span>{text}</span>;
}

/**
 * 1.4.96: one host for every dotted link.
 *  · screen / flow → "¿Ir a …?" then the screen opens, glides to the button and lights it (flow: a note says what to tap).
 *  · trait → no "abrir": a small popover says it is a behavior and where it happens.
 */
export function NameJumpHost() {
  const [jump, setJump] = useState<NameDest | null>(null);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { locale } = useI18n();
  const en = locale === "en";
  useEffect(() => subscribeNameJump(setJump), []);

  const ref = jump?.ref ?? null;
  const term = jump?.term ?? "";
  const asks = ref != null && ref.kind !== "trait";
  const copy = ref && asks ? refCopy(term, ref, en) : null;

  function go(target: Ref) {
    const i = en ? 1 : 0;
    const to = target.to;
    if (!to) return;
    const same = to === pathname;
    if (!same) rememberScroll();
    if (target.view) {
      try {
        localStorage.setItem("bz-estudio-view", target.view);
      } catch {
        /* private mode */
      }
    }
    requestFocus({
      path: to,
      id: target.fold,
      sel: target.spot ? refSelector(target.spot) : undefined,
      alt: target.alt ? refSelector(target.alt) : undefined,
      note: target.note?.[i],
      missing: target.missing?.[i],
      same,
    });
    void navigate({ to, search: (target.search ?? {}) as never }).then(() => {
      if (same) window.dispatchEvent(new Event("bz-focus-run"));
    });
  }

  return (
    <>
      <ConfirmDialog
        front
        open={jump != null && asks}
        title={copy?.title ?? ""}
        description={copy ? <Plain text={copy.desc} /> : undefined}
        confirmLabel={copy?.yes}
        onConfirm={() => {
          const target = ref;
          if (!target) return closeNameJump();
          // close this question AND the dialog it came from, then go (history stays clean).
          closeAllSheets(() => {
            closeNameJump();
            go(target);
          });
        }}
        onCancel={closeNameJump}
      />
      {jump && ref?.kind === "trait" ? <TraitPop term={term} r={ref} anchor={jump.anchor} en={en} /> : null}
    </>
  );
}

function TraitPop({ term, r, anchor, en }: { term: string; r: Ref; anchor: NameDest["anchor"]; en: boolean }) {
  const i = en ? 1 : 0;
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useBackClose(true, closeNameJump);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!anchor) {
      setPos({ left: Math.round((vw - w) / 2), top: Math.round((vh - h) / 2) });
      return;
    }
    const below = anchor.y + anchor.h + 8 + h < vh - 16;
    const top = below ? anchor.y + anchor.h + 8 : Math.max(12, anchor.y - 8 - h);
    const left = Math.min(Math.max(12, anchor.x + anchor.w / 2 - w / 2), vw - w - 12);
    setPos({ left: Math.round(left), top: Math.round(top) });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNameJump();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const head = r.head?.[i] ?? (en ? "A behavior, not a button" : "Es un comportamiento, no un botón");
  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <button type="button" aria-label={en ? "Close" : "Cerrar"} className="absolute inset-0 cursor-default bg-transparent" onClick={closeNameJump} />
      <div
        ref={box}
        role="dialog"
        aria-label={term}
        className="bz-refpop"
        style={pos ? { transform: `translate(${pos.left}px, ${pos.top}px)` } : { visibility: "hidden" }}
      >
        <p className="bz-refpop-head">
          <Info aria-hidden />
          <span>{head}</span>
        </p>
        <p className="bz-refpop-t">
          <b>{term}</b>
          {": "}
          {r.trait?.[i]}
        </p>
        <div className="bz-refpop-foot">
          {r.where ? (
            <p className="bz-refpop-where">
              <MapPin aria-hidden />
              <span>{r.where[i]}</span>
            </p>
          ) : (
            <span className="flex-1" />
          )}
          <button type="button" className="bz-refpop-ok" onClick={closeNameJump}>
            {en ? "Got it" : "Entendido"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
