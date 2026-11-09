import { useEffect, useState } from "react";

export const CIFRAS_DEFAULT = [
  "pulso",
  "meta",
  // 1.5.54 (Oscar, censo de botones): «esfuerzo» va justo tras «meta» en el orden de fábrica,
  // para que la pareja quede pegada bajo «Este mes» también en la columna del teléfono.
  // Un orden ya guardado por el usuario no se toca: esto solo cambia el valor por defecto.
  "esfuerzo",
  "mes",
  "fiabilidad",
  "semana",
  "fijo",
  "hora",
  "calendario",
  "mejores",
  "precio",
  "propinas",
  "horas",
  "anio",
  "clientes",
  "pospuesto",
] as const;
// Removed in 1.4: "numeros" (its lifetime figures live in "anio"), "ritmo" (Días del año) and
// "semana-dinero" (its bars live in "semana"). A saved order that still names them simply skips them.

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
    case "meta":
      return tx("Meta del mes", "Month goal");
    case "fijo":
      return tx("Ingreso fijo del mes", "Steady monthly income");
    case "hora":
      return tx("$ por hora", "$ per hour");
    case "semana":
      return tx("Esta semana y la pasada", "This week vs. last");
    case "horas":
      return tx("Horas de trabajo", "Work hours");
    case "fiabilidad":
      return tx("Quién te debe", "Who owes you");
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
