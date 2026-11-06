import { findRef, refTerms, type Ref } from "@/lib/manual/refs";

/** 1.4.96: what a dotted link names and what tapping it does (see lib/manual/refs.ts). */
export type NameDest = { term: string; ref: Ref; anchor: { x: number; y: number; w: number; h: number } | null };

const TERMS = refTerms().sort((a, b) => b.length - a.length);

export function nameLinkTerms(): readonly string[] {
  return TERMS;
}

export function nameDest(term: string): Ref | null {
  return findRef(term);
}

let current: NameDest | null = null;
const listeners = new Set<(jump: NameDest | null) => void>();

function emit() {
  for (const listen of listeners) listen(current);
}

export function askNameJump(term: string, from?: Element | null) {
  const ref = findRef(term);
  if (!ref) return;
  const r = from?.getBoundingClientRect();
  current = { term, ref, anchor: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null };
  emit();
}

export function closeNameJump() {
  current = null;
  emit();
}

export function subscribeNameJump(listen: (jump: NameDest | null) => void) {
  listeners.add(listen);
  return () => {
    listeners.delete(listen);
  };
}

export function NameLink({ term }: { term: string }) {
  const ref = findRef(term);
  if (!ref) return <span className="name-ref">{term}</span>;
  return (
    <button
      type="button"
      className={ref.kind === "trait" ? "name-ref is-trait" : "name-ref"}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        askNameJump(term, e.currentTarget);
      }}
    >
      {term}
    </button>
  );
}
