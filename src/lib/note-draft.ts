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

function readSlot(key: string): UnsavedNote | null {
  try {
    const raw = sessionStorage.getItem(key);
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
  try {
    if (!note) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(note));
  } catch {
    if (!note) return;
    try {
      const { shots: _shots, ...rest } = note;
      sessionStorage.setItem(key, JSON.stringify(rest));
    } catch {
      /* ignore */
    }
  }
}

function readPages(): Record<string, UnsavedNote> {
  try {
    const raw = sessionStorage.getItem(PAGES);
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
  try {
    if (Object.keys(map).length === 0) sessionStorage.removeItem(PAGES);
    else sessionStorage.setItem(PAGES, JSON.stringify(map));
  } catch {
    /* ignore */
  }
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
  try {
    sessionStorage.removeItem("ols-pad-draft");
    sessionStorage.removeItem("ols-pad-0");
  } catch {
    /* ignore */
  }
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
