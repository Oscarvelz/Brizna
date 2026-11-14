/**
 * 1.5.04 "A inglés": Spanish → English for the message composer, free and with no key in the app.
 * 1. Brizna for Android (android-3 and later): Google ML Kit on the phone (BriznaNative.translate). The Spanish model
 *    (~30 MB) downloads once, on any network, and stays; after that it works with no internet.
 * 2. Chrome with its built-in on-device translator (window.Translator): same idea, inside the browser.
 * 3. Otherwise MyMemory (api.mymemory.translated.net, free, anonymous, about 5,000 characters a day per phone).
 *    Only the message text is sent: no name, phone, email or key.
 * The result keeps the message's ? and ! and gets a few lawn-care fixes (garden → yard, etc.).
 */
import { native } from "@/spa/native";

export type TrState = "download" | "work";
export type TrResult = { ok: true; text: string; via: "ai" | "google" | "device" | "chrome" | "web" } | { ok: false; error: string };

const es = () => typeof document === "undefined" || document.documentElement.lang !== "en";
const msg = {
  offline: () => (es() ? "Sin conexión: no se pudo traducir" : "Offline: could not translate"),
  failed: () => (es() ? "No se pudo traducir. Inténtalo otra vez" : "Could not translate. Try again"),
  quota: () => (es() ? "Se acabó la traducción gratis de hoy" : "Today's free translations are used up"),
  empty: () => (es() ? "La traducción salió vacía" : "The translation came back empty"),
};

/** Keeps ? and ! of the Spanish, capitalizes, and fixes a few words a gardener's client expects. */
export function polishEnglish(src: string, out: string): string {
  let t = out.replace(/\s+/g, " ").replace(/[¿¡]/g, "").trim();
  if (!t) return t;
  const yard = /\b(jard[ií]n|patio|yarda|grama|c[eé]sped|zacate)\b/i.test(src);
  if (yard) t = t.replace(/\bgardens\b/gi, (m) => (m[0] === "G" ? "Yards" : "yards")).replace(/\bgarden\b/gi, (m) => (m[0] === "G" ? "Yard" : "yard"));
  t = t
    .replace(/\b(cut|cutting|mow|mowing) the grass\b/gi, (m) => m.replace(/grass/i, "lawn"))
    .replace(/\bthe grama\b/gi, "the lawn")
    .replace(/\bhedges? (cut|cutting)\b/gi, "hedge trimming")
    .replace(/\s+([?!.,;:])/g, "$1");
  t = t.charAt(0).toUpperCase() + t.slice(1);
  const s = src.trim();
  const wantQ = /\?\s*$/.test(s) || /^¿/.test(s);
  const wantX = /!\s*$/.test(s) || /^¡/.test(s);
  if (wantQ && !/\?$/.test(t)) t = t.replace(/[.!]+$/, "") + "?";
  else if (wantX && !/!$/.test(t)) t = t.replace(/[.?]+$/, "") + "!";
  // 1.5.68: a plain statement ends with a period even when the Spanish was dictated without one —
  // the same finishing every other text in the app gets (punctuateUtterance's law).
  else if (!/[.?!…]$/.test(t)) t += ".";
  return t;
}

/* ---------- 1. Android app: ML Kit on the phone ---------- */
type NativeTr = { translate?(id: string, text: string): void; translateState?(): string };
function nativeTr(): NativeTr | null {
  const n = native() as unknown as NativeTr | null;
  return n && typeof n.translate === "function" ? n : null;
}
function viaDevice(n: NativeTr, text: string, onState?: (s: TrState) => void): Promise<TrResult> {
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    let done = false;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; state?: string; ok?: boolean; text?: string; error?: string }>).detail;
      if (!d || d.id !== id) return;
      if (d.state === "downloading") { onState?.("download"); return; }
      if (d.state === "working") { onState?.("work"); return; }
      done = true;
      window.removeEventListener("briznanative-translate", on);
      if (d.ok && d.text) resolve({ ok: true, text: d.text, via: "device" });
      else resolve({ ok: false, error: d.error === "offline" ? msg.offline() : msg.failed() });
    };
    window.addEventListener("briznanative-translate", on);
    try { n.translate!(id, text); } catch { window.removeEventListener("briznanative-translate", on); resolve({ ok: false, error: msg.failed() }); }
    // a first download on a slow line can take a while; give it 3 minutes
    window.setTimeout(() => { if (!done) { window.removeEventListener("briznanative-translate", on); resolve({ ok: false, error: navigator.onLine ? msg.failed() : msg.offline() }); } }, 180_000);
  });
}

/* ---------- 2. Chrome's on-device translator ---------- */
type ChromeTranslator = { translate(t: string): Promise<string> };
type TranslatorCtor = {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: { sourceLanguage: string; targetLanguage: string; monitor?: (m: EventTarget) => void }): Promise<ChromeTranslator>;
};
let chromeTr: Promise<ChromeTranslator | null> | null = null;
async function viaChrome(text: string, onState?: (s: TrState) => void): Promise<TrResult | null> {
  const T = (globalThis as { Translator?: TranslatorCtor }).Translator;
  if (!T || typeof T.availability !== "function") return null;
  try {
    if (!chromeTr) {
      const opts = { sourceLanguage: "es", targetLanguage: "en" };
      const a = await T.availability(opts);
      if (a === "unavailable" || a === "no") return null;
      if (a !== "available" && a !== "readily") onState?.("download");
      chromeTr = T.create({ ...opts, monitor: (m) => m.addEventListener("downloadprogress", () => onState?.("download")) }).catch(() => null);
    }
    const tr = await chromeTr;
    if (!tr) { chromeTr = null; return null; }
    const out = await tr.translate(text);
    return out && out.trim() ? { ok: true, text: out, via: "chrome" } : null;
  } catch {
    chromeTr = null;
    return null;
  }
}

