import { useEffect } from "react";
import { readWeatherPlace, PLACE_EVENT } from "@/lib/weather-place";
import { applySky, restoreSky } from "@/lib/weather-sky";

/** Background weather layers (clouds, rain, lightning, fog, snow). Pure CSS; html[data-sky] picks what shows. */
export function WeatherSky() {
  useEffect(() => {
    restoreSky();
    let dead = false;
    const load = () => {
      const p = readWeatherPlace();
      void fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=weather_code&timezone=auto`)
        .then((r) => r.json())
        .then((d: { current?: { weather_code?: number } }) => {
          if (!dead && typeof d.current?.weather_code === "number") applySky(d.current.weather_code);
        })
        .catch(() => undefined);
    };
    load();
    const t = window.setInterval(load, 20 * 60_000);
    const vis = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener(PLACE_EVENT, load);
    document.addEventListener("visibilitychange", vis);
    return () => { dead = true; window.clearInterval(t); window.removeEventListener(PLACE_EVENT, load); document.removeEventListener("visibilitychange", vis); };
  }, []);
  return (
    <div className="wx" aria-hidden>
      <div className="wx-cloud wx-c1" />
      <div className="wx-cloud wx-c2" />
      <div className="wx-cloud wx-c3" />
      <div className="wx-rain" />
      <div className="wx-fog" />
      <div className="wx-snow" />
      <div className="wx-flash" />
    </div>
  );
}
