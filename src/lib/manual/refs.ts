/**
 * 1.4.96 (Oscar: "Hay botones que son difíciles de encontrar…"). Every dotted link in a (?) bubble, the manual or a
 * dialog names something in the app. This table says what kind of thing it is and what tapping it does:
 *
 *  - "screen": it is on a screen. Ask "¿Ir a …?", open the screen (and the view/fold it sits in), glide to it and
 *    light it ("aquí estoy"). If the exact button is not there right now (no data yet), light `alt` and say why.
 *  - "flow": it lives inside a dialog, a sheet or a step that only opens after an action. Light the button that
 *    starts that flow and say, near it, what to tap ("Continuar aparece al tocar …"). Data never changes.
 *  - "trait": it is a behavior or a property, not a button. No "abrir": a small popover explains it and where it
 *    happens.
 *
 * Pure data (no JSX): `npm run lint:manual` checks that every link term has an entry and every target exists.
 * `spot`/`alt`: "@token" = [data-spot~=token] or [data-ref~=token]; "#id" = element id; otherwise a CSS selector.
 */

export type L = readonly [string, string];

export type RefPath = "/" | "/cobros" | "/agenda" | "/clientes" | "/ajustes" | "/estadisticas" | "/notas" | "/fichero";

export type RefKind = "screen" | "flow" | "trait";

export type Ref = {
  kind: RefKind;
  to?: RefPath;
  search?: { view?: string; filter?: string };
  /** Estudio screen view to show first. */
  view?: "estudio" | "asesor";
  /** The element to light. */
  spot?: string;
  /** Fold (element id) to open first. */
  fold?: string;
  /** What to light when the exact element is not on screen right now. */
  alt?: string;
  /** The words after "¿Ir …?" / "Go …?": "a Cobros", "al botón Hecho". */
  go?: L;
  /** Dialog line under the title (short). */
  desc?: L;
  /** Flow: the line shown near the lit button. */
  note?: L;
  /** Shown near `alt` when the exact element is not there right now. */
  missing?: L;
  /** Trait: what it is (popover). */
  trait?: L;
  /** Trait: where it happens (popover). */
  where?: L;
  /** Trait popover headline (default: "Es un comportamiento, no un botón."). */
  head?: L;
};

/** A screen's title in the header: the "aquí estoy" for a whole screen. */
const TITLE = ".pod-header h1";

const screen = (to: RefPath, go: L, extra: Partial<Ref> = {}): Ref => ({ kind: "screen", to, spot: TITLE, go, ...extra });

