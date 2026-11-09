// Where the weather is read for. Works without the browser's location permission:
// the user can type a ZIP code or city, and the choice is kept on this device.
import { fetchWithTimeout } from "@/lib/fetch-timeout";

export type WeatherPlace = { lat: number; lon: number; name: string; source: "gps" | "typed" | "default" };

export const MIAMI_PLACE: WeatherPlace = { lat: 25.7617, lon: -80.1918, name: "Miami", source: "default" };
const KEY = "brizna.weather-place";
export const PLACE_EVENT = "brizna-weather-place";

export function readWeatherPlace(): WeatherPlace {
  try {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem("ols-weather-place");
    if (raw) {
      const p = JSON.parse(raw) as Partial<WeatherPlace> & { here?: boolean };
      if (typeof p.lat === "number" && typeof p.lon === "number") {
        return { lat: p.lat, lon: p.lon, name: p.name || "", source: p.source ?? (p.here ? "gps" : "typed") };
      }
    }
  } catch {
    /* ignore */
  }
  return MIAMI_PLACE;
}

export function saveWeatherPlace(p: WeatherPlace) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    sessionStorage.removeItem("ols-weather");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(PLACE_EVENT));
}

export async function findPlace(text: string, es: boolean): Promise<WeatherPlace | null> {
  const q = text.trim();
  if (!q) return null;
  const zip = q.match(/^\d{5}$/);
  if (zip) {
    try {
      const r = await fetchWithTimeout(`https://api.zippopotam.us/us/${q}`);
      if (r.ok) {
        const d = (await r.json()) as { places?: { "place name": string; latitude: string; longitude: string; "state abbreviation": string }[] };
        const p = d.places?.[0];
        if (p) return { lat: Number(p.latitude), lon: Number(p.longitude), name: `${q} · ${p["place name"]}, ${p["state abbreviation"]}`, source: "typed" };
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const r = await fetchWithTimeout(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=${es ? "es" : "en"}`,
    );
    const d = (await r.json()) as { results?: { name: string; latitude: number; longitude: number; admin1?: string; country_code?: string }[] };
    const p = d.results?.[0];
    if (p) return { lat: p.latitude, lon: p.longitude, name: [p.name, p.admin1].filter(Boolean).join(", "), source: "typed" };
  } catch {
    /* ignore */
  }
  return null;
}

/** Asks for GPS only when the user taps. Resolves an error code: 1 blocked, 2 unavailable (phone location off), 3 timeout. */
export function askGps(): Promise<WeatherPlace | { error: 1 | 2 | 3 | 0 }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ error: 0 });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: "", source: "gps" }),
      (err) => resolve({ error: (err.code as 1 | 2 | 3) ?? 0 }),
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 15000 },
    );
  });
}

export async function gpsAlreadyAllowed(): Promise<boolean> {
  try {
    const s = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    return s?.state === "granted";
  } catch {
    return false;
  }
}
