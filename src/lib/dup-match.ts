/**
 * 1.5.02: who looks like the same client. Pure (used by the local server functions and by the batch screen).
 * Same or near-same name (accents, case, spacing, punctuation, word order, one typo), same phone
 * (last 10 digits, 7 or more), or same address (number + street words, common abbreviations folded).
 */

export type DupWhy = "name" | "near" | "phone" | "address";

export function foldText(s: string | null | undefined): string {
  // 1.6.04 (Prejuicio R2, R2F-1): la clase final conserva TODA letra y dígito
  // Unicode, no solo el latín. Antes un nombre en chino, árabe o cirílico se
  // plegaba a "" y su identidad desaparecía para cada consumidor de la clave
  // (la tanda lo fundía con otro, el servidor no lo fundía consigo mismo y la
  // revisión de duplicados ni lo miraba). El comportamiento latino no cambia:
  // NFD + quitar diacríticos ya resolvía acentos y ñ antes de esta clase.
  // 1.6.08 (Prejuicio R3, R3F-7): las marcas se quitan con \p{M} — TODAS las
  // marcas combinantes, no solo el rango latino U+0300–U+036F. El niqqud
  // hebreo, las harakat árabes y los signos vocálicos devanagari quedaban
  // fuera del rango y la clase final los volvía separadores: el mismo
  // nombre vocalizado y sin vocalizar partía su identidad en dos claves, y
  // dos nombres distintos se leían «near». Así este pliegue y el de fuzzy.ts
  // (que ya usaba \p{M}) pliegan igual.
  // 1.6.12 (Prejuicio R3, R4F-3): la tira se refina a Mn+Me. Los signos
  // vocálicos devanagari son Mc — letras plenas que siempre se escriben
  // (ि corta contra ी larga distinguen personas) — y \p{M} entero los
  // fundía: दिनेश y दीनेश salían la misma clave y la tanda fundía a la
  // segunda persona en silencio. El niqqud y las harakat son Mn (vocali-
  // zación opcional): siguen cayendo, y los dos pliegues siguen de acuerdo.
  // 1.6.14 (Prejuicio R4, R5F-1): la cura de arriba estaba ROTA — la clase
  // final [^\p{L}\p{N}]+ borraba las Mc que la tira acababa de salvar (una
  // Mc no es ni L ni N): दिनेश y दीनेश seguían saliendo la misma clave.
  // La clase final conserva ahora TODA marca que sobrevivió a la tira.
  // 1.6.14 (R5F-5): el nukta índico (Mn) SÍ distingue personas (क़ qa ≢ क
  // ka) — se protege de la tira con un marcador y se restaura tras ella.
  // 1.6.14 (R5F-4): el «am» tailandés/lao precompuesto (Lo) y su forma
  // descompuesta (Mn + vocal) se unifican a mano: NFD no lo descompone.
  // 1.6.14 (R5F-6): el tatweel árabe (ـ, Lm) es alargamiento puro, nunca
  // distingue a nadie: se quita entero.
  // 1.6.16 (Prejuicio R5, R6F-6): NFKC primero — las formas de
  // presentación árabes y el latín de ancho completo no se descomponen
  // con NFD y la identidad se partía al pegar desde un PDF o un IME.
  // 1.6.16 (R6F-2): las variantes de teclado árabe/persa se unifican
  // (yeh persa U+06CC a yeh U+064A; keheh U+06A9 a kaf U+0643; alef
  // maksura U+0649 a yeh): dos teclados para la misma lengua, y las
  // listas reales mezclan ambas formas. 1.6.16 (R6F-5): el chillu
  // malayalam y su forma consonante+virama+ZWJ se unifican ANTES de
  // quitar el ZWJ. 1.6.16 (R6F-10): el ZWNJ/ZWJ restante se quita —
  // invisible, y partía la clave de tanda en dos tokens. 1.6.16
  // (R6F-1): el virama a FINAL de palabra SÍ es identidad (en tamil el
  // pulli final es la ortografía normal de la consonante final): se
  // protege de la tira como el nukta; el virama interno (los
  // conjuntos) sigue cayendo. 1.6.16 (R6F-3): la sigma final griega
  // (U+03C2) se unifica con la sigma normal tras las minúsculas.
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/([കണനരലള])്‍/g, (m, c: string) => CHILLU[c] ?? m)
    // 1.6.22 (Prejuicio R7, R8F-9): el chillu también se escribe
    // consonante+virama A SECAS (sin ZWJ) a final de palabra — las
    // fuentes lo pintan igual, y sin esta unificación la forma seca
    // caía bajo la protección del virama final y partía a la persona
    // en dos. Solo a final de palabra y solo las seis letras chillu:
    // el chillu sigue distinto de la consonante desnuda.
    .replace(/([കണനരലള])്(?!\p{M}*[\p{L}\p{N}])/gu, (m, c: string) => CHILLU[c] ?? m)
    .normalize("NFD")
    .replace(/\u0640/g, "")
    .replace(/\u0E33/g, "\u0E4D\u0E32")
    .replace(/\u0EB3/g, "\u0ECD\u0EB2")
    .replace(/[\u093C\u09BC\u0A3C\u0ABC\u0B3C\u0D3C\u0E4D\u0ECD\u1037]/g, (ch) => NUKTA_SLOTS[ch] ?? ch)
    .replace(/\u06CC/g, "ي")
    // 1.6.25 (Prejuicio R8, R9F-4): el yeh barree urdu (U+06D2) es
    // la misma terminación que el yeh arábigo en علی y tantos
    // nombres — sin unificar, el nombre suelto no casaba consigo.
    .replace(/\u06D2/g, "ي")
    .replace(/\u06A9/g, "ك")
    .replace(/\u0649/g, "ي")
    // 1.6.22 (Prejuicio R7, R8F-7/R8F-8): la familia heh urdu
    // (U+06C1 final, U+06BE medial) es la misma letra que la heh
    // árabe (U+0647), y el alef wasla (U+0671) es un alef (U+0627)
    // — sin unificar, el mismo nombre en teclado urdu o copiado de
    // un texto con wasla partía su identidad en dos.
    .replace(/\u06C1/g, "ه")
    .replace(/\u06BE/g, "ه")
    .replace(/\u0671/g, "ا")
    // 1.6.19 (Prejuicio R6, R7F-12): las letras finales hebreas son la
    // misma letra al final de la palabra (ך כ, ם מ, ן נ, ף פ, ץ צ) —
    // sin unificar, אברהם y su grafía no final nacían dos personas.
    .replace(/[\u05DA\u05DD\u05DF\u05E3\u05E5]/g, (ch) => HEBREW_FINALS[ch] ?? ch)
    .replace(/[‌‍]/g, "")
    .replace(/([\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D\u1039\u103A\u0DCA\u17CB])(?!\p{M}*[\p{L}\p{N}])/gu, (ch) => VIRAMA_SLOTS[ch] ?? ch)
    .replace(/[\p{Mn}\p{Me}]/gu, "")
    .replace(/[\uE000-\uE008]/g, (ch) => NUKTA_BACK[ch] ?? ch)
    .replace(/[\uE010-\uE01C]/g, (ch) => VIRAMA_BACK[ch] ?? ch)
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 1.6.14 (R5F-5): los nukta índicos — marcas Mn que distinguen personas.
// Se esconden tras marcadores de uso privado mientras la tira Mn+Me pasa.
const NUKTA_SLOTS: Record<string, string> = {
  "\u093C": "\uE000", "\u09BC": "\uE001", "\u0A3C": "\uE002",
  "\u0ABC": "\uE003", "\u0B3C": "\uE004", "\u0D3C": "\uE005",
  // 1.6.19 (Prejuicio R6, R7F-10): el nikkhahit del «am» tailandés/lao
  // — la unificación lo produce y la tira se lo comía, fundiendo «am»
  // con «aa» (อำนาจ Amnat salía อานาจ). Protegido como el nukta: «am»
  // es un sonido, no una vocalización opcional.
  "\u0E4D": "\uE006", "\u0ECD": "\uE007",
  // 1.6.19 (R7F-2, la mitad que faltaba): el punto inferior birmano
  // (U+1037) es ortografía plena, no vocalización opcional — မြင့်
  // (Myint) y မြင် (Myin) solo se distinguen por él.
  "\u1037": "\uE008",
};
// 1.6.19 (R7F-12): la forma final hebrea y su forma corriente.
const HEBREW_FINALS: Record<string, string> = {
  "\u05DA": "\u05DB", "\u05DD": "\u05DE", "\u05DF": "\u05E0",
  "\u05E3": "\u05E4", "\u05E5": "\u05E6",
};