/** Each entry: every word that links to it (both languages), then what it is. */
export const REFS: ReadonlyArray<readonly [readonly string[], Ref]> = [
  /* ------------------------------------------------------------- Hoy */
  [["Hoy", "Today"], screen("/", ["a Hoy", "to Today"])],
  [
    ["Hecho", "Done"],
    {
      kind: "screen",
      to: "/",
      spot: "@hecho",
      alt: "@hoy",
      go: ["al botón Hecho", "to the Done button"],
      missing: ["Hecho aparece en cada patio de hoy. Hoy no hay patios pendientes.", "Done shows on each of today's yards. Nothing is pending today."],
    },
  ],
  [
    ["Todos", "All"],
    {
      kind: "screen",
      to: "/",
      spot: "@todos",
      alt: "@hoy",
      go: ["al botón Todos", "to the All button"],
      missing: ["Todos aparece cuando hoy hay dos patios o más.", "All shows when today has two yards or more."],
    },
  ],
  ...(
    [
      [["Hecho y cobrado", "Done and paid"], ["Hecho y cobrado", "Done and paid"]],
      [["Hecho y pendiente", "Done and unpaid"], ["Hecho y pendiente", "Done and unpaid"]],
      [["Hecho y abonado", "Done with a partial payment"], ["Hecho y abonado", "Done with a partial payment"]],
    ] as const
  ).map(
    ([terms, name]) =>
      [
        terms,
        {
          kind: "flow",
          to: "/",
          spot: "@hecho",
          alt: "@hoy",
          go: ["al botón Hecho", "to the Done button"],
          desc: [`${name[0]} aparece al tocar Hecho.`, `${name[1]} shows when you tap Done.`],
          note: [`${name[0]} aparece al tocar Hecho.`, `${name[1]} shows when you tap Done.`],
          missing: [`${name[0]} aparece al tocar Hecho en un patio de hoy. Hoy no hay patios pendientes.`, `${name[1]} shows when you tap Done on one of today's yards. Nothing is pending today.`],
        },
      ] as const,
  ),
  [
    ["Propina", "Tip"],
    {
      kind: "flow",
      to: "/",
      spot: "@propina",
      alt: "@hoy",
      go: ["al botón Hecho", "to the Done button"],
      desc: ["La propina se anota al tocar Hecho.", "The tip is written down when you tap Done."],
      note: ["La propina se anota al tocar Hecho.", "The tip is written down when you tap Done."],
      missing: ["La propina se anota al tocar Hecho en un patio de hoy. Hoy no hay patios pendientes.", "The tip is written down when you tap Done on one of today's yards. Nothing is pending today."],
    },
  ],
  [["Malla", "Grid", "Mesh"], { kind: "screen", to: "/", spot: "@vistas", go: ["a las vistas de Hoy", "to Today's views"] }],
  [["Parar por lluvia", "Stop for rain"], { kind: "screen", to: "/", spot: "@parar-dia", go: ["a Parar por lluvia", "to Stop for rain"] }],

  /* ---------------------------------------------------------- Cobros */
  [["Cobros", "Payments"], screen("/cobros", ["a Cobros", "to Payments"])],
  [["Por cobrar", "To collect"], { kind: "screen", to: "/cobros", search: { view: "owing" }, spot: "@por-cobrar", go: ["a Por cobrar", "to To collect"] }],
  [["Cobrado", "Collected"], { kind: "screen", to: "/cobros", search: { view: "collectedMonth" }, spot: "@cobrado", go: ["a Cobrado", "to Collected"] }],
  [["Abonos", "Abonado", "Partial paid"], { kind: "screen", to: "/cobros", search: { view: "abonos" }, spot: "@abonos", alt: "@por-cobrar", go: ["a Abonos", "to Partial payments"], missing: ["Abonos está dentro de Por cobrar, debajo del total.", "Partial payments sits inside To collect, under the total."] }],
  [["Trabajo ya hecho", "Work already done"], { kind: "screen", to: "/cobros", spot: "#cob-hecho", go: ["a Trabajo ya hecho", "to Work already done"] }],
  [["Perdonado este mes", "Forgiven this month"], { kind: "screen", to: "/cobros", search: { view: "waived" }, spot: "#cob-perdonado", go: ["a Perdonado este mes", "to Forgiven this month"] }],
  [["En espera", "Waiting"], { kind: "screen", to: "/cobros", search: { view: "espera" }, spot: "#cob-espera", go: ["a En espera", "to Waiting"] }],
  [
    ["Perdonar", "Forgive"],
    {
      kind: "screen",
      to: "/cobros",
      search: { view: "owing" },
      spot: ".bz-cact.is-forgive",
      alt: "@por-cobrar",
      go: ["al botón Perdonar", "to the Forgive button"],
      missing: ["Perdonar aparece en cada deuda de Por cobrar. Ahora nadie debe.", "Forgive shows on each debt in To collect. Nobody owes right now."],
    },
  ],
  [
    ["Pausa", "Pause"],
    {
      kind: "screen",
      to: "/cobros",
      search: { view: "owing" },
      spot: "@pausa",
      alt: "@por-cobrar",
      go: ["al botón Pausa", "to the Pause button"],
      missing: ["Pausa aparece en cada deuda de Por cobrar y en la ficha del cliente. Ahora nadie debe.", "Pause shows on each debt in To collect and on the client file. Nobody owes right now."],
    },
  ],
  [
    ["Continuar", "Play"],
    {
      kind: "flow",
      to: "/cobros",
      search: { view: "espera" },
      spot: "@continuar",
      alt: "#cob-espera",
      go: ["a En espera", "to Waiting"],
      desc: ["Continuar está en cada patio en pausa.", "Play is on each paused yard."],
      missing: ["Continuar aparece en un patio en pausa. Primero toca Pausa en una deuda de Por cobrar.", "Play shows on a paused yard. First tap Pause on a debt in To collect."],
    },
  ],

  /* --------------------------------------------------------- Estudio */
  [["Estudio", "Stats", "Study"], { kind: "screen", to: "/estadisticas", view: "estudio", spot: "@estudio", go: ["a Estudio", "to Stats"] }],
  [["Cifras", "Figures"], { kind: "screen", to: "/estadisticas", view: "estudio", spot: "@estudio", go: ["a Cifras", "to Figures"] }],
  [["Asesor", "Advisor"], { kind: "screen", to: "/estadisticas", view: "asesor", spot: "@asesor", alt: "@estudio", go: ["al Asesor", "to the Advisor"], missing: ["El Asesor se abre con este botón, a la derecha.", "The Advisor opens with this button, on the right."] }],
  [["Días parados", "Stopped days"], { kind: "screen", to: "/estadisticas", view: "estudio", spot: "#cif-horas", fold: "cif-horas", go: ["a Días parados", "to Stopped days"] }],

  /* ---------------------------------------------------------- Agenda */
  [["Agenda", "Schedule", "Calendario", "Calendar"], screen("/agenda", ["a la Agenda", "to the Schedule"])],
  [["Días libres de esta semana", "Días libres", "Days off this week"], { kind: "screen", to: "/agenda", spot: "#ag-libres", go: ["a Días libres", "to Days off"] }],

  /* -------------------------------------------------------- Clientes */
  [["Clientes", "Clients"], screen("/clientes", ["a Clientes", "to Clients"])],
  [["Activos", "Active"], { kind: "screen", to: "/clientes", search: { filter: "active" }, spot: "@clientes-filtros", go: ["a Clientes activos", "to Active clients"] }],
  [["Permanentes", "Regular"], { kind: "screen", to: "/clientes", search: { filter: "regular" }, spot: "@inv-regular", alt: "@clientes-filtros", missing: ["Permanentes está en el Inventario de clientes y en este filtro.", "Regular is in the Client inventory and in this filter."], go: ["a Permanentes", "to Regular"] }],
  [["Una vez", "One-time"], { kind: "screen", to: "/clientes", search: { filter: "one_time" }, spot: "@inv-once", alt: "@clientes-filtros", missing: ["Una vez está en el Inventario de clientes y en este filtro.", "One-time is in the Client inventory and in this filter."], go: ["a Una vez", "to One-time"] }],
  [["Juntos", "Together"], { kind: "screen", to: "/clientes", search: { filter: "active" }, spot: "@inv-all", alt: "@clientes-filtros", missing: ["Juntos está en el Inventario de clientes y en este filtro.", "Together is in the Client inventory and in this filter."], go: ["a Juntos", "to Together"] }],
  [["Archivos", "Archive"], { kind: "screen", to: "/clientes", search: { filter: "inactive" }, spot: "@inv-archive", alt: "@clientes-filtros", missing: ["Archivos está en el Inventario de clientes y en este filtro.", "Archive is in the Client inventory and in this filter."], go: ["a Archivos", "to Archive"] }],
  [["Inventario de clientes", "Client inventory"], { kind: "screen", to: "/clientes", spot: "#inventario", go: ["al Inventario de clientes", "to the Client inventory"] }],

  /* --------------------------------------------------------- Ajustes */
  [["Ajustes", "Settings"], screen("/ajustes", ["a Ajustes", "to Settings"])],
  [["Alto riesgo", "High risk"], { kind: "screen", to: "/ajustes", spot: "#aj-espera", fold: "aj-espera", go: ["a Espera y alto riesgo", "to Waiting and high risk"] }],
  [["Temporada para todos"], { kind: "screen", to: "/ajustes", spot: "#aj-temporada", fold: "aj-temporada", go: ["a Temporada para todos", "to Season for everyone"] }],
  [["Sonidos", "Sounds"], { kind: "screen", to: "/ajustes", spot: "#aj-sonidos", fold: "aj-sonidos", go: ["a Sonidos", "to Sounds"] }],
  [["Pantalla", "Tema", "Screen", "Theme", "Automático", "Automatic"], { kind: "screen", to: "/ajustes", spot: "#aj-pantalla", fold: "aj-pantalla", go: ["a Pantalla", "to Screen"] }],

  /* ------------------------------------------------- Bloc y Fichero */
  [["Notas", "Bloc", "Pad", "Bloc de notas", "Notepad"], { kind: "screen", to: "/notas", spot: "@notas", go: ["al Bloc de notas", "to the Notepad"] }],
  [["Abrir bloc", "Open pad"], { kind: "screen", to: "/notas", spot: "@abrir-bloc", alt: "@notas", go: ["al botón Abrir bloc", "to the Open pad button"], missing: ["Abrir bloc está arriba de la nota, a la izquierda.", "Open pad is above the note, on the left."] }],
  [["Fichero", "Cabinet"], { kind: "screen", to: "/fichero", spot: "@fichero", alt: TITLE, go: ["al Fichero", "to the Cabinet"], missing: ["El Fichero guarda tus notas. Aún no hay ninguna.", "The Cabinet keeps your notes. There are none yet."] }],
  [["Filtros"], { kind: "screen", to: "/fichero", spot: "@fichero-filtros", go: ["a Filtros del Fichero", "to the Cabinet filters"] }],

  /* ----------------------------------------- not a button right now */
  [
    ["Mantener sesión abierta", "Keep me signed in"],
    {
      kind: "trait",
      head: ["Solo se ve al entrar", "Only shown when you sign in"],
      trait: [
        "Es la casilla debajo de la contraseña. Marcada, sigues dentro hasta que cierres sesión.",
        "It is the box under the password. Ticked, you stay in until you sign out.",
      ],
      where: ["En la pantalla Entrar", "On the Sign in screen"],
    },
  ],
];

