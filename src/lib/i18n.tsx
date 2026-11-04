import { cloneElement, createContext, Fragment, isValidElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { NameLink, nameDest } from "@/components/name-jump";
import { applyLocale, readStoredLocale } from "@/lib/theme";
import type { LocaleName } from "@/lib/types";

const es = {
  "nav.today": "Hoy",
  "nav.agenda": "Agenda",
  "nav.clients": "Clientes",
  "nav.payments": "Cobros",
  "nav.stats": "Estudio",
  "nav.notes": "Notas",
  "nav.settings": "Ajustes",
  "common.back": "Atrás",
  "common.save": "Guardar",
  "common.wait": "Espera…",
  "common.close": "Cerrar",
  "common.more": "Más en el manual",
  "hint.label": "¿Qué significa esto?",
  "photo.gallery": "Galería",
  "photo.camera": "Tomar foto",
  "photo.job": "Foto del patio, si hace falta",
  "photo.ready": "Foto lista. Se guarda con la fecha de este trabajo.",
  "photo.fail": "Esa foto no se pudo guardar. Prueba otra más pequeña.",
  "hecho.title": "¿Cómo cerrar este corte?",
  "hecho.paid": "Hecho y cobrado",
  "hecho.owe": "Hecho y pendiente",
  "hecho.abono": "Hecho y abonado",
  "hecho.paidHelp": "Verde. Anota el pago de hoy en Cobrado. Lo que debía de antes sigue en Por cobrar.",
  "hecho.oweHelp": "Rojo. El corte queda hecho y el monto entra en Por cobrar. No se cuenta como cobrado.",
  "hecho.abonoHelp": "Amarillo. Anota solo una parte. Lo que no cubra sigue en Por cobrar.",
  "stop.button": "Parar por lluvia",
  "stop.title": "¿Parar los pendientes de hoy?",
  "stop.help": "Parar por lluvia viene preestablecido. También puedes parar por otra razón. Se guarda la hora exacta y los patios pasan al siguiente día abierto.",
  "stop.rain": "Parar por lluvia",
  "stop.other": "Parar por esto",
  "stop.msgRain": "Hola. Por la lluvia no pude pasar hoy.",
  "stop.msgOther": "Hola. Hoy no pude pasar.",
  "hours.title": "Horas de trabajo",
  "hours.in": "Entrada",
  "hours.out": "Salida",
  "hours.now": "Ahora",
  "hours.preset": "Horario de siempre",
  "hours.confirm": "Sí, trabajé esas horas",
  "hours.confirmed": "Día confirmado",
  "hours.ask": "¿Trabajaste de {in} a {out}?",
  "hours.yesterday": "¿Ayer trabajaste de {in} a {out}?",
  "hours.yesterdayHelp": "Ayer no se confirmó el horario. Si hoy no lo confirmas, se añade solo el de siempre.",
  "hours.later": "Después",
  "hours.unconfirmed": "Sin confirmar",
  "hours.auto": "Si no cambias la hora, queda el horario de Ajustes.",
  "notes.title": "Bloc de notas",
  "notes.search": "Buscar texto, @cliente o #etiqueta",
  "notes.empty": "Ninguna nota con eso.",
  "notes.pin": "Fijar",
  "notes.unpin": "Quitar fijado",
  "notes.tags": "Etiquetas",
  "notes.tagPh": "Nueva etiqueta",
  "notes.when": "Agendar",
  "notes.also": "También en un cliente",
  "notes.kept": "Sigue en el bloc general.",
  "notes.saved": "Guardado",
  "notes.saving": "Guardando…",
  "notes.new": "Nueva nota",
  "notes.delete": "Borrar nota",
  "notes.folder": "Carpeta",
  "notes.noFolder": "Sin carpeta",
  "notes.placeholder": "Recordatorios, materiales, recados…",
  "notes.correct": "Corregir",
  "notes.mention": "Mencionar cliente",
  "week.fromToday": "Hoy va primero. Después van los seis días siguientes.",
  "stats.hoursToday": "Horas hoy",
  "stats.hoursWeek": "Horas esta semana",
  "stats.hoursMonth": "Horas este mes",
  "stats.stops": "Días parados",
  "lang.es": "Español",
  "lang.en": "English",
  "theme.light": "Claro",
  "theme.amoled": "Amoled",
  "palette.jardin": "Jardín",
  "palette.costa": "Costa",
  "palette.barro": "Barro",
  "palette.pino": "Pino",
  "palette.cielo": "Cielo",
  "stop.come": "Voy el {date}.",
  "stop.moved": "{n} patios pasados al {date}.",
  "stop.none": "Hoy no había patios pendientes.",
  "stop.fail": "No se pudieron pasar los patios.",
  "density.label": "Tamaño de tarjetas",
  "density.full": "Grande",
  "density.compact": "Media",
  "density.dense": "Lista",
  "density.quad": "Malla",
  "notes.week": "Esta semana",
  "notes.weekHelp": "Toca un día para ver los patios. Hoy va primero y después los seis días siguientes.",
  "notes.noneDay": "Nada pendiente este día.",
  "notes.yard": "patio",
  "notes.yards": "patios",
  "notes.deleteAsk": "¿Borrar esta nota?",
  "notes.deleteHelp": "Solo se borra esta hoja. Las demás se quedan.",
  "notes.deleted": "Nota borrada",
  "notes.keepOne": "Deja al menos una nota",
  "notes.saveFail": "No se pudieron guardar las notas",
  "notes.move": "Mover",
  "notes.newFolder": "Nueva carpeta",
  "notes.titleLabel": "Título de la nota",
  "notes.linked": "También en el bloc general",
  "common.cancel": "Cancelar",
  "common.confirm": "Confirmar",
  "common.delete": "Borrar",
};

const en: Record<keyof typeof es, string> = {
  "nav.today": "Today",
  "nav.agenda": "Schedule",
  "nav.clients": "Clients",
  "nav.payments": "Payments",
  "nav.stats": "Stats",
  "nav.notes": "Notes",
  "nav.settings": "Settings",
  "common.back": "Back",
  "common.save": "Save",
  "common.wait": "Wait…",
  "common.close": "Close",
  "common.more": "More in the manual",
  "hint.label": "What does this mean?",
  "photo.gallery": "Gallery",
  "photo.camera": "Take photo",
  "photo.job": "Yard photo, if you need one",
  "photo.ready": "Photo ready. It is saved with this job's date.",
  "photo.fail": "That photo could not be saved. Try a smaller one.",
  "hecho.title": "How do you want to close this cut?",
  "hecho.paid": "Done and paid",
  "hecho.owe": "Done and unpaid",
  "hecho.abono": "Done with a partial payment",
  "hecho.paidHelp": "Green. Records today's payment under Collected. Older debt stays in To collect.",
  "hecho.oweHelp": "Red. The cut is done and the amount goes to To collect. It is not counted as collected.",
  "hecho.abonoHelp": "Yellow. Records only part of the money. The rest stays in To collect.",
  "stop.button": "Stop for rain",
  "stop.title": "Stop today's pending yards?",
  "stop.help": "Stop for rain is the preset. You can also stop for another reason. The exact time is saved and the yards move to the next open day.",
  "stop.rain": "Stop for rain",
  "stop.other": "Stop for this",
  "stop.msgRain": "Hello. I could not come today because of the rain.",
  "stop.msgOther": "Hello. I could not come today.",
  "hours.title": "Work hours",
  "hours.in": "Clock in",
  "hours.out": "Clock out",
  "hours.now": "Now",
  "hours.preset": "Usual hours",
  "hours.confirm": "Yes, I worked those hours",
  "hours.confirmed": "Day confirmed",
  "hours.ask": "Did you work from {in} to {out}?",
  "hours.yesterday": "Did you work yesterday from {in} to {out}?",
  "hours.yesterdayHelp": "Yesterday was not confirmed. If you do not confirm it today, the usual hours are added on their own.",
  "hours.later": "Later",
  "hours.unconfirmed": "Not confirmed",
  "hours.auto": "If you do not change the time, the hours from Settings are used.",
  "notes.title": "Notepad",
  "notes.search": "Search text, @client, or #tag",
  "notes.empty": "No note matches that.",
  "notes.pin": "Pin",
  "notes.unpin": "Unpin",
  "notes.tags": "Tags",
  "notes.tagPh": "New tag",
  "notes.when": "Schedule",
  "notes.also": "Also on a client",
  "notes.kept": "It stays in the main notepad.",
  "notes.saved": "Saved",
  "notes.saving": "Saving…",
  "notes.new": "New note",
  "notes.delete": "Delete note",
  "notes.folder": "Folder",
  "notes.noFolder": "No folder",
  "notes.placeholder": "Reminders, materials, errands…",
  "notes.correct": "Correct",
  "notes.mention": "Mention a client",
  "week.fromToday": "Today comes first. The next six days follow.",
  "stats.hoursToday": "Hours today",
  "stats.hoursWeek": "Hours this week",
  "stats.hoursMonth": "Hours this month",
  "stats.stops": "Stopped days",
  "lang.es": "Español",
  "lang.en": "English",
  "theme.light": "Light",
  "theme.amoled": "Amoled",
  "palette.jardin": "Garden",
  "palette.costa": "Coast",
  "palette.barro": "Clay",
  "palette.pino": "Pine",
  "palette.cielo": "Sky",
  "stop.come": "I will come on {date}.",
  "stop.moved": "{n} yards moved to {date}.",
  "stop.none": "There were no pending yards today.",
  "stop.fail": "The yards could not be moved.",
  "density.label": "Card size",
  "density.full": "Large",
  "density.compact": "Medium",
  "density.dense": "List",
  "density.quad": "Grid",
  "notes.week": "This week",
  "notes.weekHelp": "Tap a day to see its yards. Today comes first, then the next six days.",
  "notes.noneDay": "Nothing pending that day.",
  "notes.yard": "yard",
  "notes.yards": "yards",
  "notes.deleteAsk": "Delete this note?",
  "notes.deleteHelp": "Only this page is deleted. The others stay.",
  "notes.deleted": "Note deleted",
  "notes.keepOne": "Keep at least one note",
  "notes.saveFail": "The notes could not be saved",
  "notes.move": "Move",
  "notes.newFolder": "New folder",
  "notes.titleLabel": "Note title",
  "notes.linked": "Also in the main notepad",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.delete": "Delete",
};

export type MsgKey = keyof typeof es;

// The manual lives in lib/manual/topics.ts (one source for the manual and every (?) bubble).

type Ctx = {
  locale: LocaleName;
  setLocale: (locale: LocaleName) => void;
  t: (key: MsgKey) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleName>(() => readStoredLocale());
  useEffect(() => {
    applyLocale(locale);
  }, [locale]);
  useEffect(() => {
    const sync = () => {
      const next = readStoredLocale();
      setLocaleState((current) => (current === next ? current : next));
    };
    window.addEventListener("ols-look", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ols-look", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const value = useMemo<Ctx>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocaleState(next);
        applyLocale(next);
      },
      t: (key) => (locale === "en" ? en[key] : es[key]),
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "es" as LocaleName,
      setLocale: () => undefined,
      t: (key: MsgKey) => es[key],
    };
  }
  return ctx;
}

export function useTx() {
  const { locale } = useI18n();
  return (esText: string, enText: string) => (locale === "en" ? enText : esText);
}

const REASON_EN: Record<string, string> = {
  Lluvia: "Rain",
  "Cita médica": "Doctor appointment",
  "Visita al médico": "Doctor visit",
  "Cita dental": "Dental appointment",
  Dentista: "Dentist",
  Negocios: "Business",
  Cancelado: "Canceled",
  Otro: "Other",
};

export function reasonLabel(locale: LocaleName, reason: string) {
  if (locale !== "en") return reason;
  return REASON_EN[reason] ?? reason;
}

const EMPHASIS = [
  "Días libres de esta semana",
  "Días libres",
  "Days off this week",
  "Hecho y cobrado",
  "Hecho y pendiente",
  "Hecho y abonado",
  "Done and paid",
  "Done and unpaid",
  "Done with a partial payment",
  "Trabajo ya hecho",
  "Perdonado este mes",
  "Work already done",
  "Forgiven this month",
  "Partial paid",
  "Por cobrar",
  "To collect",
  "Alto riesgo",
  "High risk",
  "En espera",
  "Waiting",
  "Parar por lluvia",
  "Stop for rain",
  "Días parados",
  "Stopped days",
  "Inventario de clientes",
  "Client inventory",
  "Cobrado",
  "Collected",
  "Perdonar",
  "Forgive",
  "Calendario",
  "Calendar",
  "Clientes",
  "Clients",
  "Activos",
  "Ajustes",
  "Settings",
  "Agenda",
  "Schedule",
  "Estudio",
  "Stats",
  "Asesor",
  "Advisor",
  "Cifras",
  "Figures",
  "Cobros",
  "Payments",
  "Notas",
  "Abonado",
  "Tema",
  "Theme",
  "Pantalla",
  "Automático",
  "Hecho",
  "Hoy",
  "Today",
  "Done",
  "Bloc de notas",
  "Notepad",
  "Bloc",
  "Pad",
  "Abrir bloc",
  "Open pad",
  "Malla",
  "Grid",
  "Fichero",
  "Pausa",
  "Pause",
  "Continuar",
  "Play",
  "Filtros",
  "Mantener sesión abierta",
  "Keep me signed in",
  "¿Por qué no se trabajó este día?",
  "Why was this day not worked?",
];

const EMPHASIS_SORTED = [...EMPHASIS].sort((a, b) => b.length - a.length);

export function emphasisTerms(): readonly string[] {
  return EMPHASIS_SORTED;
}

export function isNameTerm(part: string): boolean {
  return (EMPHASIS as readonly string[]).includes(part);
}

const EMPHASIS_RE = new RegExp(
  `(${EMPHASIS_SORTED.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
  "g",
);

export function emphasize(text: string): ReactNode {
  const parts = text.split(EMPHASIS_RE);
  return parts.map((part, i) =>
    nameDest(part) ? (
      <NameLink key={i} term={part} />
    ) : EMPHASIS.includes(part) ? (
      <span key={i} className="name-ref">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function emphasizeTree(node: ReactNode): ReactNode {
  if (node == null || typeof node === "boolean" || typeof node === "number") return node;
  if (typeof node === "string") return emphasize(node);
  if (Array.isArray(node)) {
    return node.map((child, i) => <Fragment key={i}>{emphasizeTree(child)}</Fragment>);
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    const child = node.props.children;
    if (child == null) return node;
    return cloneElement(node, undefined, emphasizeTree(child));
  }
  return node;
}

