import { useEffect, useState } from "react";

export const AJUSTES_DEFAULT = [
  "aj-nombre",
  "aj-pantalla",
  "aj-horas",
  "aj-espera",
  "aj-recordatorios",
  "aj-traductor",
  "aj-temporada",
  "aj-vacaciones",
  "aj-tableta",
  "aj-exportar",
  "aj-copia",
  "aj-ejemplo",
] as const;

export type AjusteId = (typeof AJUSTES_DEFAULT)[number];

const KEY = "ols-ajustes-order";
const listeners = new Set<() => void>();

export function ajusteLabel(id: AjusteId, tx: (es: string, en: string) => string): string {
  switch (id) {
    case "aj-nombre":
      return tx("Nombre del negocio", "Business name");
    case "aj-pantalla":
      return tx("Tema", "Theme");
    case "aj-horas":
      return tx("Horas de trabajo", "Work hours");
    case "aj-espera":
      return tx("Espera y riesgo", "Waiting and risk");
    case "aj-recordatorios":
      return tx("Recordatorios", "Reminders");
    case "aj-traductor":
      return tx("Traductor", "Translator");
    case "aj-temporada":
      return tx("Temporada", "Season");
    case "aj-vacaciones":
      return tx("Vacaciones", "Vacation");
    case "aj-tableta":
      return tx("Modo tableta", "Tablet mode");
    case "aj-exportar":
      return tx("Exportar e imprimir", "Export and print");
    case "aj-copia":
      return tx("Copia de seguridad", "Backup");
    case "aj-ejemplo":
      return tx("Datos de ejemplo", "Sample data");
  }
}

function isId(value: unknown): value is AjusteId {
  return typeof value === "string" && (AJUSTES_DEFAULT as readonly string[]).includes(value);
}

function mergeOrder(saved: AjusteId[]): AjusteId[] {
  const next = saved.filter((id, index) => saved.indexOf(id) === index);
  for (let index = 0; index < AJUSTES_DEFAULT.length; index += 1) {
    const id = AJUSTES_DEFAULT[index];
    if (!id || next.includes(id)) continue;
    const anchor = AJUSTES_DEFAULT.slice(0, index)
      .reverse()
      .find((prev) => next.includes(prev));
    const at = anchor ? next.indexOf(anchor) + 1 : 0;
    next.splice(at, 0, id);
  }
  return next;
}

export function readAjustesOrder(): AjusteId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as unknown;
    if (!Array.isArray(raw)) return [...AJUSTES_DEFAULT];
    // 1.4.1: "Hojas para imprimir" and "Exportar un tramo" became one export center (aj-exportar),
    // which keeps the place the first of the two had.
    const migrated = raw.map((id) => (id === "aj-hojas" ? "aj-exportar" : id));
    return mergeOrder(migrated.filter(isId));
  } catch {
    return [...AJUSTES_DEFAULT];
  }
}

export function writeAjustesOrder(next: AjusteId[]) {
  const clean = mergeOrder(next.filter(isId));
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useAjustesRank(id: string): number {
  const [order, setOrder] = useState<AjusteId[]>([...AJUSTES_DEFAULT]);
  useEffect(() => {
    setOrder(readAjustesOrder());
    return subscribe(() => setOrder(readAjustesOrder()));
  }, []);
  const index = order.indexOf(id as AjusteId);
  return index === -1 ? 40 : index;
}
