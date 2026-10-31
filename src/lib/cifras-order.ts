import { useEffect, useState } from "react";

export const CIFRAS_DEFAULT = [
  "esfuerzo",
  "numeros",
  "semana",
  "horas",
  "ritmo",
  "fiabilidad",
  "semana-dinero",
  "mes",
  "anio",
  "clientes",
  "pospuesto",
] as const;

export type CifraId = (typeof CIFRAS_DEFAULT)[number];

const KEY = "ols-cifras-order";
const listeners = new Set<() => void>();

export function cifraLabel(id: CifraId, tx: (es: string, en: string) => string): string {
  switch (id) {
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
      return tx("Fiabilidad de pago", "Payment reliability");
    case "semana-dinero":
      return tx("Dinero por semana", "Money by week");
    case "mes":
      return tx("Dinero por mes", "Money by month");
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

export function readCifrasOrder(): CifraId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as unknown;
    if (!Array.isArray(raw)) return [...CIFRAS_DEFAULT];
    const next = raw.filter(isCifraId);
    for (const id of CIFRAS_DEFAULT) if (!next.includes(id)) next.push(id);
    return next;
  } catch {
    return [...CIFRAS_DEFAULT];
  }
}

export function writeCifrasOrder(next: CifraId[]) {
  const clean = next.filter(isCifraId);
  for (const id of CIFRAS_DEFAULT) if (!clean.includes(id)) clean.push(id);
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
