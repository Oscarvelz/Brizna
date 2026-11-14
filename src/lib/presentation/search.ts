/**
 * search — el registro de búsqueda de la Presentación Guiada.
 *
 * La ley universal (PLAN §0.7 y el códice de Presentaciones): los módulos y
 * las escenas se registran como los temas del Manual — ancla + palabras
 * clave — y un resultado de búsqueda ofrece LOS DOS aterrizajes: dejarte en
 * la escena («Ver la escena») o ir derecho a la función real («Ir a la
 * función», la pantalla donde la escena ocurre, sin escenario).
 *
 * Este registro se DERIVA de guion.ts (MODULES) en el momento de cargarse:
 * no guarda ninguna copia de títulos, claves ni pantallas, así que nunca
 * puede despegarse de los guiones. Solo entran los módulos `ready`: un
 * módulo en preparación no existe para la lupa (defecto si apareciera).
 *
 * El buscador espejo del Manual (routes/manual.tsx): el plegado de acentos
 * y mayúsculas es el MISMO `fold` de lib/fuzzy que el Manual usa; la regla
 * de acierto (cada palabra debe pegar; las palabras largas perdonan una
 * errata) se espeja aquí porque `manualHit` vive sin exportar dentro de
 * manual.tsx — espejarla en local es más limpio que tocar manual.tsx solo
 * para exportarla, y la cerca de presentation-search.test.ts fija la
 * semántica con sondas vivas (saldo/balance/errata/nonsense).
 */
import { fold } from "../fuzzy.ts";
import { MODULES, type Module, type Pair, type Scene, type Step } from "./guion.ts";

export interface PresSearchEntry {
  kind: "module" | "scene";
  moduleId: string;
  /** Solo en las entradas de escena; la de módulo arranca en su primera escena. */
  sceneId?: string;
  /** El título del módulo dueño (contexto de la fila y texto buscable). */
  moduleTitle: Pair;
  /** Módulo: su título. Escena: su primer pie, que es su nombre. */
  title: Pair;
  /** Las claves nacidas de la escena (pares ES/EN); en el módulo, la unión de sus escenas. */
  keys: Pair[];
  /** La primera ancla de la escena (en el módulo, la de su primera escena). */
  firstAnchor: string;
  /**
   * La pantalla real donde la escena ocurre: su primer paso `go`, con los
   * segmentos dinámicos (`:aurelio`, `$id`) cortados a su prefijo estático
   * («/clientes/:aurelio» → «/clientes»; «/» queda «/»). Una escena sin `go`
   * hereda la pantalla vigente de su módulo — es donde el conductor la
   * actúa, porque la pantalla persiste de escena en escena.
   */
  goScreen: string;
  /** El texto buscable, en AMBOS idiomas: título del módulo + claves + primer pie. */
  searchText: string;
}

type GoStep = Extract<Step, { kind: "go" }>;
type CaptionStep = Extract<Step, { caption: Pair }>;

/** El primer pie de una escena es su nombre (así la nombra también el panel de capítulos). */
function firstCaption(scene: Scene): Pair | null {
  for (const step of scene.steps) {
    if ("caption" in step && step.caption) return (step as CaptionStep).caption;
  }
  return null;
}

/** Corta una ruta de guion a su prefijo estático: el primer segmento dinámico la cierra. */
export function stripGoScreen(screen: string): string {
  const kept: string[] = [];
  for (const seg of screen.split("/").filter(Boolean)) {
    if (seg.startsWith(":") || seg.startsWith("$")) break;
    kept.push(seg);
  }
  return `/${kept.join("/")}`;
}

