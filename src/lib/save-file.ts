import { inAndroidApp, nativeSaveOutcome } from "@/spa/native";
import { sealedOn } from "@/lib/presentation/seal-flag";

// Ola 4 (BZ-9): dentro de la app, un clic en un enlace de descarga lo
// recoge el puente y el guardado termina DESPUÉS del clic. Quien anuncia
// «guardado» espera aquí el veredicto real del puente; si el guardado
// falló, esto lanza NativeSaveError y el aviso de éxito nunca se canta.
// Fuera de la app no hay nada que esperar: el navegador ya descargó.
async function settleNativeSave(name: string): Promise<void> {
  if (!inAndroidApp()) return;
  const outcome = nativeSaveOutcome(name);
  if (!outcome) return;
  const ok = await outcome;
  if (!ok) {
    const err = new Error("native save failed");
    err.name = "NativeSaveError";
    throw err;
  }
}

export async function downloadHref(filename: string, src: string) {
  // 1.6.09 (Prejuicio R3, observación de la caza 2 hecha cerca): con el
  // sello puesto nada se descarga — este embudo solo sirve hoy a las fotos,
  // y el día que las fotos se enciendan la puerta ya está cerrada. La
  // puerta (savePhoto) dice el motivo; aquí se niega en silencio.
  if (sealedOn()) {
    const err = new Error("sealed: no downloads during a presentation");
    err.name = "AbortError";
    throw err;
  }
  const blob = await (await fetch(src)).blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  await settleNativeSave(filename);
}

export async function saveJsonFile(
  filename: string,
  json: string,
): Promise<"picked" | "downloaded"> {
  return saveBlobFile(filename, new Blob([json], { type: "application/json" }), {
    description: "Copia de seguridad JSON",
    accept: { "application/json": [".json"] },
  });
}

export async function saveBinaryFile(
  filename: string,
  bytes: Uint8Array,
  description: string,
  ext: string,
  mime: string,
): Promise<"picked" | "downloaded"> {
  const raw = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(raw).set(bytes);
  const blob = new Blob([raw], { type: mime });
  return saveBlobFile(filename, blob, { description, accept: { [mime]: [ext] } });
}

export async function saveCsvFile(
  filename: string,
  csv: string,
): Promise<"picked" | "downloaded"> {
  const bom = csv.charCodeAt(0) === 0xfeff ? csv : `\uFEFF${csv}`;
  return saveBlobFile(filename, new Blob([bom], { type: "text/csv;charset=utf-8" }), {
    description: "Hoja de cálculo CSV",
    accept: { "text/csv": [".csv"] },
  });
}

