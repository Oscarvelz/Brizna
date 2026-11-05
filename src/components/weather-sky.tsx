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
    <>
    <div className="wx" aria-hidden>
      <div className="wx-cloud wx-c1" />
      <div className="wx-cloud wx-c2" />
      <div className="wx-cloud wx-c3" />
      <div className="wx-rain" />
      <div className="wx-fog" />
      <div className="wx-snow" />
      <div className="wx-flash" />
    </div>
      <Fireflies />
    </>
  );
}

/** 1.4.83 (Oscar): a few tiny fireflies drift behind the UI at night, a soft touch of magic.
 *  Fixed seeds (no Math.random) so the layout never jumps between renders. CSS hides them by day,
 *  shows fewer on phones, and freezes them for reduced motion. */
const FLIES = [
  [8, 22, 0, 17], [23, 64, 3.1, 21], [37, 12, 6.4, 19], [52, 78, 1.7, 23], [66, 35, 4.9, 18], [81, 58, 2.6, 22],
  [92, 15, 7.3, 20], [14, 88, 5.2, 24], [45, 46, 8.1, 19], [73, 90, 0.9, 21], [30, 34, 9.4, 25], [88, 72, 3.8, 18],
  [5, 50, 6.9, 22], [60, 8, 2.2, 20], [96, 40, 10.2, 23], [19, 5, 4.4, 21], [42, 95, 7.8, 19], [77, 24, 1.3, 24],
];
function Fireflies() {
  return (
    <div className="wx-flies" aria-hidden>
      {FLIES.map(([x, y, d, t], i) => (
        <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `-${d}s, -${(d * 0.7).toFixed(1)}s`, animationDuration: `${t}s, ${(3.2 + (i % 4) * 0.6).toFixed(1)}s` }} />
      ))}
    </div>
  );
}
