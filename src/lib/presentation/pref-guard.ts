/**
 * El guardián de preferencias de la presentación (principio 13, con dientes de
 * motor): lo que una demostración cambia fuera del libro — la densidad de las
 * tarjetas, la vista del Estudio, el tema, el idioma — vive en localStorage,
 * NO en el libro-escenario que Cerca 0 intercambia. Sin este guardián, una
 * escena que enciende Malla y no la devuelve (o una salida a mitad de escena)
 * dejaba la preferencia REAL del usuario cambiada: la ficción se filtraba.
 *
 * Al entrar en escena se fotografía el almacén entero (salvo lo que jamás
 * debe retroceder: el progreso propio de las presentaciones, las claves del
 * guardián y los tokens de sesión sb-*); al salir — por cualquier puerta — la
 * fotografía se restaura: valores vueltos, claves borradas repuestas y claves
 * creadas por la demostración eliminadas. La fotografía vive en el propio
 * almacén, así que si la app muere a mitad de módulo, el arranque la encuentra
 * y restaura antes de seguir: ninguna muerte deja la casa cambiada.
 *
 * Nunca lanza: un guardián que rompe la entrada o la salida sería peor que la
 * fuga que evita.
 */

export interface StoreLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const PREF_GUARD_KEY = "bz.pres.prefguard";
/** 1.5.94 (campaña Prejuicio, BZ-2): the session twin's photograph key. The
 *  Bloc's drafts live in sessionStorage under book-less keys (`ols-note-*`,
 *  `ols-pad-<id>`), so the localStorage photograph alone let a lesson's fiction
 *  draft paint — and be saved — in the real Bloc, and a real draft be lost into
 *  the discarded stage book. The session store gets the same guardian. */
export const SESSION_GUARD_KEY = "bz.pres.sessionguard";

/** Lo que nunca retrocede: el progreso de las presentaciones es real, las
 *  claves del propio guardián se gestionan solas y los tokens de sesión
 *  (Supabase, sb-*) pueden haberse renovado durante la lección — devolverlos
 *  sería cerrar la sesión del usuario. */
function excluded(key: string): boolean {
  return key === "bz.seen.pres" || key.startsWith("bz.pres.") || key.startsWith("sb-");
}

function keysOf(store: StoreLike): string[] {
  const out: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k) out.push(k);
  }
  return out;
}

/** Fotografía el almacén. Si ya hay una fotografía (una entrada anterior que
 *  la muerte interrumpió), se conserva la ORIGINAL: es la casa verdadera. */
export function armPrefGuard(store: StoreLike, guardKey: string = PREF_GUARD_KEY): void {
  try {
    if (store.getItem(guardKey)) return;
    const snap: Record<string, string> = {};
    for (const k of keysOf(store)) {
      if (excluded(k)) continue;
      const v = store.getItem(k);
      if (v !== null) snap[k] = v;
    }
    store.setItem(guardKey, JSON.stringify(snap));
  } catch {
    /* el guardián nunca rompe la entrada */
  }
}

/** Restaura la fotografía y la retira. Devuelve true si había una puesta. */
export function restorePrefGuard(store: StoreLike, guardKey: string = PREF_GUARD_KEY): boolean {
  try {
    const raw = store.getItem(guardKey);
    if (!raw) return false;
    const snap = JSON.parse(raw) as Record<string, string>;
    // Lo que la demostración creó y la casa no tenía, fuera.
    for (const k of keysOf(store)) {
      if (excluded(k)) continue;
      if (!(k in snap)) store.removeItem(k);
    }
    // Lo que cambió o se borró, de vuelta a su valor.
    for (const [k, v] of Object.entries(snap)) {
      if (store.getItem(k) !== v) store.setItem(k, v);
    }
    store.removeItem(guardKey);
    return true;
  } catch {
    return false;
  }
}

function here(): StoreLike | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** Arma el guardián sobre el localStorage real (stage.ts, al entrar). */
export function armPrefGuardHere(): void {
  const s = here();
  if (s) armPrefGuard(s);
}

/** Restaura si el guardián está armado (stage.ts, al salir y al arrancar). */
export function restorePrefGuardHere(): boolean {
  const s = here();
  return s ? restorePrefGuard(s) : false;
}

function sessionHere(): StoreLike | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

/** Arma el guardián sobre el sessionStorage real (stage.ts, al entrar): los
 *  borradores del Bloc quedan fotografiados antes de que la ficción escriba
 *  los suyos en las mismas claves. */
export function armSessionGuardHere(): void {
  const s = sessionHere();
  if (s) armPrefGuard(s, SESSION_GUARD_KEY);
}

/** Restaura el guardián de sesión si está armado (stage.ts, al salir y al arrancar). */
export function restoreSessionGuardHere(): boolean {
  const s = sessionHere();
  return s ? restorePrefGuard(s, SESSION_GUARD_KEY) : false;
}