const NUKTA_BACK: Record<string, string> = Object.fromEntries(
  Object.entries(NUKTA_SLOTS).map(([k, v]) => [v, k]),
);

// 1.6.16 (R6F-5): el chillu malayalam y su forma larga (consonante +
// virama + ZWJ) — el mapa de la unificación en foldText.
const CHILLU: Record<string, string> = {
  "\u0D15": "\u0D7F", "\u0D23": "\u0D7A", "\u0D28": "\u0D7B",
  "\u0D30": "\u0D7C", "\u0D32": "\u0D7D", "\u0D33": "\u0D7E",
};

// 1.6.16 (R6F-1): los viramas índicos — a final de palabra distinguen
// personas (Kumar con pulli final no es Kumara). Se esconden tras
// marcadores de uso privado mientras la tira Mn+Me pasa, como el nukta.
const VIRAMA_SLOTS: Record<string, string> = {
  "\u094D": "\uE010", "\u09CD": "\uE011", "\u0A4D": "\uE012",
  "\u0ACD": "\uE013", "\u0B4D": "\uE014", "\u0BCD": "\uE015",
  "\u0C4D": "\uE016", "\u0CCD": "\uE017", "\u0D4D": "\uE018",
  // 1.6.19 (Prejuicio R6, R7F-2/3/4): el mapa llegaba hasta la India —
  // el asat birmano (U+1039 y su forma U+103A), el al-lakuna cingalés
  // (U+0DCA) y el bantoc jemer (U+17CB) matan la vocal final igual y
  // fundían Myint con Myin, Kamal con Kamala y Chann con Chan.
  "\u1039": "\uE019", "\u103A": "\uE01A", "\u0DCA": "\uE01B",
  "\u17CB": "\uE01C",
};
const VIRAMA_BACK: Record<string, string> = Object.fromEntries(
  Object.entries(VIRAMA_SLOTS).map(([k, v]) => [v, k]),
);

