/**
 * El escenario de las presentaciones (Presentación Guiada, Cerca 0). The stage
 * is a third book beside the real one: while it is on, the whole app reads and
 * writes a separate on-device store (`idb://brizna-stage`), built by each
 * module's script and discarded whole on exit — never merged, never saved over
 * the real book. Isolation, not cleanup: the two stores share no writable path.
 *
 * The stage is MEMORY-ONLY, like Faro's: no flag is ever persisted, so a cold
 * boot can never land inside it — the app always reopens on the real book, and
 * the boot sweep below deletes any stage store an interrupted module left
 * behind. While the stage is live the seal (seal-flag.ts) stands every egress
 * path down: cloud sync, the offline queue's flush, automatic backups and the
 * native widget.
 */
import { switchDatabase } from "@/lib/db";
import { readStoredLocale } from "@/lib/theme";
import { setSealed } from "./seal-flag";
import { armPrefGuardHere, armSessionGuardHere, restorePrefGuardHere, restoreSessionGuardHere } from "./pref-guard";

/** The stage store's database URL. dbName() in src/spa/db.ts opens exactly this
 *  while the stage is on. PGlite's IndexedDB filesystem names its database
 *  after the full mount path — `idb://brizna` lives in the IndexedDB database
 *  "/pglite/brizna" (verified in the bench via indexedDB.databases()) — so the
 *  stage's IndexedDB database is "/pglite/brizna-stage". Deleting any other
 *  name silently succeeds while deleting nothing: the name below is derived
 *  from the URL so the two can never drift apart again. */
export const STAGE_DB_NAME = "idb://brizna-stage";
const STAGE_IDB_NAME = "/pglite/" + STAGE_DB_NAME.slice("idb://".length);

/** Roots listen for this event: on it they remount and clear the query cache,
 *  so no screen can keep showing (or writing) the other book's rows. */
export const STAGE_EVENT = "bz-stage-switch";

let stage = false;

/** True while the app is performing on the stage book. */
export function stageOn(): boolean {
  return stage;
}

function dispatchSwitch() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STAGE_EVENT));
}

/** Delete the stage IndexedDB database whole. Best-effort by design: a blocked
 *  or failing delete resolves anyway (the open PGlite is closed before this
 *  runs on exit, and the boot sweep retries on the next cold boot), so leaving
 *  the stage can never hang on it. */
async function deleteStageStore(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.deleteDatabase(STAGE_IDB_NAME);
    } catch {
      resolve();
      return;
    }
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

/** Enter the stage on a guaranteed-empty store: any stage store left by an
 *  earlier (or interrupted) module is wiped first, the seal goes on BEFORE the
 *  switch — so no egress path can observe the stage book unsealed — and only
 *  then does the app switch stores and remount. */
export async function enterStage(): Promise<void> {
  if (stage) return;
  // El guardián de preferencias se arma ANTES de todo: las demostraciones
  // tocan preferencias del dispositivo (densidad, vista del Estudio, tema)
  // que viven fuera del libro; su fotografía es lo que las devuelve intactas
  // al salir, por cualquier puerta (pref-guard.ts, principio 13).
  const localGuarded = armPrefGuardHere();
  // 1.5.94 (campaña Prejuicio, BZ-2): el gemelo de sesión se arma a la vez —
  // los borradores del Bloc viven en sessionStorage sin identidad de libro, y
  // la lección de AD11 escribe los suyos en las mismas claves; sin fotografía,
  // la ficción se pintaba en el Bloc real al salir (y un Guardar la hacía
  // permanente) y un borrador real podía perderse en el libro-escenario.
  const sessionGuarded = armSessionGuardHere();
  // 1.6.01 (campaña Prejuicio R2, R2C-6/R2D-2): si alguna fotografía no cupo,
  // NO hay escenario. Entrar sin guardián dejaba las preferencias de la
  // ficción viviendo en la casa real para siempre, en silencio; la entrada
  // se niega en voz alta (launchPresentation lo anuncia) y lo que sí se armó
  // se desarma, para no dejar una foto huérfana gobernando el próximo arranque.
  if (!localGuarded || !sessionGuarded) {
    if (localGuarded) restorePrefGuardHere();
    if (sessionGuarded) restoreSessionGuardHere();
    const refused = new Error("the preference guard could not take its snapshot");
    refused.name = "GuardRefused";
    throw refused;
  }
  await deleteStageStore();
  setSealed(true);
  await switchDatabase(STAGE_DB_NAME);
  // El libro-escenario nace de fábrica: sus ajustes traen el locale por
  // defecto («es»), y el caparazón adopta el locale del libro activo en
  // cuanto la consulta de ajustes resuelve (app-shell: el libro manda).
  // Sin este paso, entrar en escena volcaba la app ENTERA —tarjeta y
  // escenario— al español para cualquier usuario en inglés, y al salir
  // volvía sola: la ficción debe nacer hablando el idioma del usuario.
  // Se escribe ANTES de anunciar el cambio, para que la primera lectura
  // de ajustes sobre el escenario ya lo encuentre. Best-effort: si la
  // escritura falla, la entrada sigue (nunca cuelga por esto).
  try {
    const { getSettings, updateSettings } = await import("@/lib/server/lawn");
    await getSettings(); // crea la fila de ajustes del escenario si falta
    await updateSettings({ data: { locale: readStoredLocale() } });
  } catch {
    /* la ficción sigue: el idioma de fábrica manda solo si esto falló */
  }
  stage = true;
  dispatchSwitch();
}

/** Leave the stage: while still sealed, switch back to the real book and
 *  remount on it; then delete the stage store whole — the constructed book is
 *  discarded, never merged — and only then lift the seal. */
export async function exitStage(): Promise<void> {
  if (!stage) return;
  await switchDatabase(null);
  // Las preferencias vuelven a su fotografía ANTES del remontaje, para que
  // la primera pintura sobre el libro real ya las lea como el usuario las
  // dejó (densidad, vista del Estudio, tema, idioma).
  restorePrefGuardHere();
  // Los borradores reales del Bloc vuelven con la misma fotografía (BZ-2):
  // lo que la lección escribió en sessionStorage se retira y lo que Papá
  // tenía a medias vuelve a su ranura antes del remontaje.
  restoreSessionGuardHere();
  stage = false;
  dispatchSwitch();
  await deleteStageStore();
  setSealed(false);
}

// Boot sweep: this module is imported early by the conductor, before any data
// reader. The stage flag lives only in memory, so at module install we are
// never inside the stage (a live switch sets the __bzDb override, checked
// here so an in-place re-evaluation cannot wipe the book being performed on);
// a leftover stage store therefore belongs to a module the app death
// interrupted, and it is deleted so no fiction survives into the real book's
// session.
if (!(globalThis as { __bzDb?: string }).__bzDb) {
  // Si una muerte dejó el guardián armado, sus preferencias restauradas son
  // lo primero: la casa vuelve a estar como el usuario la dejó antes de que
  // cualquier pantalla lea una preferencia.
  restorePrefGuardHere();
  restoreSessionGuardHere();
  void deleteStageStore();
}
