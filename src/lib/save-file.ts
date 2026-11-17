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

function stampBaseAt(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  // 1.6.52 (Prejuicio R13, R14C-1): el nombre lleva los campos
  // UTC del instante — el par escritor/lector queda sin zona en
  // los dos extremos y la línea de 24 h de effOf es exacta en
  // términos absolutos para todo paquete nuevo, se lea donde se
  // lea. (Los nombres viejos, escritos con campos locales, se
  // leen desplazados por el huso de su escritor — ≤ 14 h,
  // dentro de la línea.) El año va relleno a cuatro, como manda
  // la familia de dates.ts desde 1.6.44: sin relleno, un reloj
  // en un año de tres dígitos escribía un nombre que stampOf no
  // sabe leer.
  return `Brizna_${String(d.getUTCFullYear()).padStart(4, "0")}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function stampBase() {
  return stampBaseAt(new Date());
}

/* 1.6.45 (Prejuicio R12, R13C-3): la marca de intento — cinco
 * caracteres al azar que viajan tras los segundos del sello. La
 * unicidad del sello ya no cuelga solo de mirar la carpeta: dos
 * aparatos en el mismo segundo de pared, con la sync aún sin
 * traer los archivos del primero a la vista del segundo, ya no
 * comparten nombre (la colisión exigiría el mismo segundo Y la
 * misma marca). 1.6.52 (Prejuicio R13, R14C-2): la cifra de esa
 * colisión estaba mal declarada — la fórmula corta los cinco
 * dígitos MÁS significativos de la base 36, de distribución
 * concentrada (toda marca «1xxxx» reúne 1333 sorteos): la
 * probabilidad real por par en el mismo segundo es Σp² =
 * 1,6168×10⁻⁷, ~1 entre 6,19 millones de pares, no ~60
 * millones (el espacio crudo 36⁵). La puerta sigue irreal; la
 * cuenta, ya no. El sello del nombre se sigue
 * leyendo igual: stampOf busca la fecha-hora sin anclar, y la
 * familia de la poda solo pide el prefijo y la extensión. */
function attemptSuffix() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]!;
  return n.toString(36).slice(0, 5).padStart(5, "0");
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
  const dir = await usableDir();
  // 1.6.41 (Prejuicio R11, R12C-2): el sello tiene resolución de
  // segundo y es hora local — dos paquetes pueden nacer con el
  // mismo (el mismo segundo, el reloj que retrocede, la hora
  // repetida del cambio de horario, dos aparatos contra la misma
  // carpeta). Si un archivo de este sello ya vive en la carpeta,
  // el sello avanza de segundo en segundo hasta ser SOLO de este
  // intento: su limpieza de fracaso jamás podrá nombrar un archivo
  // de un paquete anterior ya cantado.
  let stamp = stampBase();
  if (dir) {
    // 1.6.45 (Prejuicio R12, R13C-2/R13C-3): la consulta distingue
    // sus tres respuestas — un nombre solo está LIBRE cuando la
    // carpeta dice NotFoundError; «ocupado» y «no pude mirar»
    // (parpadeo, permiso, sync a medio despertar) hacen avanzar el
    // sello igual, porque la carpeta que parpadea al mirar es la
    // misma que falla al escribir. Y el nombre lleva la marca de
    // intento (attemptSuffix): la vista de otro aparato puede ir
    // por detrás de la carpeta de verdad sin que nada haya errado,
    // y contra esa vista ninguna consulta protege — la marca sí.
    // El avance tiene techo: diez minutos de segundos ocupados o
    // ilegibles y la copia falla en voz alta en vez de compartir
    // un sello y arriesgar el paquete ya cantado de otro.
    const suffix = attemptSuffix();
    const when = new Date();
    let advances = 0;
    for (;;) {
      let clash = false;
      for (const ext of [".json", ".pdf", ".xls"]) {
        let state: "free" | "taken" | "unknown" = "free";
        try {
          await dir.getFileHandle(`${stamp}-${suffix}${ext}`, { create: false });
          state = "taken";
        } catch (e) {
          const err = e as { name?: string; message?: string };
          state = err?.name === "NotFoundError" || err?.message === "NotFoundError" ? "free" : "unknown";
        }
        if (state !== "free") { clash = true; break; }
      }
      if (!clash) { stamp = `${stamp}-${suffix}`; break; }
      advances += 1;
      if (advances > 600) throw new Error("No se pudo encontrar un nombre libre para la copia");
      when.setSeconds(when.getSeconds() + 1);
      stamp = stampBaseAt(when);
    }
  }
  const files = [
    { name: `${stamp}.json`, blob: new Blob([parts.json], { type: "application/json" }) },
    { name: `${stamp}.pdf`, blob: bytesBlob(parts.pdf, "application/pdf") },
    { name: `${stamp}.xls`, blob: bytesBlob(parts.xls, "application/vnd.ms-excel") },
  ];
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
  // 1.6.41 (R12C-2, segunda capa): la limpieza del fracaso borra
  // los finales SOLO de los archivos que ESTE intento completó
  // (los temporales, de todos: son de este intento o basura de la
  // recogida). Antes borraba los tres finales del sello, y con un
  // sello compartido se llevaba el paquete bueno anterior entero.
  const written: string[] = [];
  try {
    for (const file of files) {
      try {
        await writeDirFile(dir, file.name, file.blob);
        written.push(file.name);
      } catch {
        const err = new Error(file.name);
        err.name = "BundleFileError";
        throw err;
      }
    }
  } catch (err) {
    for (const name of written) await dir.removeEntry(name).catch(() => undefined);
    for (const file of files) await dir.removeEntry(`${file.name}.tmp`).catch(() => undefined);
    throw err;
  }
  // 1.6.23 (Prejuicio R7, R8C-1): la poda entera vive en un
  // try/catch propio — es limpieza DESPUÉS de escribir el paquete.
  // Antes, si la lectura de la carpeta o un borrado fallaba (un
  // archivo bloqueado, una carpeta de red que parpadea), la llamada
  // entera se rechazaba y Ajustes cantaba «No se pudo guardar la
  // copia» sobre un paquete completo y válido ya en la carpeta.
  try {
  const entries: { name: string; mtime: number }[] = [];
  for await (const [entryName, entry] of dir.entries()) {
    if (entry.kind !== "file") continue;
    if (entryName.startsWith("Brizna_") || entryName.startsWith("Podalia_") || entryName.startsWith("oscar-copia-")) {
      // 1.6.26 (Prejuicio R8, R9C-1): la poda ordena por el tiempo
      // REAL del archivo, no por el nombre.
      // 1.6.29 (Prejuicio R9, R10C-1/R10C-2): pero nombre y hora
      // nacen del MISMO reloj del aparato — escritos con el reloj
      // adelantado, los dos dicen 2999 y no hay divorcio que valga;
      // y sin hora legible, el 0 ordenaba la copia como de 1970.
      // La hora en la que la poda cree («eff») se compone así: si el
      // nombre o la hora caen en el FUTURO, la copia es sospechosa
      // y baja a la clase más vieja (nada en la carpeta puede ser
      // más nuevo que la copia que se está escribiendo ahora); si
      // la hora no se lee, la copia hereda la que su nombre declara.
      // 1.6.36 (Prejuicio R10, R11C-1): refinado abajo en «effOf» —
      // la sospecha es por MARCA, no por copia.
      let mtime = 0;
      try { mtime = (await (entry as FileSystemFileHandle).getFile()).lastModified; } catch { mtime = 0; }
      entries.push({ name: entryName, mtime });
    }
  }
  // 1.6.15 (Prejuicio R4, R5C-2): la poda rota DENTRO de cada familia de
  // prefijo — ordenar mezclando épocas ponía cualquier nombre legado
  // (Podalia_, oscar-copia-) tras cualquier Brizna_ nuevo, y con 5 legadas
  // la poda borraba la .json recién escrita cantando éxito. Dentro de una
  // familia el nombre trae su fecha y el orden lexicográfico es el orden
  // del tiempo; entre familias nadie desplaza a nadie.
  // 1.6.18 (Prejuicio R5, R6C-1): lo que ESTA llamada acaba de escribir
  // jamás cae en su propia poda — el orden por nombre es el reloj del
  // aparato, y con cinco sellos posteriores en la carpeta (reloj
  // corregido, carpeta compartida) la recién escrita ordenaba la
  // primera de su familia y se borraba a sí misma cantando éxito.
  const fresh = new Set(files.map((f) => f.name));
  const nowMs = Date.now();
  const stampOf = (name: string): number => {
    // 1.6.41 (Prejuicio R11, R12C-3): los componentes se VALIDAN por
    // viaje de ida y vuelta — new Date() rueda el día 48 al mes
    // siguiente y el mes 13 al año siguiente, y un nombre mutilado
    // heredaba así un sello plausible (el 48 de octubre «era» el 17
    // de noviembre, hoy, y desplazaba a la genuina más vieja). Un
    // nombre cuyos componentes no vuelven iguales no declara sello:
    // 0, ilegible, y la hora manda.
    // 1.6.52 (Prejuicio R13, R14C-1): el sello se lee SIN ZONA —
    // los campos del nombre se interpretan como UTC, no en la
    // zona de quien lee. Antes, un paquete escrito en UTC−11 y
    // leído en UTC+14 veía su sello desplazado 25 h: cruzaba la
    // línea de 24 h de effOf y el paquete más nuevo caía podado
    // el primero. Leído sin zona, el sello queda a lo sumo a la
    // distancia del huso del ESCRITOR (≤ 14 h, dentro de la
    // línea) y la zona del lector aporta cero. La construcción
    // es la de años literales de daysBetween (1.6.44): Date.UTC
    // crudo leería 0–99 como 1900+año.
    const roundTrip = (dt: Date, y: number, mo: number, d: number, h: number, mi: number, s: number) =>
      dt.getUTCFullYear() === y && dt.getUTCMonth() === mo && dt.getUTCDate() === d && dt.getUTCHours() === h && dt.getUTCMinutes() === mi && dt.getUTCSeconds() === s
        ? dt.getTime()
        : 0;
    const utcOf = (y: number, mo: number, d: number, h: number, mi: number, s: number) => {
      const dt = new Date(0);
      dt.setUTCFullYear(y, mo, d);
      dt.setUTCHours(h, mi, s, 0);
      return roundTrip(dt, y, mo, d, h, mi, s);
    };
    const m = name.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (m) return utcOf(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!);
    // 1.6.36 (Prejuicio R10, R11C-3): el nombre legado de la familia
    // «oscar-copia-» declara solo la fecha — la herencia la oye como
    // la medianoche de ese día, no como 1970.
    const d = name.match(/(\d{4})-(\d{2})-(\d{2})/);
    return d ? utcOf(+d[1]!, +d[2]! - 1, +d[3]!, 0, 0, 0) : 0;
  };
  // 1.6.36 (Prejuicio R10, R11C-1): se desconfía de la MARCA, no de
  // la copia. Cada marca se juzga por separado: la hora real manda
  // si no miente; si miente, manda el sello del nombre si él no
  // miente. Solo cuando TODA marca legible cae en el futuro baja la
  // copia a la clase sospechosa (−1): una sola marca mentirosa ya no
  // entierra la veraz que la acompaña.
  const effOf = (e: { name: string; mtime: number }): number => {
    const stamp = stampOf(e.name);
    const mtimeTrue = e.mtime > 0 && e.mtime <= nowMs ? e.mtime : 0;
    const stampTrue = stamp > 0 && stamp <= nowMs ? stamp : 0;
    // 1.6.41 (Prejuicio R11, R12C-1): cuando la hora es veraz pero
    // pasa del sello veraz por más de un mes, las dos marcas ya no
    // describen la misma escritura — describen una escritura y una
    // RE-COPIA: manda el sello, que es la edad de la copia. Así la
    // antigüedad de 2025 re-copiada hoy ya no entierra a las
    // genuinas. Dentro del mes, la discrepancia es ruido de reloj
    // o de lote de sync y manda la hora, como siempre (el empate
    // por lotes de W2 se deshace luego contra el sello futuro).
    // 1.6.45 (Prejuicio R12, R13C-1): la línea del mes dejaba el
    // entierro ENTERO un día dentro de ella — la re-copia corriente
    // de una migración tiene justo menos de un mes. La línea baja
    // a 24 horas, el ruido verdadero (el huso más extremo del
    // planeta son 14 h; un lote de sync aterriza en horas): pasado
    // un día, las dos marcas ya no describen la misma escritura.
    // La frescura prestada que queda está acotada por esa ventana:
    // solo una copia re-copiada dentro del día de su nacimiento
    // puede tomar prestadas horas, nunca la edad de una antigüedad.
    const truth = mtimeTrue && stampTrue && mtimeTrue - stampTrue > 86_400_000 ? stampTrue : mtimeTrue || stampTrue;
    if (truth > 0) return truth;
    if (e.mtime === 0 && stamp === 0) return 0;
    return -1;
  };
  const keep = (ext: string) => {
    const doomed: string[] = [];
    for (const prefix of ["Brizna_", "Podalia_", "oscar-copia-"]) {
      const group = entries
        .filter((e) => e.name.startsWith(prefix) && e.name.endsWith(ext) && !fresh.has(e.name))
        // 1.6.29 (Prejuicio R9, R10C-3): en el empate de horas manda
        // el sello más cercano a «ahora», no el nombre mayor — el
        // mayor era sistemáticamente el sello futuro.
        // 1.6.36 (Prejuicio R10, R11C-2): la distancia se mide con el
        // sello ACOTADO a «ahora»: en el lado futuro la distancia sin
        // acotar crece con la recencia y la rotación de la clase
        // sospechosa corría al revés (moría la más nueva de la era
        // rota); acotados, todos los futuros empatan a cero y el
        // nombre — que en la familia ordena como el tiempo — hace
        // morir primero a la más vieja de la era.
        // 1.6.36 (Prejuicio R10, W2 de la caza 10): a igualdad de
        // hora veraz, el nombre que miente (sello futuro) pierde
        // contra el que no miente — en el empate por lotes de una
        // sincronización, todas las horas son la del lote y solo el
        // nombre distingue a la copia real de las que dicen 2999.
        .sort((a, b) => effOf(a) - effOf(b) || ((stampOf(a.name) > nowMs ? 0 : 1) - (stampOf(b.name) > nowMs ? 0 : 1)) || (Math.abs(Math.min(stampOf(b.name), nowMs) - nowMs) - Math.abs(Math.min(stampOf(a.name), nowMs) - nowMs)) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      doomed.push(...group.slice(0, Math.max(0, group.length - 5)).map((e) => e.name));
    }
    return doomed;
  };
  // 1.6.26 (Prejuicio R8, R9C-2): los «.tmp» de escrituras cortadas
  // fuera de todo catch (la app cerrada a mitad, el aparato
  // apagado) se recogen al cumplir una hora: un temporal vivo es
  // cosa de segundos; uno de hace una hora es de escritura muerta.
  // 1.6.29 (Prejuicio R9, R10C-4): la recogida lee la misma hora
  // «eff» — el temporal sin hora legible hereda la de su nombre, y
  // el de sello futuro es de la clase sospechosa: ninguno es ya
  // inmortal, y un temporal vivo (su hora es «ahora») no se toca.
  // 1.6.36 (Prejuicio R10, R11C-4): pero un temporal con la hora
  // LEGIBLE fresca — de hace menos de una hora, o en el futuro por
  // un reloj que patina — puede estar escribiéndose en otra
  // pestaña en este instante: la recogida no lo toca aunque su
  // sello lo haga sospechoso. La clase sospechosa de la poda de
  // paquetes no es la de la recogida de temporales.
  // 1.6.41 (Prejuicio R11, R12C-4): el escudo exige frescura
  // CUERDA — una hora hasta dos días por delante de ahora puede
  // ser un reloj que patina entre aparatos (husos, horario de
  // verano); una hora en 2999 no es un patinazo, es una marca
  // rota, y las marcas rotas no escudan: el temporal de 2999 ya
  // no es inmortal para la recogida.
  const tmpDoomed = entries
    .filter((e) => e.name.endsWith(".tmp") && effOf(e) < nowMs - 3_600_000 && !(e.mtime > nowMs - 3_600_000 && e.mtime <= nowMs + 48 * 3_600_000))
    .map((e) => e.name);
  for (const old of [...keep(".json"), ...keep(".pdf"), ...keep(".xls"), ...tmpDoomed]) await dir.removeEntry(old);
  } catch {
    // La poda no pudo con la carpeta; el paquete quedó escrito.
  }
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
