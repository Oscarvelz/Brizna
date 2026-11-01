export type NameDest = {
  term: string;
  to: "/" | "/cobros" | "/agenda" | "/clientes" | "/ajustes" | "/estadisticas" | "/notas" | "/fichero" | "/login";
  search?: { view?: string; filter?: string };
  hash?: string;
};

const LINKS: Record<string, Omit<NameDest, "term">> = {
  Hoy: { to: "/" },
  Today: { to: "/" },
  Hecho: { to: "/" },
  Done: { to: "/" },
  Todos: { to: "/" },
  All: { to: "/" },
  "Hecho y cobrado": { to: "/" },
  "Hecho y pendiente": { to: "/" },
  "Hecho y abonado": { to: "/" },
  "Done and paid": { to: "/" },
  "Done and unpaid": { to: "/" },
  "Done with a partial payment": { to: "/" },
  Malla: { to: "/" },
  Mesh: { to: "/" },
  "Parar por lluvia": { to: "/" },
  "Stop for rain": { to: "/" },
  Cobros: { to: "/cobros" },
  Payments: { to: "/cobros" },
  "Por cobrar": { to: "/cobros", search: { view: "owing" }, hash: "lista" },
  "To collect": { to: "/cobros", search: { view: "owing" }, hash: "lista" },
  Cobrado: { to: "/cobros", search: { view: "collectedMonth" }, hash: "lista" },
  Collected: { to: "/cobros", search: { view: "collectedMonth" }, hash: "lista" },
  Abonos: { to: "/cobros", search: { view: "abonos" }, hash: "lista" },
  Abonado: { to: "/cobros", search: { view: "abonos" }, hash: "lista" },
  "Partial paid": { to: "/cobros", search: { view: "abonos" }, hash: "lista" },
  "Trabajo ya hecho": { to: "/cobros", hash: "lista" },
  "Work already done": { to: "/cobros", hash: "lista" },
  "Perdonado este mes": { to: "/cobros", search: { view: "waived" }, hash: "lista" },
  "Forgiven this month": { to: "/cobros", search: { view: "waived" }, hash: "lista" },
  Perdonar: { to: "/cobros", search: { view: "owing" }, hash: "lista" },
  Forgive: { to: "/cobros", search: { view: "owing" }, hash: "lista" },
  "En espera": { to: "/cobros", search: { view: "espera" }, hash: "lista" },
  Waiting: { to: "/cobros", search: { view: "espera" }, hash: "lista" },
  Pausa: { to: "/cobros", search: { view: "espera" }, hash: "lista" },
  Pause: { to: "/cobros", search: { view: "espera" }, hash: "lista" },
  Continuar: { to: "/cobros", search: { view: "espera" }, hash: "lista" },
  Play: { to: "/cobros", search: { view: "espera" }, hash: "lista" },
  Estudio: { to: "/estadisticas" },
  Study: { to: "/estadisticas" },
  Asesor: { to: "/estadisticas" },
  Advisor: { to: "/estadisticas" },
  Cifras: { to: "/estadisticas" },
  Figures: { to: "/estadisticas" },
  Propina: { to: "/estadisticas" },
  Tip: { to: "/estadisticas" },
  "Días del año": { to: "/estadisticas" },
  "Days in the year": { to: "/estadisticas" },
  "Días parados": { to: "/estadisticas", hash: "cif-horas" },
  "Stopped days": { to: "/estadisticas", hash: "cif-horas" },
  Agenda: { to: "/agenda" },
  Schedule: { to: "/agenda" },
  Calendario: { to: "/agenda" },
  Calendar: { to: "/agenda" },
  "Días libres de esta semana": { to: "/agenda", hash: "ag-libres" },
  "Days off this week": { to: "/agenda", hash: "ag-libres" },
  Clientes: { to: "/clientes" },
  Clients: { to: "/clientes" },
  Activos: { to: "/clientes", search: { filter: "active" } },
  Active: { to: "/clientes", search: { filter: "active" } },
  Permanentes: { to: "/clientes", search: { filter: "regular" } },
  "Una vez": { to: "/clientes", search: { filter: "one_time" } },
  Juntos: { to: "/clientes", search: { filter: "active" } },
  Archivos: { to: "/clientes", search: { filter: "inactive" } },
  Regular: { to: "/clientes", search: { filter: "regular" } },
  "One-time": { to: "/clientes", search: { filter: "one_time" } },
  Together: { to: "/clientes", search: { filter: "active" } },
  Archive: { to: "/clientes", search: { filter: "inactive" } },
  "Inventario de clientes": { to: "/clientes", hash: "inventario" },
  "Client inventory": { to: "/clientes", hash: "inventario" },
  Ajustes: { to: "/ajustes" },
  Settings: { to: "/ajustes" },
  "Alto riesgo": { to: "/ajustes", hash: "aj-espera" },
  "High risk": { to: "/ajustes", hash: "aj-espera" },
  "Temporada para todos": { to: "/ajustes", hash: "aj-temporada" },
  Sonidos: { to: "/ajustes", hash: "aj-sonidos" },
  Sounds: { to: "/ajustes", hash: "aj-sonidos" },
  Pantalla: { to: "/ajustes", hash: "aj-pantalla" },
  Tema: { to: "/ajustes", hash: "aj-pantalla" },
  Screen: { to: "/ajustes", hash: "aj-pantalla" },
  Theme: { to: "/ajustes", hash: "aj-pantalla" },
  Automático: { to: "/ajustes", hash: "aj-pantalla" },
  Automatic: { to: "/ajustes", hash: "aj-pantalla" },
  Notas: { to: "/notas" },
  Bloc: { to: "/notas" },
  Pad: { to: "/notas" },
  "Abrir bloc": { to: "/notas" },
  "Open pad": { to: "/notas" },
  "Bloc de notas": { to: "/notas" },
  Notepad: { to: "/notas" },
  Fichero: { to: "/fichero" },
  Cabinet: { to: "/fichero" },
  Filtros: { to: "/fichero" },
  "Mantener sesión abierta": { to: "/login" },
  "Keep me signed in": { to: "/login" },
};

const TERMS = Object.keys(LINKS).sort((a, b) => b.length - a.length);

export function nameLinkTerms(): readonly string[] {
  return TERMS;
}

export function nameDest(term: string): Omit<NameDest, "term"> | null {
  return LINKS[term] ?? null;
}

let current: NameDest | null = null;
const listeners = new Set<(jump: NameDest | null) => void>();

function emit() {
  for (const listen of listeners) listen(current);
}

export function askNameJump(term: string) {
  const dest = LINKS[term];
  if (!dest) return;
  current = { term, ...dest };
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
  if (!LINKS[term]) return <span className="name-ref">{term}</span>;
  return (
    <button
      type="button"
      className="name-ref"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        askNameJump(term);
      }}
    >
      {term}
    </button>
  );
}
