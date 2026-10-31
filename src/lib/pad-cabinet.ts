export type FolderDesign = "bar" | "top" | "wash" | "dot" | "ring" | "plain" | "halo" | "neon";

export type CabinetFolder = {
  id: string;
  name: string;
  color: string;
  design?: FolderDesign;
  noteColor?: string;
  noteDesign?: FolderDesign;
  trashedAt: number | null;
};

export type FicheroDensity = "full" | "compact" | "quad" | "dense";
export type FicheroCols = 2 | 3;

const FOLDERS = "ols-pad-folders";
const MODE = "ols-pad-color-mode";
const DAYS = "ols-note-trash-days";
const UNSORTED_FLAG = "ols-pad-unsorted";
const DENSITY = "ols-fichero-density";
const COLS = "ols-fichero-cols";

export const UNSORTED_ID = "sin-especificar";
export const UNSORTED_NAME = "No especificada";

const DESIGNS = new Set<FolderDesign>(["bar", "top", "wash", "dot", "ring", "plain", "halo", "neon"]);

export const FOLDER_SWATCHES = ["#7d8c74", "#3d6b4f", "#1f6a3a", "#6b4f3a", "#a36b4a", "#3d6a8a", "#7a3e4a", "#8a6a2f", "#5c6560", "#2c3330"];

function asDesign(value: unknown): FolderDesign | undefined {
  return typeof value === "string" && DESIGNS.has(value as FolderDesign) ? (value as FolderDesign) : undefined;
}

function asColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "";
}

const PRESETS: CabinetFolder[] = [
  { id: "trabajo", name: "Trabajo por hacer", color: "", trashedAt: null },
  { id: "materiales", name: "Materiales", color: "", trashedAt: null },
  { id: "recordatorios", name: "Recordatorios", color: "", trashedAt: null },
  { id: UNSORTED_ID, name: UNSORTED_NAME, color: "", trashedAt: null },
];

function store(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readTrashDays(): number {
  const raw = store()?.getItem(DAYS);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(365, Math.round(n));
}

export function writeTrashDays(days: number) {
  const n = Math.min(365, Math.max(1, Math.round(days)));
  store()?.setItem(DAYS, String(n));
}

export function readColorMode(): "theme" | "custom" {
  return store()?.getItem(MODE) === "custom" ? "custom" : "theme";
}

export function writeColorMode(mode: "theme" | "custom") {
  store()?.setItem(MODE, mode);
}

export function readFicheroDensity(): FicheroDensity {
  const value = store()?.getItem(DENSITY);
  return value === "compact" || value === "dense" || value === "quad" ? value : "full";
}

export function writeFicheroDensity(value: FicheroDensity) {
  store()?.setItem(DENSITY, value);
}

export function readFicheroCols(): FicheroCols {
  return store()?.getItem(COLS) === "3" ? 3 : 2;
}

export function writeFicheroCols(cols: FicheroCols) {
  store()?.setItem(COLS, String(cols));
}

function clean(parsed: unknown): CabinetFolder[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<CabinetFolder>;
    const name = typeof row.name === "string" ? row.name.trim().slice(0, 40) : "";
    if (!name) return [];
    return [
      {
        id: typeof row.id === "string" && row.id ? row.id : name,
        name,
        color: asColor(row.color) || (typeof row.color === "string" ? row.color : ""),
        design: asDesign(row.design),
        noteColor: asColor(row.noteColor),
        noteDesign: asDesign(row.noteDesign),
        trashedAt: typeof row.trashedAt === "number" ? row.trashedAt : null,
      },
    ];
  });
}

export function readCabinet(): CabinetFolder[] {
  const box = store();
  if (!box) return PRESETS.map((folder) => ({ ...folder }));
  try {
    const raw = box.getItem(FOLDERS);
    if (raw == null) {
      box.setItem(FOLDERS, JSON.stringify(PRESETS));
      box.setItem(UNSORTED_FLAG, "1");
      return PRESETS.map((folder) => ({ ...folder }));
    }
    let folders = clean(JSON.parse(raw) as unknown);
    if (!folders.some((folder) => folder.id === UNSORTED_ID) && box.getItem(UNSORTED_FLAG) !== "1") {
      folders = [...folders, { id: UNSORTED_ID, name: UNSORTED_NAME, color: "", trashedAt: null }];
      box.setItem(FOLDERS, JSON.stringify(folders));
    }
    box.setItem(UNSORTED_FLAG, "1");
    return folders;
  } catch {
    return PRESETS.map((folder) => ({ ...folder }));
  }
}

export function writeCabinet(folders: CabinetFolder[]) {
  store()?.setItem(FOLDERS, JSON.stringify(folders));
}

/** Folders that already have notes but are missing from the cabinet. */
export function withLiveFolders(cabinet: CabinetFolder[], names: string[]): CabinetFolder[] {
  const known = new Set(cabinet.map((folder) => folder.name));
  const extras = [...new Set(names.filter((name) => name && !known.has(name)))];
  if (extras.length === 0) return cabinet;
  const next = [
    ...cabinet,
    ...extras.map((name) => ({ id: `extra-${name}`, name, color: "", trashedAt: null as number | null })),
  ];
  writeCabinet(next);
  return next;
}