async function saveBlobFile(
  filename: string,
  blob: Blob,
  type: { description: string; accept: Record<string, string[]> },
): Promise<"picked" | "downloaded"> {
  const nav = window as Window & {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<{
      createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }>;
    }>;
  };
  if (typeof nav.showSaveFilePicker === "function") {
    try {
      const handle = await nav.showSaveFilePicker({
        suggestedName: filename,
        types: [type],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "picked";
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") throw err;
    }
  }
  const url = URL.createObjectURL(new Blob([await blob.arrayBuffer()], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  await settleNativeSave(filename);
  return "downloaded";
}

type DirHandle = {
  queryPermission?: (opts: { mode: "readwrite" }) => Promise<string>;
  requestPermission?: (opts: { mode: "readwrite" }) => Promise<string>;
  getFileHandle: (name: string, opts: { create: boolean }) => Promise<{
    createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }>;
  }>;
  entries: () => AsyncIterable<[string, { kind: string }]>;
  removeEntry: (name: string) => Promise<void>;
};

const DIR_DB = "ols-backup-dir";
const DIR_STORE = "handles";
const HANDLE_KEY = "dir";

function openDirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DIR_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DIR_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase): Promise<DirHandle | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIR_STORE, "readonly");
    const req = tx.objectStore(DIR_STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result as DirHandle | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, handle: DirHandle): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIR_STORE, "readwrite");
    tx.objectStore(DIR_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function storedDir(): Promise<DirHandle | null> {
  try {
    const db = await openDirDb();
    const handle = await idbGet(db);
    db.close();
    return handle ?? null;
  } catch {
    return null;
  }
}

export async function hasBackupFolder() {
  return (await storedDir()) != null;
}

export async function pickBackupFolder(): Promise<boolean> {
  const nav = window as Window & { showDirectoryPicker?: () => Promise<DirHandle> };
  if (typeof nav.showDirectoryPicker !== "function") return false;
  const handle = await nav.showDirectoryPicker();
  const db = await openDirDb();
  await idbPut(db, handle);
  db.close();
  return true;
}

async function usableDir(): Promise<DirHandle | null> {
  const handle = await storedDir();
  if (!handle) return null;
  let perm = (await handle.queryPermission?.({ mode: "readwrite" })) ?? "prompt";
  if (perm !== "granted") perm = (await handle.requestPermission?.({ mode: "readwrite" })) ?? "denied";
  return perm === "granted" ? handle : null;
}

function stampBase() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `Brizna_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function bytesBlob(bytes: Uint8Array, mime: string) {
  const raw = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(raw).set(bytes);
  return new Blob([raw], { type: mime });
}

function crc32(data: Uint8Array) {
  let crc = ~0;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function zipStore(files: { name: string; data: Uint8Array }[]) {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const cd = new DataView(central.buffer);
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, file.data.length, true);
    cd.setUint32(24, file.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local, file.data);
    centrals.push(central);
    offset += local.length + file.data.length;
  }
  const centralSize = centrals.reduce((n, part) => n + part.length, 0);
  const end = new Uint8Array(22);
  const tail = new DataView(end.buffer);
  tail.setUint32(0, 0x06054b50, true);
  tail.setUint16(8, files.length, true);
  tail.setUint16(10, files.length, true);
  tail.setUint32(12, centralSize, true);
  tail.setUint32(16, offset, true);
  const all = [...locals, ...centrals, end];
  const out = new Uint8Array(all.reduce((n, part) => n + part.length, 0));
  let cursor = 0;
  for (const part of all) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function downloadDirect(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Ola 4 (BZ-70): un archivo de copia nace como «.tmp» y solo gana su nombre
// bueno cuando su contenido quedó entero en disco — un corte a mitad nunca
// deja un archivo con nombre de copia buena y contenido truncado.
// 1.6.01 (campaña Prejuicio R2, R2C-8): el camino sin `move()` escribía el
// nombre final DIRECTO, y un fallo a mitad de esa escritura dejaba el
// archivo truncado con su nombre bueno puesto (el paquete limpiaba en su
// catch; la rotativa no). Ahora la propia writeDirFile limpia ante cualquier
// fallo — temporal y, si la escritura final llegó a tocarse, también el
// nombre final — y ambas rutas heredan la disciplina.
async function writeDirFile(dir: DirHandle, name: string, blob: Blob): Promise<void> {
  const tmpName = `${name}.tmp`;
  let finalTouched = false;
  try {
    const tmp = await dir.getFileHandle(tmpName, { create: true });
    const writable = await tmp.createWritable();
    await writable.write(blob);
    await writable.close();
    const movable = tmp as unknown as { move?: (dest: string) => Promise<void> };
    if (typeof movable.move === "function") {
      await movable.move(name);
      return;
    }
    finalTouched = true;
    const final = await dir.getFileHandle(name, { create: true });
    const w2 = await final.createWritable();
    await w2.write(blob);
    await w2.close();
    await dir.removeEntry(tmpName);
  } catch (err) {
    await dir.removeEntry(tmpName).catch(() => undefined);
    if (finalTouched) await dir.removeEntry(name).catch(() => undefined);
    throw err;
  }
}

export async function writeBackupBundle(parts: { json: string; pdf: Uint8Array; xls: Uint8Array }): Promise<"folder" | "downloaded"> {
  const stamp = stampBase();
  const files = [
    { name: `${stamp}.json`, blob: new Blob([parts.json], { type: "application/json" }) },
    { name: `${stamp}.pdf`, blob: bytesBlob(parts.pdf, "application/pdf") },
    { name: `${stamp}.xls`, blob: bytesBlob(parts.xls, "application/vnd.ms-excel") },
  ];
  const dir = await usableDir();
  if (!dir) {
    const packed = zipStore([
      { name: `${stamp}.json`, data: new TextEncoder().encode(parts.json) },
      { name: `${stamp}.pdf`, data: parts.pdf },
      { name: `${stamp}.xls`, data: parts.xls },
    ]);
    const zipName = `${stamp}.zip`;
    downloadDirect(zipName, bytesBlob(packed, "application/zip"));
    // Ola 4 (BZ-9): dentro de la app, el «descargado» se dice solo cuando
    // el puente confirma el guardado del ZIP; si falló, esto lanza y el
    // aviso de Ajustes es el de error, no el de éxito.
    await settleNativeSave(zipName);
    return "downloaded";
  }
  // Ola 4 (BZ-70): los tres archivos se escriben como «.tmp» y ganan su
  // nombre al completarse; si uno falla, se borra todo lo de este sello
  // (finales y temporales) y el error nombra el archivo que falló, para
  // que el aviso lo diga — nunca queda un paquete a medias con buen nombre.
  try {
    for (const file of files) {
      try {
        await writeDirFile(dir, file.name, file.blob);
      } catch {
        const err = new Error(file.name);
        err.name = "BundleFileError";
        throw err;
      }
    }
  } catch (err) {
    for (const file of files) {
      await dir.removeEntry(file.name).catch(() => undefined);
      await dir.removeEntry(`${file.name}.tmp`).catch(() => undefined);
    }
    throw err;
  }
  const names: string[] = [];
  for await (const [entryName, entry] of dir.entries()) {
    if (entry.kind !== "file") continue;
    if (entryName.startsWith("Brizna_") || entryName.startsWith("Podalia_") || entryName.startsWith("oscar-copia-")) names.push(entryName);
  }
  // 1.6.15 (Prejuicio R4, R5C-2): la poda rota DENTRO de cada familia de
  // prefijo — ordenar mezclando épocas ponía cualquier nombre legado
  // (Podalia_, oscar-copia-) tras cualquier Brizna_ nuevo, y con 5 legadas
  // la poda borraba la .json recién escrita cantando éxito. Dentro de una
  // familia el nombre trae su fecha y el orden lexicográfico es el orden
  // del tiempo; entre familias nadie desplaza a nadie.
  const keep = (ext: string) => {
    const doomed: string[] = [];
    for (const prefix of ["Brizna_", "Podalia_", "oscar-copia-"]) {
      const group = names.filter((name) => name.startsWith(prefix) && name.endsWith(ext)).sort();
      doomed.push(...group.slice(0, Math.max(0, group.length - 5)));
    }
    return doomed;
  };
  for (const old of [...keep(".json"), ...keep(".pdf"), ...keep(".xls")]) await dir.removeEntry(old);
  return "folder";
}

export async function writeRotatingBackup(json: string): Promise<"folder" | "downloaded"> {
  const name = `${stampBase()}.json`;
  const blob = new Blob([json], { type: "application/json" });
  const dir = await usableDir();
  if (!dir) {
    await saveBlobFile(name, blob, {
      description: "Copia de seguridad JSON",
      accept: { "application/json": [".json"] },
    });
    return "downloaded";
  }
  // Ola 4 (BZ-70): la copia rotativa gana la misma disciplina — nace como
  // «.tmp» y solo gana su nombre cuando quedó entera en disco.
  await writeDirFile(dir, name, blob);
  const names: string[] = [];
  for await (const [entryName, entry] of dir.entries()) {
    if (entry.kind === "file" && entryName.startsWith("oscar-copia-") && entryName.endsWith(".json")) names.push(entryName);
  }
  names.sort();
  for (const old of names.slice(0, Math.max(0, names.length - 5))) await dir.removeEntry(old);
  return "folder";
}
