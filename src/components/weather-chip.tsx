import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTx } from "@/lib/i18n";
import { PLACE_EVENT, readWeatherPlace } from "@/lib/weather-place";
import { applySky } from "@/lib/weather-sky";
import { afterSplash } from "@/spa/splash-ready";

const CACHE = "ols-weather";

function skyLabel(code: number): string {
  if (code >= 95) return "tormenta";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "lluvia";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "nieve";
  if (code === 45 || code === 48) return "niebla";
  if (code >= 1 && code <= 3) return "nubes";
  if (code === 0) return "despejado";
  return "";
}

const SKY_EN: Record<string, string> = {
  tormenta: "storm",
  lluvia: "rain",
  nieve: "snow",
  niebla: "fog",
  nubes: "clouds",
  despejado: "clear",
};

/** 1.4.99: `className` lets a page hide it on phones where its title needs the room (Estudio). */
export function WeatherChip({ className }: { className?: string } = {}) {
  const tx = useTx();
  const [label, setLabel] = useState<string | null>(null);

  function remember(next: string) {
    setLabel(next);
    try {
      sessionStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), label: next }));
    } catch {
      /* ignore */
    }
  }

  function load(lat: number, lon: number) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
    void fetch(url)
      .then((r) => r.json())
      .then((data: { current?: { temperature_2m?: number; weather_code?: number } }) => {
        const c = data.current?.temperature_2m;
        if (typeof c !== "number") return;
        // 1.5.03: the header changes only after the launch splash has faded (not on its frames).
        afterSplash(() => show(c, data), 0);
      })
      .catch(() => undefined);
  }

  function show(c: number, data: { current?: { temperature_2m?: number; weather_code?: number } }) {
    const f = Math.round((c * 9) / 5 + 32);
    const code = Number(data.current?.weather_code ?? -1);
    if (code >= 0) applySky(code);
    const sky = skyLabel(code);
    remember(`${Math.round(c)}°C · ${f}°F${sky ? ` · ${sky}` : ""}`);
  }

  useEffect(() => {
    const again = () => {
      const p = readWeatherPlace();
      load(p.lat, p.lon);
    };
    window.addEventListener(PLACE_EVENT, again);
    return () => window.removeEventListener(PLACE_EVENT, again);
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CACHE);
      if (raw) {
        const parsed = JSON.parse(raw) as { at?: number; label?: string };
        if (parsed.label && parsed.at && Date.now() - parsed.at < 20 * 60 * 1000) {
          setLabel(parsed.label);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    const p = readWeatherPlace();
    load(p.lat, p.lon);
  }, []);

  return (
    <Link
      to="/clima"
      className={cn("max-w-[13rem] shrink-0 truncate text-right text-sm font-semibold text-soil", className)}
      aria-label={tx("Ver el clima del día", "See the day's weather")}
    >
      {label
        ? Object.entries(SKY_EN).reduce((text, [es, en]) => text.replaceAll(es, tx(es, en)), label)
        : tx("Clima", "Weather")}
    </Link>
  );
}