export function nameKey(name: string): string {
  return foldText(name);
}

/** La identidad de un nombre dentro de una tanda (pegar varios, crear en
 *  lote): la clave plegada cuando el nombre tiene una; si no tiene ninguna
 *  (un nombre sin letras ni dígitos, p. ej. solo un símbolo), el nombre
 *  crudo normalizado — dos nombres DISTINTOS sin clave jamás se funden, y
 *  el mismo nombre sin clave sí se funde consigo mismo (BZ-53 en ambas
 *  capas, R2F-2/R2F-3). */
export function batchKeyOf(name: string): string {
  const key = nameKey(name);
  return key ? `k:${key}` : `r:${String(name ?? "").replace(/\s+/g, " ").trim().toLowerCase()}`;
}

function tokens(name: string): string[] {
  return nameKey(name).split(" ").filter(Boolean);
}

/** Levenshtein distance, capped (returns cap+1 once it is clearly over). */
function lev(a: string, b: string, cap = 2): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev2: number[] | null = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // 1.6.12 (Prejuicio R3, R4F-5): la transposición adyacente cuesta 1
      // (Damerau) — es EL typo de la mano («Jonh» por «John») y la distancia
      // clásica lo cobraba como 2, invisible bajo el tope de los nombres
      // medianos: la revisión perdía el duplicado más probable.
      if (prev2 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > cap) return cap + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** "same": identical once folded. "near": same words in another order, or one or two typos on a long name. */
