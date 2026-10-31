import type { LocaleName, PaletteName, ThemeName } from "@/lib/types";

export const THEME_KEY = "ols-theme";
export const PALETTE_KEY = "ols-palette";
export const LOCALE_KEY = "ols-locale";
export const NAME_KEY = "ols-business-name";
const LOOK_KEY = "ols-look-v2";
const MODE_KEY = "ols-appearance-mode";
const DAY_KEY = "ols-palette-day";
const NIGHT_KEY = "ols-palette-night";

export const DAY_PALETTES = ["jardin", "costa", "barro", "pino", "cielo", "lima", "arena", "flor"] as const;
export const NIGHT_PALETTES = ["noche", "medianoche", "ciruela", "grafito", "luciernaga", "amoled"] as const;
/** Night themes before Nov 2026, mapped to their closest new one. */
const OLD_NIGHT: Record<string, string> = { bosque: "noche", mar: "medianoche", tinta: "medianoche", brasa: "grafito", luna: "grafito" };
function newNight(v: string | null | undefined): string | null | undefined {
  return v && OLD_NIGHT[v] ? OLD_NIGHT[v] : v;
}

export type DayPalette = (typeof DAY_PALETTES)[number];
export type NightPalette = (typeof NIGHT_PALETTES)[number];
export type AppearanceMode = "day" | "night" | "auto";

export type Appearance = {
  mode: AppearanceMode;
  day: DayPalette;
  night: NightPalette;
};

const PALETTES: PaletteName[] = ["jardin", "costa", "barro", "pino", "cielo"];

const STATUS_BAR: Record<string, string> = {
  "day:jardin": "#efe8d6",
  "day:costa": "#e5f1f0",
  "day:barro": "#f6eee6",
  "day:pino": "#e7eee9",
  "day:cielo": "#e8eef6",
  "day:lima": "#eef6d4",
  "day:arena": "#f6efe2",
  "day:flor": "#f8eef1",
  "night:noche": "#0c110e",
  "night:medianoche": "#0a0f1a",
  "night:ciruela": "#120d16",
  "night:grafito": "#111112",
  "night:luciernaga": "#0d0f0a",
  "night:amoled": "#000000",
};

function isDayPalette(value: string | null | undefined): value is DayPalette {
  return !!value && (DAY_PALETTES as readonly string[]).includes(value);
}

function isNightPalette(value: string | null | undefined): value is NightPalette {
  return !!value && (NIGHT_PALETTES as readonly string[]).includes(value);
}

function statusBarColor(useNight: boolean, palette: string) {
  return STATUS_BAR[`${useNight ? "night" : "day"}:${palette}`] ?? (useNight ? "#0c110e" : "#efe8d6");
}

function paintStatusBar(color: string) {
  if (typeof document === "undefined") return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}

export function readStoredTheme(): ThemeName {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem(THEME_KEY) === "amoled" ? "amoled" : "light";
}

export function readStoredPalette(): PaletteName {
  if (typeof window === "undefined") return "jardin";
  const raw = window.localStorage.getItem(PALETTE_KEY);
  return PALETTES.includes(raw as PaletteName) ? (raw as PaletteName) : "jardin";
}

export function readStoredLocale(): LocaleName {
  if (typeof window === "undefined") return "es";
  return window.localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "es";
}

export function readAppearance(): Appearance {
  if (typeof window === "undefined") return { mode: "day", day: "jardin", night: "noche" };
  try {
    const raw = JSON.parse(window.localStorage.getItem(LOOK_KEY) || "null") as Partial<Appearance> | null;
    if (raw && (raw.mode === "day" || raw.mode === "night" || raw.mode === "auto") && isDayPalette(raw.day) && isNightPalette(newNight(raw.night))) {
      return { mode: raw.mode, day: raw.day, night: newNight(raw.night) as NightPalette };
    }
  } catch {
    /* fall through to the older keys */
  }
  const modeRaw = window.localStorage.getItem(MODE_KEY);
  const mode: AppearanceMode = modeRaw === "night" || modeRaw === "auto" || modeRaw === "day" ? modeRaw : readStoredTheme() === "amoled" ? "night" : "day";
  const dayRaw = window.localStorage.getItem(DAY_KEY);
  const nightRaw = newNight(window.localStorage.getItem(NIGHT_KEY));
  const day = isDayPalette(dayRaw) ? dayRaw : isDayPalette(readStoredPalette()) ? readStoredPalette() : "jardin";
  const night = isNightPalette(nightRaw) ? nightRaw : readStoredTheme() === "amoled" ? "amoled" : "noche";
  return { mode, day, night };
}

function publishLook() {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  try {
    const channel = new BroadcastChannel("ols-look");
    channel.postMessage(1);
    channel.close();
  } catch {
    /* ignore */
  }
}

function writeAppearance(next: Appearance) {
  try {
    const prev = window.localStorage.getItem(LOOK_KEY);
    const raw = JSON.stringify(next);
    window.localStorage.setItem(LOOK_KEY, raw);
    window.localStorage.setItem(MODE_KEY, next.mode);
    window.localStorage.setItem(DAY_KEY, next.day);
    window.localStorage.setItem(NIGHT_KEY, next.night);
    if (prev !== raw) publishLook();
  } catch {
    /* ignore */
  }
}

