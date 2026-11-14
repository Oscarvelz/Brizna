/**
 * state — el estado del aparato de la Presentación Guiada.
 *
 * Vive en localStorage bajo `bz.seen.pres`: es estado de ESTE aparato, jamás
 * del libro — se comparte en todos los modos (el libro real y el escenario lo
 * leen igual) y nunca viaja en un respaldo ni en una sincronía. Guarda dónde
 * iba cada módulo, la velocidad y el modo elegidos, y las escenas guardadas.
 *
 * Las intenciones de lanzamiento y de aterrizaje viajan en sessionStorage,
 * fuera del namespace de datos: `bz.pres.launch` dice qué módulo abrir al
 * entrar en el escenario; `bz.pres.stay` dice dónde aterrizar al salir
 * («Quedarme aquí» deja al usuario en ese mismo lugar de SU app, y la salida
 * al índice marca `openPres` para que el pliegue de Ajustes se abra solo).
 */

export type PresState = {
  modules: Record<string, { scene: number; done: boolean }>;
  speed: number;
  mode: "auto" | "interactive";
  savedScenes: string[];
  /** El último módulo que el usuario estuvo reproduciendo (ley de Oscar,
   * 2026-11-14): si quedó incompleto, su ficha abre el índice — la primera
   * de todas — para continuar donde iba sin tener que buscarla. Al
   * completarse, la marca se retira. */
  lastPlayed: string | null;
};

/** La llave del aparato: compartida en cada modo, nunca dato del libro. */
export const SEEN_KEY = "bz.seen.pres";

/** sessionStorage: la intención de lanzamiento (qué módulo, desde qué escena). */
export const LAUNCH_KEY = "bz.pres.launch";

/** sessionStorage: la intención de aterrizaje al disolver el escenario. */
export const STAY_KEY = "bz.pres.stay";

const SPEEDS = [0.5, 0.75, 1, 1.5, 2] as const;

export function readPresState(): PresState {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || "null") as Partial<PresState> | null;
    return {
      modules: raw?.modules ?? {},
      speed: SPEEDS.includes(raw?.speed as (typeof SPEEDS)[number]) ? (raw!.speed as number) : 1,
      mode: raw?.mode === "interactive" ? "interactive" : "auto",
      savedScenes: Array.isArray(raw?.savedScenes) ? raw!.savedScenes : [],
      lastPlayed: typeof raw?.lastPlayed === "string" ? raw.lastPlayed : null,
    };
  } catch {
    return { modules: {}, speed: 1, mode: "auto", savedScenes: [], lastPlayed: null };
  }
}

export function writePresState(next: PresState): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the presentation still runs, it just forgets */
  }
}

/* ============================ intenciones (session) ============================ */

export type LaunchIntent = { moduleId: string; sceneId?: string };

export function setLaunch(intent: LaunchIntent): void {
  try {
    sessionStorage.setItem(LAUNCH_KEY, JSON.stringify(intent));
  } catch {
    /* ignore */
  }
}