export function nameMatch(a: string, b: string): "same" | "near" | null {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (!ka || !kb) return null;
  if (ka === kb) return "same";
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length > 1 && [...ta].sort().join(" ") === [...tb].sort().join(" ")) return "near";
  const compactA = ka.replace(/ /g, "");
  const compactB = kb.replace(/ /g, "");
  if (compactA === compactB) return "near";
  const len = Math.min(compactA.length, compactB.length);
  if (len >= 6) {
    const cap = len >= 12 ? 2 : 1;
    if (lev(compactA, compactB, cap) <= cap) return "near";
  }
  return null;
}

// 1.6.16 (Prejuicio R5, R6F-7): los dígitos decimales de cualquier
// escritura (arábigo-índicos, de ancho completo, devanagari…) valen
// como dígitos — \d solo conoce el ASCII y la identidad telefónica
// de esos números nacía muerta.
const ND_ZEROS = [0x30, 0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xde6, 0xe50, 0xed0, 0xf20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0, 0xff10,
  // 1.6.19 (Prejuicio R6, R7F-8): los bloques Nd vivos que faltaban —
  // osmanya, sharada, takri, adlam y el resto de escrituras con
  // dígitos propios; sin su cero, el dígito volvía intacto y el \D
  // posterior lo borraba: esos teléfonos nacían sin identidad.
  0x104a0, 0x10d30, 0x11066, 0x110f0, 0x11136, 0x111d0, 0x112f0, 0x11450, 0x114d0, 0x11650, 0x116c0, 0x11730, 0x118e0, 0x11950, 0x11c50, 0x11d50, 0x11da0, 0x11f50, 0x16a60, 0x16ac0, 0x16b50, 0x1d7ce, 0x1d7d8, 0x1d7e2, 0x1d7ec, 0x1d7f6, 0x1e140, 0x1e2f0, 0x1e4f0, 0x1e950, 0x1fbf0,
  // 1.6.22 (Prejuicio R7, R8F-10): los bloques Nd de Unicode 16/17
  // (garay, kirat rai y los demás) — la tabla se cierra contra el
  // barrido exhaustivo de bloques del runtime, no de memoria.
  0x10d40, 0x116d0, 0x116da, 0x11bf0, 0x11de0, 0x16130, 0x16d70, 0x1ccf0, 0x1e5f1];

export function digitsOf(s: string | null | undefined): string {
  return String(s ?? "").replace(/\p{Nd}/gu, (ch) => {
    const cp = ch.codePointAt(0)!;
    for (const z of ND_ZEROS) if (cp >= z && cp <= z + 9) return String(cp - z);
    return ch;
  });
}