export function applyAppearance(patch?: Partial<Appearance>) {
  if (typeof document === "undefined") return readAppearance();
  const next = { ...readAppearance(), ...patch };
  writeAppearance(next);
  const useNight = next.mode === "night" || (next.mode === "auto" && isNightHour());
  const palette = useNight ? next.night : next.day;
  const root = document.documentElement;
  const amoled = useNight && palette === "amoled";
  root.classList.toggle("theme-amoled", amoled);
  root.classList.toggle("theme-dark", useNight && !amoled);
  if ((useNight && palette === "amoled") || (!useNight && palette === "jardin")) delete root.dataset.palette;
  else root.dataset.palette = palette;
  root.style.colorScheme = useNight ? "dark" : "light";
  paintStatusBar(statusBarColor(useNight, palette));
  try {
    window.localStorage.setItem(THEME_KEY, useNight && palette === "amoled" ? "amoled" : "light");
    if ((PALETTES as readonly string[]).includes(next.day)) {
      window.localStorage.setItem(PALETTE_KEY, next.day);
    }
  } catch {
    /* ignore */
  }
  return next;
}

/** Runs in head before paint so a pull-to-refresh does not flash Jardín or AMOLED. */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{
var look=null;try{look=JSON.parse(localStorage.getItem("ols-look-v2")||"null")}catch(e){}
var mode=look&&look.mode,day=look&&look.day,night=look&&look.night;
if(mode!=="day"&&mode!=="night"&&mode!=="auto"){
mode=localStorage.getItem("ols-appearance-mode");
if(mode!=="day"&&mode!=="night"&&mode!=="auto")mode=localStorage.getItem("ols-theme")==="amoled"?"night":"day";
}
var days=["jardin","costa","barro","pino","cielo","lima","arena","flor"];
var nights=["noche","medianoche","ciruela","grafito","luciernaga","amoled"];var old={bosque:"noche",mar:"medianoche",tinta:"medianoche",brasa:"grafito",luna:"grafito"};if(old[night])night=old[night];
if(days.indexOf(day)<0){day=localStorage.getItem("ols-palette-day")||localStorage.getItem("ols-palette")||"jardin";if(days.indexOf(day)<0)day="jardin";}
if(nights.indexOf(night)<0){night=localStorage.getItem("ols-palette-night");if(old[night])night=old[night];if(nights.indexOf(night)<0)night=localStorage.getItem("ols-theme")==="amoled"?"amoled":"noche";}
var mins=new Date().getHours()*60+new Date().getMinutes();
var useNight=mode==="night"||(mode==="auto"&&(mins<390||mins>=1110));
var p=useNight?night:day,r=document.documentElement;
r.classList.toggle("theme-amoled",!!(useNight&&p==="amoled"));
r.classList.toggle("theme-dark",!!(useNight&&p!=="amoled"));
if((useNight&&p==="amoled")||(!useNight&&p==="jardin"))r.removeAttribute("data-palette");else r.dataset.palette=p;
r.style.colorScheme=useNight?"dark":"light";
var bars={jardin:"#efe8d6",costa:"#e5f1f0",barro:"#f6eee6",pino:"#e7eee9",cielo:"#e8eef6",lima:"#eef6d4",arena:"#f6efe2",flor:"#f8eef1",noche:"#0c110e",medianoche:"#0a0f1a",ciruela:"#120d16",grafito:"#111112",luciernaga:"#0d0f0a",amoled:"#000000"};
var bar=bars[p]||(useNight?"#0c110e":"#efe8d6");
var meta=document.querySelector('meta[name="theme-color"]');
if(!meta){meta=document.createElement("meta");meta.setAttribute("name","theme-color");document.head.appendChild(meta);}
meta.setAttribute("content",bar);
}catch(e){}})();`;

export function isNightHour(date = new Date()) {
  const mins = date.getHours() * 60 + date.getMinutes();
  return mins < 6 * 60 + 30 || mins >= 18 * 60 + 30;
}

export function ensureAppearance(serverTheme?: ThemeName, serverPalette?: string) {
  if (typeof window === "undefined") return;
  let hasChoice = false;
  try {
    hasChoice = Boolean(
      window.localStorage.getItem(LOOK_KEY) ||
        window.localStorage.getItem(MODE_KEY) ||
        window.localStorage.getItem(DAY_KEY) ||
        window.localStorage.getItem(NIGHT_KEY),
    );
  } catch {
    hasChoice = false;
  }
  if (!hasChoice) {
    applyAppearance({
      mode: serverTheme === "amoled" ? "night" : "day",
      day: isDayPalette(serverPalette) ? serverPalette : "jardin",
      night: serverTheme === "amoled" ? "amoled" : "noche",
    });
    return;
  }
  applyAppearance();
}

export function applyTheme(theme: ThemeName, palette?: PaletteName) {
  const current = readAppearance();
  if (theme === "amoled") {
    applyAppearance({ mode: current.mode === "auto" ? "auto" : "night" });
    return;
  }
  applyAppearance({
    mode: current.mode === "auto" ? "auto" : "day",
    ...(palette && isDayPalette(palette) ? { day: palette } : {}),
  });
}

export function applyLocale(locale: LocaleName) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  try {
    const prev = window.localStorage.getItem(LOCALE_KEY);
    window.localStorage.setItem(LOCALE_KEY, locale);
    if (prev !== locale) publishLook();
  } catch {
    /* ignore */
  }
}

export function readStoredBusinessName(fallback = "Oscar's Lawn Service"): string {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(NAME_KEY)?.trim() || fallback;
}

export function storeBusinessName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}
