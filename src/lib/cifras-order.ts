import { useEffect, useState } from "react";

export const CIFRAS_DEFAULT = [
  "pulso",
  "mes",
  "fiabilidad",
  "esfuerzo",
  "semana",
  "calendario",
  "mejores",
  "precio",
  "propinas",
  "numeros",
  "semana-dinero",
  "horas",
  "ritmo",
  "anio",
  "clientes",
  "pospuesto",
] as const;

export type CifraId = (typeof CIFRAS_DEFAULT)[number];

const KEY = "ols-cifras-order";
const listeners = new Set<() => void>();

export function cifraLabel(id: CifraId, tx: (es: string, en: string) => string): string {
  switch (id) {
    case "pulso":
      return tx("Este mes", "This month");
    case "calendario":
      return tx("Días y temporadas", "Days and seasons");
    case "mejores":
      return tx("Mejores clientes", "Best clients");
    case "precio":
      return tx("Precio por trabajo", "Price per job");
    case "propinas":
      return tx("Propinas", "Tips");
    case "esfuerzo":
      return tx("Esfuerzo de la semana", "This week's effort");
    case "numeros":
      return tx("Números", "Numbers");
    case "semana":
      return tx("Esta semana frente a la anterior", "This week versus the previous one");
    case "horas":
      return tx("Horas de trabajo", "Work hours");
    case "ritmo":
      return tx("Días del año", "Days in the year");
    case "fiabilidad":
      return tx("Quién debe y desde cuándo", "Who owes and since when");
    case "semana-dinero":
      return tx("Dinero por semana", "Money by week");
    case "mes":
      return tx("Ingresos, mes a mes", "Income, month by month");
    case "anio":
      return tx("Cada año", "Each year");
    case "clientes":
      return tx("Clientes nuevos y bajas", "New clients and departures");
    case "pospuesto":
      return tx("Por qué se pospuso", "Why it was postponed");
  }
}

function isCifraId(value: unknown): value is CifraId {
  return typeof value === "string" && (CIFRAS_DEFAULT as readonly string[]).includes(value);
}

/** A saved order from an older version lacks the newer sections: each one goes in right
 *  after the section that comes before it in the usual order (or first), not at the end. */
function withNewSections(saved: CifraId[]): CifraId[] {
  const next = [...new Set(saved)];
  CIFRAS_DEFAULT.forEach((id, index) => {
    if (next.includes(id)) return;
    let at = 0;
    for (let k = index - 1; k >= 0; k -= 1) {
      const pos = next.indexOf(CIFRAS_DEFAULT[k]!);
      if (pos !== -1) { at = pos + 1; break; }
    }
    next.splice(at, 0, id);
  });
  return next;
}

export function readCifrasOrder(): CifraId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as unknown;
    if (!Array.isArray(raw)) return [...CIFRAS_DEFAULT];
    return withNewSections(raw.filter(isCifraId));
  } catch {
    return [...CIFRAS_DEFAULT];
  }
}

export function writeCifrasOrder(next: CifraId[]) {
  const clean = withNewSections(next.filter(isCifraId));
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

export function subscribeCifrasOrder(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useCifrasOrder(): CifraId[] {
  const [order, setOrder] = useState<CifraId[]>([...CIFRAS_DEFAULT]);
  useEffect(() => {
    setOrder(readCifrasOrder());
    return subscribeCifrasOrder(() => setOrder(readCifrasOrder()));
  }, []);
  return order;
}

export function useCifraRank(id: CifraId): number {
  const order = useCifrasOrder();
  const index = order.indexOf(id);
  return index === -1 ? CIFRAS_DEFAULT.indexOf(id) : index;
}