const MAP = new Map<string, Ref>();
for (const [terms, ref] of REFS) for (const term of terms) MAP.set(term, ref);

export function findRef(term: string): Ref | null {
  return MAP.get(term) ?? null;
}

export function refTerms(): string[] {
  return [...MAP.keys()];
}

/** "@tok" | "#id" | css → a CSS selector. */
export function refSelector(s: string): string {
  if (s.startsWith("@")) {
    const t = s.slice(1);
    return `[data-spot~="${t}"], [data-ref~="${t}"]`;
  }
  return s;
}

/** Natural dialog copy for a link: never "¿Abrir Continuar?". */
export function refCopy(term: string, ref: Ref, en: boolean): { title: string; desc: string; yes: string } {
  const i = en ? 1 : 0;
  const go = ref.go?.[i] ?? (en ? `to ${term}` : `a ${term}`);
  const title = en ? `Go ${go}?` : `¿Ir ${go}?`;
  const desc =
    ref.desc?.[i] ??
    (ref.kind === "flow"
      ? en
        ? `I'll take you to the button that opens ${term}.`
        : `Te llevo al botón que abre ${term}.`
      : en
        ? "I'll take you there and mark it."
        : "Te llevo y te lo marco.");
  return { title, desc, yes: en ? "Go there" : "Ir allí" };
}
