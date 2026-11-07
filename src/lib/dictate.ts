/**
 * 1.5.05 "Dictar": one way to listen for the message composer, whatever runs Brizna.
 * 1. Brizna for Android (android-4 and later): the phone's own speech recognizer (BriznaNative.dictate), on-device
 *    first. A plain WebView has webkitSpeechRecognition but it always fails ("not-allowed"), so it is never used there.
 *    Android asks for the microphone the first time; a refusal comes back as "denied" (Android asks again) or
 *    "blocked" (only the app's settings can allow it).
 * 2. Brizna for Android before android-4: no way to listen; the person is asked to update the app.
 * 3. A browser or the installed web app: Web Speech recognition (SpeechRecognition / webkitSpeechRecognition).
 * Partial text streams to onPartial while the person speaks; onFinal gets the whole line once.
 */
import { inAndroidApp, native } from "@/spa/native";

export type DictState = "asking" | "listening" | "processing";
export type DictError =
  | "no-speech"
  | "denied"
  | "blocked"
  | "offline"
  | "busy"
  | "none"
  | "failed"
  | "update"
  | "browser-blocked";

export type DictHandlers = {
  onState?: (s: DictState) => void;
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (e: DictError) => void;
  /** Called once when listening is over, whatever the outcome. */
  onEnd?: () => void;
};

export type DictSession = { stop: () => void; cancel: () => void };

const es = () => typeof document === "undefined" || document.documentElement.lang !== "en";

/** One line per outcome; Brizna never names another app. `action` is the one tap that fixes it, when there is one. */
export function dictMessage(e: DictError): { text: string; action?: "retry" | "settings" } {
  const s = es();
  switch (e) {
    case "denied":
      return { text: s ? "Brizna necesita el micrófono para dictar" : "Brizna needs the microphone to dictate", action: "retry" };
    case "blocked":
      return {
        text: s ? "Brizna necesita el micrófono: Permisos › Micrófono › Permitir" : "Brizna needs the microphone: Permissions › Microphone › Allow",
        action: "settings",
      };
    case "update":
      return { text: s ? "Para dictar, actualiza la app Brizna. Puedes escribir igual." : "To dictate, update the Brizna app. You can still type." };
    case "browser-blocked":
      return {
        text: s
          ? "El navegador bloqueó el micrófono: toca el candado › Micrófono › Permitir"
          : "The browser blocked the microphone: tap the lock › Microphone › Allow",
      };
    case "no-speech":
      return { text: s ? "No se oyó nada. Acerca el teléfono y toca Dictar otra vez." : "Nothing was heard. Bring the phone closer and tap Dictate again." };
    case "offline":
      return { text: s ? "Sin conexión: no se pudo dictar" : "Offline: could not dictate" };
    case "busy":
      return { text: s ? "El micrófono está ocupado. Toca Dictar otra vez." : "The microphone is busy. Tap Dictate again." };
    case "none":
      return { text: s ? "Este teléfono no permite dictar. Escribe el mensaje." : "This phone cannot dictate. Type the message." };
    default:
      return { text: s ? "No se pudo dictar. Escribe el mensaje." : "Could not dictate. Type the message." };
  }
}

/** The app's settings page (Permisos › Micrófono). Only inside the Android app. */
export function openDictationSettings() {
  try { native()?.openAppSettings?.(); } catch { /* ignore */ }
}

/* ---------- 1. Android app ---------- */

type Detail = { id: string; state?: string; partial?: string; ok?: boolean; text?: string; error?: string };
const NATIVE_ERRORS: DictError[] = ["no-speech", "denied", "blocked", "offline", "busy", "none", "failed"];

function viaNative(lang: string, h: DictHandlers): DictSession {
  const n = native()!;
  const id = Math.random().toString(36).slice(2);
  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    window.removeEventListener("briznanative-dictate", on);
    h.onEnd?.();
  };
  const on = (ev: Event) => {
    const d = (ev as CustomEvent<Detail>).detail;
    if (!d || d.id !== id || over) return;
    if (d.state === "asking" || d.state === "listening" || d.state === "processing") { h.onState?.(d.state); return; }
    if (typeof d.partial === "string") { h.onPartial?.(d.partial); return; }
    if (d.ok && d.text) h.onFinal(d.text);
    else h.onError(NATIVE_ERRORS.includes(d.error as DictError) ? (d.error as DictError) : "failed");
    end();
  };
  window.addEventListener("briznanative-dictate", on);
  try { n.dictate!(id, lang); } catch { h.onError("failed"); end(); }
  return {
    stop: () => { if (!over) { try { n.dictateStop?.(id); } catch { /* ignore */ } } },
    cancel: () => { if (!over) { try { n.dictateCancel?.(); } catch { /* ignore */ } end(); } },
  };
}

/* ---------- 3. browsers ---------- */

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { resultIndex?: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

function speechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function viaWeb(Ctor: new () => SpeechRec, lang: string, h: DictHandlers): DictSession {
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = true;
  let over = false;
  let failed = false;
  let final = "";
  let partial = "";
  const end = () => {
    if (over) return;
    over = true;
    if (!failed) {
      const t = (final || partial).trim();
      if (t) h.onFinal(t);
      else h.onError("no-speech");
    }
    h.onEnd?.();
  };
  rec.onstart = () => h.onState?.("listening");
  rec.onresult = (ev) => {
    let fin = "";
    let tmp = "";
    for (let i = 0; i < ev.results.length; i++) {
      const r = ev.results[i];
      const t = r?.[0]?.transcript ?? "";
      if (r.isFinal === false) tmp += t;
      else fin += t;
    }
    final = fin.trim();
    partial = `${fin} ${tmp}`.replace(/\s+/g, " ").trim();
    if (partial) h.onPartial?.(partial);
  };
  rec.onerror = (ev) => {
    const code = ev?.error ?? "";
    if (code === "aborted") return;
    if (code === "no-speech" && (final || partial)) return;
    failed = true;
    h.onError(
      code === "not-allowed" || code === "service-not-allowed"
        ? "browser-blocked"
        : code === "no-speech"
          ? "no-speech"
          : code === "network"
            ? "offline"
            : "failed",
    );
  };
  rec.onend = end;
  try { rec.start(); } catch { failed = true; h.onError("failed"); end(); }
  return {
    stop: () => { try { rec.stop(); } catch { /* ignore */ } },
    cancel: () => {
      failed = true;
      try { (rec.abort ?? rec.stop).call(rec); } catch { /* ignore */ }
      end();
    },
  };
}

/** Starts listening in `lang` (es-US or en-US). */
export function startDictation(lang: string, h: DictHandlers): DictSession {
  const n = native();
  if (n && typeof n.dictate === "function") return viaNative(lang, h);
  const late = (e: DictError): DictSession => {
    window.setTimeout(() => { h.onError(e); h.onEnd?.(); }, 0);
    return { stop: () => undefined, cancel: () => undefined };
  };
  // An older Android app: its WebView would only answer "not-allowed".
  if (inAndroidApp()) return late("update");
  const Ctor = speechCtor();
  if (!Ctor) return late("none");
  return viaWeb(Ctor, lang, h);
}
