const ACTIVE = "ols-note-unsaved";
const MAIN = "ols-note-main";
const SIDE = "ols-note-side";
const PAGES = "ols-note-pages";

export type DraftSlot = "main" | "side" | "page";

export type UnsavedNote = {
  pageId: number;
  title: string;
  html: string;
  folder: string;
  draft?: boolean;
  slot?: DraftSlot;
  shots?: string[];
};

export function padFamily(path: string) {
  return path === "/notas" || path === "/fichero";
}

export function noteHasText(note: UnsavedNote | null) {
  if (!note) return false;
  const plain = note.html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 0 || (note.shots?.length ?? 0) > 0;
}

/* 1.6.00 (campaña Prejuicio, BZ-30 — decisión de Oscar según la recomendación
 * del plan): los borradores del Bloc SOBREVIVEN a la sesión. Hasta 1.5.99
 * vivían en sessionStorage y morían al cerrar la app, aunque el Manual
 * prometía recuperarlos al volver; ahora viven en localStorage, el mismo
 * almacén que las preferencias — y con eso entran solos en el censo del sello
 * de la Presentación (el guardián fotografía todo localStorage) y en la capa
 * local del respaldo, como el catálogo de carpetas. Las lecturas adoptan una
 * copia legada de sessionStorage una sola vez, para que ningún borrador vivo
 * se pierda en el cambio de almacén. */