/* ---------- 3. MyMemory (free, no key) ---------- */
/** Pieces of at most ~450 bytes (MyMemory takes 500 per request), cut at sentence ends, then at spaces. */
export function pieces(text: string, max = 450): string[] {
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  const out: string[] = [];
  let cur = "";
  for (const sent of text.match(/[^.!?\n]*[.!?\n]+|[^.!?\n]+$/g) ?? [text]) {
    const s = sent;
    if (bytes(cur + s) <= max) { cur += s; continue; }
    if (cur.trim()) out.push(cur.trim());
    cur = "";
    if (bytes(s) <= max) { cur = s; continue; }
    for (const w of s.split(/(\s+)/)) {
      if (bytes(cur + w) > max && cur.trim()) { out.push(cur.trim()); cur = ""; }
      cur += w;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
export const MYMEMORY = "https://api.mymemory.translated.net/get";
async function viaWeb(text: string): Promise<TrResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, error: msg.offline() };
  const parts: string[] = [];
  for (const q of pieces(text)) {
    let res: Response;
    try {
      const ctl = new AbortController();
      const t = window.setTimeout(() => ctl.abort(), 15_000);
      // only the text and the language pair; credentials omitted, no referrer
      res = await fetch(`${MYMEMORY}?q=${encodeURIComponent(q)}&langpair=es%7Cen`, { signal: ctl.signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
      window.clearTimeout(t);
    } catch {
      return { ok: false, error: navigator.onLine === false ? msg.offline() : msg.failed() };
    }
    if (res.status === 429) return { ok: false, error: msg.quota() };
    if (!res.ok) return { ok: false, error: msg.failed() };
    let body: { responseStatus?: number | string; responseData?: { translatedText?: string }; quotaFinished?: boolean | null };
    try { body = await res.json(); } catch { return { ok: false, error: msg.failed() }; }
    const status = Number(body.responseStatus ?? 200);
    const out = (body.responseData?.translatedText ?? "").trim();
    if (status === 429 || body.quotaFinished || /MYMEMORY WARNING/i.test(out)) return { ok: false, error: msg.quota() };
    if (status !== 200 || !out) return { ok: false, error: msg.failed() };
    parts.push(decodeEntities(out));
  }
  const text2 = parts.join(" ").trim();
  return text2 ? { ok: true, text: text2, via: "web" } : { ok: false, error: msg.empty() };
}
function decodeEntities(s: string): string {
  if (!/&[#a-z0-9]+;/i.test(s) || typeof document === "undefined") return s;
  const ta = document.createElement("textarea");
  ta.innerHTML = s;
  return ta.value;
}

/* ---------- Google Translate online (free, no key) — 1.5.69, at Oscar's request ----------
 * The public gtx endpoint: the same engine as Google Translate in the browser. Far better sentence
 * quality than the phone's on-device model («the rain I stopped me» was ML Kit). Only the message
 * text is sent. Used by the composer when there is a connection; offline keeps the device chain. */
export async function viaGoogle(text: string): Promise<TrResult | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const parts: string[] = [];
  for (const q of pieces(text)) {
    try {
      const ctl = new AbortController();
      const t = window.setTimeout(() => ctl.abort(), 15_000);
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=en&dt=t&q=${encodeURIComponent(q)}`,
        { signal: ctl.signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" },
      );
      window.clearTimeout(t);
      if (!res.ok) return null;
      const body = (await res.json()) as [Array<[string, ...unknown[]]> | null, ...unknown[]];
      const segs = body?.[0];
      if (!Array.isArray(segs)) return null;
      const out = segs.map((s) => (Array.isArray(s) ? String(s[0] ?? "") : "")).join("").trim();
      if (!out) return null;
      parts.push(out);
    } catch {
      return null;
    }
  }
  const joined = parts.join(" ").trim();
  return joined ? { ok: true, text: joined, via: "google" } : null;
}

/** Spanish message → English. onState("download") while the phone fetches its translator the first time. */
export async function translateToEnglish(text: string, onState?: (s: TrState) => void): Promise<TrResult> {
  const src = text.trim().slice(0, 2000);
  if (!src) return { ok: false, error: msg.empty() };
  let r: TrResult | null = null;
  const n = nativeTr();
  if (n) {
    r = await viaDevice(n, src, onState);
    // the phone translator failed for a reason other than being offline: the web can still try
    if (!r.ok && navigator.onLine !== false) { const w = await viaWeb(src); if (w.ok) r = w; }
  } else {
    r = (await viaChrome(src, onState)) ?? (await viaWeb(src));
  }
  if (r.ok) {
    const t = polishEnglish(src, r.text);
    return t ? { ...r, text: t } : { ok: false, error: msg.empty() };
  }
  return r;
}