export function phoneTail(phone: string | null | undefined): string {
  // 1.6.19 (Prejuicio R6, R7F-7): la extensión anotada («ext 89») sumaba
  // sus dígitos al final y desplazaba la ventana de 10 fuera del
  // número — el mismo teléfono con y sin extensión no casaba consigo.
  // 1.6.25 (Prejuicio R8, R9F-3): la familia crece — «extension:» con
  // dos puntos, «ext-» con guion, la palabra española entera
  // «extensión», extensiones de hasta diez dígitos y el paréntesis
  // de cierre tras los dígitos ya no envenenan la cola.
  // 1.6.28 (Prejuicio R9, R10F-6/R10F-7): la familia crece por un
  // lado y se acota por el otro. Crece: «poste 89» (francés) y
  // «(ext) 89» (el paréntesis de cierre tras la palabra). Se acota:
  // la «x»/«#» solo corta si delante queda un número entero (≥7
  // dígitos) — en «305x5550142» la x es el separador interno del
  // propio número, y cortarla dejaba la cola vacía.
  const rawPhone = String(phone ?? "");
  // 1.6.42 (Prejuicio R11, R12F-7/R12F-8): la familia de palabra
  // aprende «anexo» — la palabra corriente en español para la
  // extensión, que faltaba: «3055550142 anexo 89» no casaba con el
  // número desnudo. Y la rama entera hereda la guarda de la rama
  // x/#: solo corta cuando delante queda un número entero (≥7) o
  // el sufijo no llega a número (<7); con prefijo corto y sufijo
  // de ≥7, la «extensión» ES el número («550142 ext 3055550142»)
  // y cortarla dejaba la cola vacía donde su gemela con «x» daba
  // el número entero.
  // 1.6.48 (Prejuicio R13, R14F-4): la familia viste UN solo traje
  // — cada palabra admite el paréntesis de cierre y el punto tras
  // ella y el separador (o ninguno) antes de los dígitos:
  // «(interno) 89», «poste: 89» y «poste89» cortan como «ext. 89».
  // Y la familia queda entera: «int» (la abreviatura de interno,
  // gemela de «ext») y «extensão» (el portugués entero) entran.
  const wordExt = rawPhone.match(/(?:\b(?:ext(?:ensi[oó]n|ensão|ensao)?|interno|int|anexo|ramal|poste)\)?\.?\s*[-:]?\s*)\d{1,10}\s*\)?\s*$/i);
  let bare = rawPhone;
  if (wordExt) {
    const pre = digitsOf(rawPhone.slice(0, wordExt.index)).replace(/\D/g, "").length;
    const suf = digitsOf(wordExt[0]).replace(/\D/g, "").length;
    if (pre >= 7 || suf < 7) bare = rawPhone.slice(0, wordExt.index);
  }
  if (bare === rawPhone) {
    // 1.6.46 (Prejuicio R12, R13F-6): la escritura PEGADA — entre un
    // dígito y la «e» de «ext» no hay frontera de palabra, y la
    // rama de palabra no cortaba «…0142ext89» (la de «x» sí corta
    // la suya pegada). La palabra pegada tras un dígito corta con
    // la misma guarda: el dígito de la costura es del número.
    const glued = rawPhone.match(/\d(ext(?:ensi[oó]n|ensão|ensao)?|anexo|interno|ramal|poste|int)\s*[-:]?\s*(\d{1,10})\s*\)?\s*$/i);
    if (glued) {
      const cutAt = glued.index! + 1;
      const pre = digitsOf(rawPhone.slice(0, cutAt)).replace(/\D/g, "").length;
      const suf = digitsOf(glued[2]!).replace(/\D/g, "").length;
      if (pre >= 7 || suf < 7) bare = rawPhone.slice(0, cutAt);
    }
  }
  if (bare === rawPhone) {
    // 1.6.32 (Prejuicio R10, R11F-8/R11F-9): la rama recobra su /i
    // («X89» corta como «x89» — la reestructura de 1.6.28 lo perdió),
    // y cuando ni el prefijo ni el sufijo llegan a número (los dos
    // cortos: «550142x89»), el sufijo es una extensión de un número
    // que no es teléfono: la cola es "" como en la rama de palabra,
    // en vez de fabricarse con los dígitos de la extensión. Si el
    // sufijo trae ≥7 dígitos, la «x» es separador interno del propio
    // número («305x5550142») y no se corta — la línea de R10F-7.
    const mx = rawPhone.match(/[x#]\s*\d{1,10}\s*$/i);
    if (mx) {
      const pre = digitsOf(rawPhone.slice(0, mx.index)).replace(/\D/g, "").length;
      const suf = digitsOf(mx[0]).replace(/\D/g, "").length;
      if (pre >= 7 || suf < 7) bare = rawPhone.slice(0, mx.index);
    }
  }
  const digits = digitsOf(bare).replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : "";
}

const ABBR: Record<string, string> = {
  street: "st", str: "st", avenue: "ave", av: "ave", avenida: "ave", road: "rd", drive: "dr", court: "ct", place: "pl",
  lane: "ln", boulevard: "blvd", terrace: "ter", terr: "ter", circle: "cir", highway: "hwy", parkway: "pkwy",
  southwest: "sw", southeast: "se", northwest: "nw", northeast: "ne", north: "n", south: "s", east: "e", west: "w",
  apartment: "apt", calle: "st", trail: "trl", square: "sq",
};

const SUFFIX = new Set(["st", "ave", "rd", "dr", "ct", "pl", "ln", "blvd", "ter", "cir", "hwy", "pkwy", "way", "trl", "path", "loop", "sq"]);

/** House number + the street words up to the street type (St, Ave, Terr…), abbreviations folded, so the city or
 *  zip written or not does not matter; "" when there is no number to anchor it. */
export function addressKey(address: string | null | undefined): string {
  // 1.6.25 (Prejuicio R8, R9F-6): el número de la casa también se
  // lee en cualquier sistema de dígitos — la ley de digitsOf llega
  // por fin a la puerta de la dirección: «٣٠٥ Calle Sol» ancla
  // igual que «305 Calle Sol».
  const words = digitsOf(foldText(address)).split(" ").filter(Boolean).map((w) => ABBR[w] ?? w);
  const at = words.findIndex((w) => /^\d+$/.test(w));
  if (at < 0) return "";
  const rest = words.slice(at, at + 6);
  const end = rest.findIndex((w, i) => i > 0 && SUFFIX.has(w));
  const street = (end > 0 ? rest.slice(0, end + 1) : rest.slice(0, 4)).filter((w) => w !== "apt" && w !== "unit");
  return street.length >= 2 ? street.join(" ") : "";
}

export type DupCandidate = { id: number; name: string; phone: string | null; address: string | null };

export function whyMatch(row: { name: string; phone?: string | null; address?: string | null }, c: DupCandidate): DupWhy[] {
  const why: DupWhy[] = [];
  const nm = nameMatch(row.name, c.name);
  if (nm === "same") why.push("name");
  else if (nm === "near") why.push("near");
  const pa = phoneTail(row.phone);
  if (pa && pa === phoneTail(c.phone)) why.push("phone");
  const aa = addressKey(row.address);
  if (aa && aa === addressKey(c.address)) why.push("address");
  return why;
}

/** Existing clients that look like `row`, strongest first (name+phone beats a lone near name). */
export function findLike<T extends DupCandidate>(row: { name: string; phone?: string | null; address?: string | null }, list: T[], excludeId?: number) {
  const score = (why: DupWhy[]) => why.reduce((t, w) => t + (w === "name" ? 4 : w === "phone" ? 4 : w === "address" ? 3 : 2), 0);
  return list
    .filter((c) => c.id !== excludeId)
    .map((c) => ({ c, why: whyMatch(row, c) }))
    .filter((x) => x.why.length > 0)
    .sort((a, b) => score(b.why) - score(a.why) || a.c.name.localeCompare(b.c.name))
    .slice(0, 5);
}

/** Groups of existing clients that look like each other (union of every matching pair). */
export function duplicateGroups<T extends DupCandidate>(list: T[]): { members: T[]; why: DupWhy[] }[] {
  const parent = new Map<number, number>(list.map((c) => [c.id, c.id]));
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const whyBy = new Map<number, Set<DupWhy>>();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const why = whyMatch(list[i], list[j]);
      if (!why.length) continue;
      const a = find(list[i].id);
      const b = find(list[j].id);
      if (a !== b) parent.set(b, a);
      const root = find(list[i].id);
      const set = whyBy.get(root) ?? new Set<DupWhy>();
      why.forEach((w) => set.add(w));
      whyBy.set(root, set);
    }
  }
  const groups = new Map<number, T[]>();
  for (const c of list) {
    const r = find(c.id);
    groups.set(r, [...(groups.get(r) ?? []), c]);
  }
  const out: { members: T[]; why: DupWhy[] }[] = [];
  for (const [root, members] of groups) {
    if (members.length < 2) continue;
    const why = new Set<DupWhy>();
    for (const [k, v] of whyBy) if (find(k) === root) v.forEach((w) => why.add(w));
    out.push({ members, why: [...why] });
  }
  return out;
}