/** Lee y retira la intención de lanzamiento: se consume una sola vez. */
export function takeLaunch(): LaunchIntent | null {
  try {
    const raw = sessionStorage.getItem(LAUNCH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(LAUNCH_KEY);
    const parsed = JSON.parse(raw) as Partial<LaunchIntent>;
    return parsed.moduleId ? { moduleId: parsed.moduleId, sceneId: parsed.sceneId } : null;
  } catch {
    return null;
  }
}

export type StayIntent = { path: string; openPres?: boolean };

export function setStay(stay: StayIntent): void {
  try {
    sessionStorage.setItem(STAY_KEY, JSON.stringify(stay));
  } catch {
    /* ignore */
  }
}

export function peekStay(): StayIntent | null {
  try {
    const raw = sessionStorage.getItem(STAY_KEY);
    return raw ? (JSON.parse(raw) as StayIntent) : null;
  } catch {
    return null;
  }
}

export function clearStay(): void {
  try {
    sessionStorage.removeItem(STAY_KEY);
  } catch {
    /* ignore */
  }
}

/* ==================== la oferta de primera vez (OQ-8) ====================
 *
 * La cadena de primera vez, con el precedente de Faro: registro/primera
 * entrada → oferta de huella → oferta de la Presentación → Q1 → el índice
 * en Ajustes. Como todo lo de este archivo, estas llaves son estado de ESTE
 * aparato (familia `bz.pres.`), jamás datos del libro: nunca viajan en un
 * respaldo ni en una sincronía, y son por cuenta (`<uid>`), como las de la
 * oferta de huella de la casa (`brizna.lockAsked.<uid>`, que aquí solo se
 * LEE — la escribe FingerprintOffer, nunca este sistema).
 *
 *  - `bz.pres.offer.<uid>` — la oferta ya se hizo: cualquier salida
 *    (aceptar, declinar, descartar) la escribe y no se vuelve a preguntar.
 *  - `bz.pres.fresh.<uid>` — el veredicto de elegibilidad, evaluado UNA vez
 *    por cuenta y aparato y guardado ANTES de que ningún diálogo pueda
 *    abrirse: "new" solo si el libro estaba vacío en esa primera
 *    evaluación; "existing" (había cualquier cliente — p. ej. un libro
 *    restaurado) no se ofrece nunca, para siempre. Un fallo al evaluar no
 *    guarda nada: se reintenta, porque un veredicto equivocado sería eterno.
 */

/** La oferta de la Presentación ya se hizo a esta cuenta en este aparato. */
export const offerKey = (uid: string) => `bz.pres.offer.${uid}`;

/** El veredicto de elegibilidad de esta cuenta en este aparato. */
export const eligibilityKey = (uid: string) => `bz.pres.fresh.${uid}`;

/** La llave «ya se preguntó la huella» de la casa: se lee, no se escribe. */
export const fingerprintAskedKey = (uid: string) => `brizna.lockAsked.${uid}`;

export type OfferEligibility = "new" | "existing";

/** Almacén mínimo que las ayudas de abajo necesitan (localStorage en la app;
 *  una falsificación en las pruebas). Sin almacén, todo lee «sin decidir» y
 *  nada se guarda — el mismo «si no se puede leer, no se pregunta» de la
 *  oferta de huella. */
export type OfferStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function deviceStore(): OfferStore | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function offerAsked(uid: string, store: OfferStore | null = deviceStore()): boolean {
  try {
    return Boolean(store?.getItem(offerKey(uid)));
  } catch {
    return true; // ilegible = trátalo como preguntado: nunca arriesgar un doble ofrecimiento
  }
}

export function markOfferAsked(uid: string, store: OfferStore | null = deviceStore()): void {
  try {
    store?.setItem(offerKey(uid), "1");
  } catch {
    /* ignore */
  }
}

/** El veredicto guardado, o null si esta cuenta aún no se ha evaluado aquí. */
export function readOfferEligibility(
  uid: string,
  store: OfferStore | null = deviceStore(),
): OfferEligibility | null {
  try {
    const raw = store?.getItem(eligibilityKey(uid));
    return raw === "new" || raw === "existing" ? raw : null;
  } catch {
    return null;
  }
}

export function storeOfferEligibility(
  uid: string,
  verdict: OfferEligibility,
  store: OfferStore | null = deviceStore(),
): void {
  try {
    store?.setItem(eligibilityKey(uid), verdict);
  } catch {
    /* ignore */
  }
}

/** ¿Ya se le preguntó la huella a esta cuenta en este aparato? (la llave de
 *  FingerprintOffer; también «resuelto» si luego activó la huella, porque
 *  toda salida de ese diálogo la escribe). */
export function fingerprintAsked(uid: string, store: OfferStore | null = deviceStore()): boolean {
  try {
    return Boolean(store?.getItem(fingerprintAskedKey(uid)));
  } catch {
    return false;
  }
}

/**
 * La puerta de la maquinaria: cualquier id de usuario ESTABLE sirve para
 * evaluar la elegibilidad y guardar el veredicto (es estado de aparato
 * inofensivo, por cuenta, y así la cadena se puede ejercitar también con el
 * usuario de desarrollo del banco). El id literal "local" no es estable ni
 * de una persona — es el marcador que la casa ya excluye — y queda fuera.
 * Que el DIÁLOGO se abra ya es otra puerta, más estricta, en el componente
 * (espejo de FingerprintOffer: cuenta real, ni desarrollo ni "local").
 */
export function offerMachineryGate(user: { id: string } | null | undefined): boolean {
  return Boolean(user && typeof user.id === "string" && user.id.length > 0 && user.id !== "local");
}

/** Lo que se sabe de la pregunta de la huella para una cuenta. `supported`
 *  es null mientras `lockSupported()` no ha resuelto. */
export type FingerprintFacts = {
  asked: boolean;
  hasCredential: boolean;
  supported: boolean | null;
};

/**
 * La pregunta de la huella está RESUELTA cuando ya se preguntó (toda salida
 * de su diálogo marca el «preguntado»), o la cuenta ya tiene credencial de
 * candado, o este aparato no admite huella (su oferta jamás se abrirá).
 * Mientras su oferta esté abierta — o pueda abrirse — la Presentación
 * espera: los dos diálogos nunca se apilan.
 */
export function fingerprintIsSettled(fp: FingerprintFacts): boolean {
  return fp.asked || fp.hasCredential || fp.supported === false;
}

export type OfferDecision = "offer" | "wait" | "never";

/**
 * La decisión pura de la cadena, sin reloj ni almacén: el componente la
 * alimenta con los hechos y las pruebas la conducen entera.
 *  - preguntado ya, o libro «existing» → "never" (declinar es final y
 *    silencioso; un libro con clientes jamás recibe la oferta).
 *  - sin veredicto guardado → "wait": la oferta solo nace de un veredicto
 *    YA guardado, nunca de una evaluación en vuelo (así ninguna carrera
 *    puede ofrecer dos veces ni al perfil equivocado).
 *  - veredicto "new" pero huella sin resolver → "wait".
 *  - veredicto "new" + huella resuelta + sin preguntar → "offer".
 */
export function offerDecision(input: {
  asked: boolean;
  eligibility: OfferEligibility | null;
  fingerprint: FingerprintFacts;
}): OfferDecision {
  if (input.asked) return "never";
  if (input.eligibility === "existing") return "never";
  if (input.eligibility === null) return "wait";
  if (!fingerprintIsSettled(input.fingerprint)) return "wait";
  return "offer";
}