const dedupeKeys = (keys: Pair[]): Pair[] => {
  const seen = new Set<string>();
  const out: Pair[] = [];
  for (const key of keys) {
    const id = `${key[0]}${key[1]}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(key);
  }
  return out;
};

/**
 * La derivación pura (exportada para que la cerca la ejercite con módulos
 * de juguete: el piso Advanced entra solo cuando guion.ts lo marque ready).
 */
export function buildRegistry(modules: readonly Module[]): PresSearchEntry[] {
  const out: PresSearchEntry[] = [];
  for (const mod of modules) {
    if (!mod.ready) continue;
    let current = "/";
    const scenes = mod.scenes.map((scene) => {
      const go = scene.steps.find((s): s is GoStep => s.kind === "go");
      if (go) current = stripGoScreen(go.screen);
      return { scene, goScreen: current, caption: firstCaption(scene) };
    });
    out.push({
      kind: "module",
      moduleId: mod.id,
      moduleTitle: mod.title,
      title: mod.title,
      keys: dedupeKeys(mod.scenes.flatMap((s) => s.keys)),
      firstAnchor: mod.scenes[0]?.anchors[0] ?? "",
      goScreen: scenes[0]?.goScreen ?? "/",
      searchText: [
        mod.title[0],
        mod.title[1],
        mod.promise[0],
        mod.promise[1],
        ...mod.scenes.flatMap((s) => s.keys.flatMap((k) => [k[0], k[1]])),
        ...scenes.flatMap((d) => (d.caption ? [d.caption[0], d.caption[1]] : [])),
      ].join(" "),
    });
    for (const d of scenes) {
      out.push({
        kind: "scene",
        moduleId: mod.id,
        sceneId: d.scene.id,
        moduleTitle: mod.title,
        title: d.caption ?? mod.title,
        keys: [...d.scene.keys],
        firstAnchor: d.scene.anchors[0] ?? "",
        goScreen: d.goScreen,
        searchText: [
          mod.title[0],
          mod.title[1],
          ...d.scene.keys.flatMap((k) => [k[0], k[1]]),
          ...(d.caption ? [d.caption[0], d.caption[1]] : []),
        ].join(" "),
      });
    }
  }
  return out;
}

/** El registro vivo: una entrada por módulo listo y una por cada escena suya. */
export const PRESENTATION_SEARCH: readonly PresSearchEntry[] = buildRegistry(MODULES);

/* ============================ el buscador (espejo del Manual) ============================ */

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = a[i - 1] === b[j - 1] ? prev : Math.min(prev, row[j - 1]!, row[j]!) + 1;
      prev = row[j]!;
      row[j] = next;
    }
  }
  return row[b.length]!;
}

/** Las palabras de una consulta, como las corta el Manual: plegadas y de 2+ letras. */
export function presentationWords(query: string): string[] {
  return fold(query)
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

/** Espejo de manualHit (manual.tsx): cada palabra debe pegar; las largas perdonan una errata. */
export function presentationHit(words: string[], text: string): boolean {
  if (!words.length) return true;
  const base = fold(text);
  const tokens = base.split(/[^a-z0-9ñ$]+/).filter(Boolean);
  return words.every((w) => {
    if (base.includes(w)) return true;
    if (w.length < 5) return false;
    const limit = w.length >= 8 ? 2 : 1;
    return tokens.some((tok) => Math.abs(tok.length - w.length) <= limit && editDistance(w, tok) <= limit);
  });
}

/**
 * Las entradas que pegan con `words` (ya plegadas, como las del Manual),
 * ordenadas como ordena el Manual sus temas: primero las que pegan en el
 * título, luego las que pegan en las claves, luego el resto; dentro de cada
 * grupo manda el orden del registro (la escalera misma).
 */
export function matchPresentations(words: string[]): PresSearchEntry[] {
  const rank = (entry: PresSearchEntry): number => {
    const title = fold(`${entry.title[0]} ${entry.title[1]}`);
    if (words.length && words.every((w) => title.includes(w))) return 0;
    const keys = fold(entry.keys.flatMap((k) => [k[0], k[1]]).join(" "));
    if (words.length && words.every((w) => keys.includes(w))) return 1;
    return 2;
  };
  return PRESENTATION_SEARCH.map((entry, i) => ({ entry, i, r: rank(entry) }))
    .filter((x) => presentationHit(words, x.entry.searchText))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.entry);
}

/** Atajo por texto crudo: corta las palabras y busca, en un solo gesto. */
export function searchPresentations(query: string): PresSearchEntry[] {
  return matchPresentations(presentationWords(query));
}