function draftStore(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function legacyStore(): Storage | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

/** Lee una clave de borrador: localStorage manda; si solo vive la copia de
 *  sessionStorage (de antes de 1.6.00), se adopta y la vieja se retira. */
export function readDraftRaw(key: string): string | null {
  const store = draftStore();
  if (!store) return null;
  try {
    const v = store.getItem(key);
    if (v !== null) return v;
    const legacy = legacyStore();
    const old = legacy?.getItem(key) ?? null;
    if (old !== null) {
      try {
        store.setItem(key, old);
      } catch {
        /* si no cabe, se lee igual esta vez */
      }
      legacy?.removeItem(key);
      return old;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeDraftRaw(key: string, value: string): void {
  try {
    draftStore()?.setItem(key, value);
  } catch {
    /* el llamador decide su repliegue */
  }
  try {
    legacyStore()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function removeDraftRaw(key: string): void {
  try {
    draftStore()?.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    legacyStore()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readSlot(key: string): UnsavedNote | null {
  try {
    const raw = readDraftRaw(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<UnsavedNote>;
    if (!data || typeof data.pageId !== "number" || data.pageId < 0) return null;
    const shots = Array.isArray(data.shots) ? data.shots.filter((item) => typeof item === "string") : undefined;
    const slot: DraftSlot | undefined = data.slot === "main" || data.slot === "side" || data.slot === "page" ? data.slot : undefined;
    return {
      pageId: data.pageId,
      title: typeof data.title === "string" ? data.title : "Nota",
      html: typeof data.html === "string" ? data.html : "",
      folder: typeof data.folder === "string" && data.folder ? data.folder : "No especificada",
      draft: data.draft === true || data.pageId === 0,
      ...(slot ? { slot } : {}),
      ...(shots && shots.length > 0 ? { shots } : {}),
    };
  } catch {
    return null;
  }
}

function writeSlot(key: string, note: UnsavedNote | null) {
  if (!note) {
    removeDraftRaw(key);
    return;
  }
  const store = draftStore();
  try {
    store?.setItem(key, JSON.stringify(note));
  } catch {
    try {
      const { shots: _shots, ...rest } = note;
      store?.setItem(key, JSON.stringify(rest));
    } catch {
      /* ignore */
    }
  }
  try {
    legacyStore()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readPages(): Record<string, UnsavedNote> {
  try {
    const raw = readDraftRaw(PAGES);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, Partial<UnsavedNote>>;
    const out: Record<string, UnsavedNote> = {};
    for (const [id, note] of Object.entries(data ?? {})) {
      const parsed = readSlotValue(note);
      if (parsed && noteHasText(parsed)) out[id] = parsed;
    }
    return out;
  } catch {
    return {};
  }
}

function readSlotValue(data: Partial<UnsavedNote> | null): UnsavedNote | null {
  if (!data || typeof data.pageId !== "number" || data.pageId < 0) return null;
  const shots = Array.isArray(data.shots) ? data.shots.filter((item) => typeof item === "string") : undefined;
  return {
    pageId: data.pageId,
    title: typeof data.title === "string" ? data.title : "Nota",
    html: typeof data.html === "string" ? data.html : "",
    folder: typeof data.folder === "string" && data.folder ? data.folder : "No especificada",
    draft: data.draft === true || data.pageId === 0,
    slot: "page",
    ...(shots && shots.length > 0 ? { shots } : {}),
  };
}

function writePages(map: Record<string, UnsavedNote>) {
  if (Object.keys(map).length === 0) removeDraftRaw(PAGES);
  else writeDraftRaw(PAGES, JSON.stringify(map));
}

export function readUnsavedNote(): UnsavedNote | null {
  return readSlot(ACTIVE);
}

export function writeUnsavedNote(note: UnsavedNote | null) {
  writeSlot(ACTIVE, note);
}

export function readMainDraft(): UnsavedNote | null {
  return readSlot(MAIN) ?? readSlot("ols-note-parked");
}

export function writeMainDraft(note: UnsavedNote | null) {
  writeSlot(MAIN, note);
  writeSlot("ols-note-parked", null);
}

export function readSideDraft(): UnsavedNote | null {
  return readSlot(SIDE);
}

export function writeSideDraft(note: UnsavedNote | null) {
  writeSlot(SIDE, note);
}

export function holdPageDraft(note: UnsavedNote | null) {
  if (!note || note.pageId <= 0) return;
  const map = readPages();
  if (!noteHasText(note)) delete map[String(note.pageId)];
  else map[String(note.pageId)] = { ...note, slot: "page" };
  writePages(map);
  if (noteHasText(note)) writeUnsavedNote({ ...note, slot: "page" });
  else if (readUnsavedNote()?.pageId === note.pageId) writeUnsavedNote(null);
}

/** Remember the open note without touching the other notepad draft. */
export function rememberDraft(note: UnsavedNote) {
  const slot = note.slot ?? (note.pageId > 0 ? "page" : "main");
  const next = { ...note, slot };
  if (!noteHasText(next)) {
    if (slot === "main") writeMainDraft(null);
    else if (slot === "side") writeSideDraft(null);
    else holdPageDraft(next);
    if (readUnsavedNote()?.slot === slot || (slot === "page" && readUnsavedNote()?.pageId === next.pageId)) writeUnsavedNote(null);
    return;
  }
  if (slot === "main") writeMainDraft(next);
  else if (slot === "side") writeSideDraft(next);
  else holdPageDraft(next);
  writeUnsavedNote(next);
}

export function pendingDrafts(): UnsavedNote[] {
  const list = [readUnsavedNote(), readMainDraft(), readSideDraft(), ...Object.values(readPages())];
  const seen = new Set<string>();
  const out: UnsavedNote[] = [];
  for (const note of list) {
    if (!noteHasText(note) || !note) continue;
    const key = `${note.slot ?? "page"}:${note.pageId}:${note.html}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(note);
  }
  return out;
}

export function clearDrafts() {
  writeUnsavedNote(null);
  writeMainDraft(null);
  writeSideDraft(null);
  writePages({});
  removeDraftRaw("ols-pad-draft");
  removeDraftRaw("ols-pad-0");
}

export function dropSavedDraft(slot: DraftSlot, pageId = 0) {
  if (slot === "main") writeMainDraft(null);
  if (slot === "side") writeSideDraft(null);
  if (slot === "page" && pageId > 0) {
    const map = readPages();
    delete map[String(pageId)];
    writePages(map);
  }
  const active = readUnsavedNote();
  if (active && (active.slot === slot || (slot === "page" && active.pageId === pageId))) writeUnsavedNote(null);
}
