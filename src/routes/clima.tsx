import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, CloudLightning, CloudRain, Crosshair, Droplets, GlassWater, MapPin, Pause, Play, Search, Sprout, SunMedium, Timer, Tractor, Wind } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { invalidateLawn } from "@/components/job-card";
import { MessageComposer } from "@/components/message-composer";
import { applySky } from "@/lib/weather-sky";
import { RadarMap } from "@/components/radar-map";
import { ReasonChips } from "@/components/reason-chips";
import { Button } from "@/components/ui/button";
import { formatLongDay } from "@/lib/format";
import { reasonLabel, useI18n, useTx } from "@/lib/i18n";
import { getDashboard, shiftForRain } from "@/lib/server/lawn";
import { STOP_REASONS } from "@/lib/types";
import { askGps, findPlace, gpsAlreadyAllowed, readWeatherPlace, saveWeatherPlace, type WeatherPlace } from "@/lib/weather-place";
import { cn } from "@/lib/utils";
import { inAndroidApp } from "@/spa/native";
import { CountUp } from "@/components/cifras-visuals";
import { DayStrip, DropGauge, GrassEdge, HumidRing, WindSock, WxArt, WxIcon, heroKind, type Slot } from "@/components/clima-visuals";

export const Route = createFileRoute("/clima")({ component: ClimaPage });


type Hour = { time: string; temp: number; pop: number; rain: number; code: number; wind: number };
type Day = { date: string; max: number; min: number; pop: number; rain: number; code: number; uv: number };
type Pack = {
  temp: number;
  code: number;
  humidity: number;
  wind: number;
  rain: number;
  /** Feels-like temperature (newer readings only). */
  feels?: number;
  /** 1 = daylight, 0 = night (newer readings only). */
  isDay?: number;
  hours: Hour[];
  days: Day[];
};
type Frame = { time: number; path: string };

function sky(code: number, en: boolean) {
  const es =
    code >= 95 ? "Tormenta" :
    code >= 80 ? "Chubascos" :
    code >= 71 ? "Nieve" :
    code >= 61 ? "Lluvia" :
    code >= 51 ? "Llovizna" :
    code >= 45 ? "Niebla" :
    code >= 2 ? "Nublado" :
    code === 1 ? "Parcial" :
    "Despejado";
  const eng =
    code >= 95 ? "Storm" :
    code >= 80 ? "Showers" :
    code >= 71 ? "Snow" :
    code >= 61 ? "Rain" :
    code >= 51 ? "Drizzle" :
    code >= 45 ? "Fog" :
    code >= 2 ? "Cloudy" :
    code === 1 ? "Partly cloudy" :
    "Clear";
  return en ? eng : es;
}

function wet(code: number) {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}

function ClimaPage() {
  const tx = useTx();
  const { locale, t } = useI18n();
  const qc = useQueryClient();
  const en = locale === "en";
  const [askRain, setAskRain] = useState(false);
  const [stopReason, setStopReason] = useState("Lluvia");
  const [rainReady, setRainReady] = useState<{
    date: string;
    text: string;
    people: { id: number; name: string; phone: string | null }[];
  } | null>(null);
  const [place, setPlace] = useState<WeatherPlace>(() => readWeatherPlace());
  const [editPlace, setEditPlace] = useState(false);
  const [placeText, setPlaceText] = useState("");
  const [placeBusy, setPlaceBusy] = useState(false);
  const [gpsNote, setGpsNote] = useState("");

  function usePlace(next: WeatherPlace) {
    setPlace(next);
    saveWeatherPlace(next);
    setEditPlace(false);
    setGpsNote("");
  }

  async function tapGps() {
    setPlaceBusy(true);
    setGpsNote("");
    const got = await askGps();
    setPlaceBusy(false);
    if ("error" in got) {
      setEditPlace(true);
      setGpsNote(
        got.error === 1
          ? inAndroidApp()
            ? tx(
                "Brizna no tiene permiso de ubicación. Escribe tu código postal abajo y listo. (Para darlo: Ajustes del teléfono › Apps › Brizna › Permisos › Ubicación › Permitir.)",
                "Brizna has no location permission. Type your ZIP code below and you're set. (To allow it: phone Settings › Apps › Brizna › Permissions › Location › Allow.)",
              )
            : tx(
                "El navegador tiene la ubicación bloqueada para Brizna. Escribe tu código postal abajo y listo. (Para desbloquearla: toca el candado junto a la dirección › Permisos › Ubicación › Permitir.)",
                "The browser has location blocked for Brizna. Type your ZIP code below and you're set. (To unblock it: tap the lock beside the address › Permissions › Location › Allow.)",
              )
          : got.error === 2
            ? tx("El teléfono no da la ubicación ahora (¿GPS apagado?). Escribe tu código postal.", "The phone can't give a location now (GPS off?). Type your ZIP code.")
            : tx("La ubicación tardó demasiado. Escribe tu código postal.", "Location took too long. Type your ZIP code."),
      );
      return;
    }
    usePlace({ ...got, name: tx("Tu ubicación", "Your location") });
  }

  async function searchPlace() {
    setPlaceBusy(true);
    const found = await findPlace(placeText, !en);
    setPlaceBusy(false);
    if (found) usePlace(found);
    else setGpsNote(tx("No encontré ese lugar. Prueba un código postal de 5 números o una ciudad.", "Couldn't find that place. Try a 5-digit ZIP code or a city."));
  }
  const [pack, setPack] = useState<Pack | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [host, setHost] = useState("");
  const [frame, setFrame] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    // Refresh GPS silently only when location is already allowed; never pop the prompt on open.
    if (place.source !== "gps") return;
    void gpsAlreadyAllowed().then((ok) => {
      if (!ok) return;
      void askGps().then((got) => {
        if (!("error" in got)) {
          const next = { ...got, name: place.name };
          setPlace(next);
          saveWeatherPlace(next);
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,apparent_temperature,is_day&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max&timezone=auto&forecast_days=2`;
    const cacheKey = `brizna.clima.${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
    try {
      const old = JSON.parse(localStorage.getItem(cacheKey) || "null") as { at: number; pack: Pack } | null;
      if (old?.pack && Date.now() - old.at < 6 * 3600_000) { setPack(old.pack); setReady(true); }
    } catch { /* ignore */ }
    setFailed(false);
    void fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const c = data.current;
        const h = data.hourly;
        const d = data.daily;
        if (!c || !h?.time || !d?.time) { setFailed(true); setReady(true); return; }
        const hours: Hour[] = h.time.slice(0, 48).map((time: string, i: number) => ({
          time,
          temp: h.temperature_2m[i],
          pop: h.precipitation_probability[i] ?? 0,
          rain: h.precipitation[i] ?? 0,
          code: h.weather_code[i] ?? 0,
          wind: h.wind_speed_10m[i] ?? 0,
        }));
        const days: Day[] = d.time.map((date: string, i: number) => ({
          date,
          max: d.temperature_2m_max[i],
          min: d.temperature_2m_min[i],
          pop: d.precipitation_probability_max[i] ?? 0,
          rain: d.precipitation_sum[i] ?? 0,
          code: d.weather_code[i] ?? 0,
          uv: d.uv_index_max[i] ?? 0,
        }));
        const next: Pack = {
          temp: c.temperature_2m,
          code: c.weather_code ?? 0,
          humidity: c.relative_humidity_2m ?? 0,
          wind: c.wind_speed_10m ?? 0,
          rain: c.precipitation ?? 0,
          feels: typeof c.apparent_temperature === "number" ? c.apparent_temperature : undefined,
          isDay: typeof c.is_day === "number" ? c.is_day : undefined,
          hours,
          days,
        };
        setPack(next);
        applySky(next.code);
        try { localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), pack: next })); } catch { /* ignore */ }
        setReady(true);
      })
      .catch(() => { setFailed(true); setReady(true); });
  }, [place.lat, place.lon]);

  useEffect(() => {
    const load = () =>
      void fetch("https://api.rainviewer.com/public/weather-maps.json")
        .then((r) => r.json())
        .then((data: { host?: string; radar?: { past?: Frame[] } }) => {
          const past = (data.radar?.past ?? []).slice(-6);
          setHost(data.host ?? "");
          setFrames(past);
          setFrame(Math.max(0, past.length - 1));
        })
        .catch(() => undefined);
    load();
    const t = window.setInterval(load, 10 * 60_000);
    return () => window.clearInterval(t);
  }, []);

  // Play the last hour of radar as a loop, resting a moment on the newest frame.
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const last = frames.length - 1;
    const t = window.setTimeout(() => setFrame((f) => (f >= last ? 0 : f + 1)), frame === last ? 1800 : 650);
    return () => window.clearTimeout(t);
  }, [playing, frames.length, frame]);

  const rainMut = useMutation({
    mutationFn: () => shiftForRain({ data: { reason: stopReason || "Lluvia" } }),
    onSuccess: async (res) => {
      setAskRain(false);
      const when = formatLongDay(res.date);
      const shown = reasonLabel(locale, res.reason);
      const come = t("stop.come").replace("{date}", when);
      const text = res.reason === "Lluvia" ? `${t("stop.msgRain")} ${come}` : `${t("stop.msgOther")} ${shown}. ${come}`;
      setRainReady({ date: res.date, text, people: res.people });
      toast.success(
        res.moved
          ? t("stop.moved").replace("{n}", String(res.moved)).replace("{date}", when)
          : t("stop.none"),
      );
      await invalidateLawn(qc);
    },
    onError: () => toast.error(t("stop.fail")),
  });

  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard(), staleTime: 8_000 });
  const pendingToday = dash.data?.stats.pendingToday;
  const doneToday = dash.data?.stats.doneToday ?? 0;

  const now = new Date();
  const soon = pack?.hours.filter((hour) => new Date(hour.time).getTime() >= now.getTime() - 30 * 60 * 1000).slice(0, 8) ?? [];
  const next12 = pack?.hours.filter((hour) => new Date(hour.time).getTime() >= now.getTime() - 30 * 60 * 1000).slice(0, 12) ?? [];
  const nextRain = soon.find((hour) => hour.pop >= 50 || hour.rain > 0.2 || wet(hour.code));
  const storm = (pack?.code ?? 0) >= 95 || soon.some((hour) => hour.code >= 95);
  const wetNow = pack ? pack.rain > 0.1 || wet(pack.code) : false;
  const windy = (pack?.wind ?? 0) >= 30;
  const dry = soon.slice(0, 4).every((hour) => hour.pop < 30 && hour.rain < 0.2 && !wet(hour.code));
  const tone = storm || wetNow ? "alert" : nextRain || windy ? "wait" : "go";
  const verdict = storm
    ? tx("Alerta. Hay tormenta. No salgas al patio.", "Alert. A storm is here. Stay off the yard.")
    : wetNow
      ? tx("Mejor esperar. El pasto mojado se apelmaza y la máquina patina.", "Better to wait. Wet grass clumps and the mower slips.")
      : nextRain
        ? tx("Lluvia cerca. Corta lo urgente y deja el soplado para después.", "Rain is close. Cut what is urgent and leave the blowing for later.")
        : windy
          ? tx("Viento alto. El recorte vuela y el soplado no se queda.", "High wind. Clippings fly and blowing will not stay put.")
          : dry
            ? tx("Buen momento para cortar. Las próximas horas se ven secas.", "A good time to cut. The next hours look dry.")
            : tx("Se puede trabajar. Revisa el radar antes de salir lejos.", "You can work. Check the radar before you go far.");

  const night = pack?.isDay != null ? pack.isDay === 0 : now.getHours() < 6 || now.getHours() >= 19;
  const today = pack?.days[0];
  const hot = (today?.max ?? 0) >= 32 || (pack?.feels ?? 0) >= 34 || (today?.uv ?? 0) >= 8;
  const rainNear = Boolean(nextRain) || wetNow || storm;

  const slots: Slot[] = next12.map((hour, i) => {
    const at = i === 0 ? tx("Ahora", "Now") : clock(new Date(hour.time));
    const kind = isWet(hour) ? "wet" : hour.pop >= 30 ? "maybe" : hour.temp >= 32 ? "hot" : "dry";
    const word = kind === "wet" ? tx("lluvia", "rain") : kind === "maybe" ? tx("quizá lluvia", "maybe rain") : kind === "hot" ? tx("calor", "hot") : tx("seco", "dry");
    return { kind, label: at, title: `${at}: ${word}` };
  });
  const marks = next12.length
    ? [0, 4, 8, next12.length]
        .filter((i, k, all) => i <= next12.length && all.indexOf(i) === k)
        .map((i) => ({ at: i, label: i === 0 ? tx("Ahora", "Now") : clock(addHours(new Date(next12[0].time), i)) }))
    : [];

  const plan = useMemo(
    () => buildPlan({ next12, storm, wetNow, windy, hot, wind: pack?.wind ?? 0, max: today?.max, uv: today?.uv, pendingToday, doneToday, tx }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pack, storm, wetNow, windy, hot, pendingToday, doneToday, locale],
  );
  const hoursLine = next12.length ? hourSummary(next12, tx) : "";

  const shot = frames[frame];
  const radarWhen = shot ? clock(new Date(shot.time * 1000), true) : "";
  const hk = pack ? heroKind(pack.code) : "cloud";
  const chip = tone === "alert" ? tx("Alerta", "Alert") : tone === "wait" ? tx("Esperar", "Wait") : tx("Cortar ✓", "Mow ✓");
  const tomorrow = pack?.days[1];

  return (
    <AppShell title={tx("Clima", "Weather")}>
      <div className="clx">
        <div className="clx-rise mb-3" style={rise(0)}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex min-w-0 basis-full items-center gap-1.5 text-sm text-muted">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{place.source === "default" ? tx("Miami (cámbialo aquí)", "Miami (change it here)") : place.name || tx("Tu zona", "Your area")}</span>
            </p>
            <button type="button" disabled={placeBusy} onClick={() => void tapGps()} className="clx-pill">
              <Crosshair className="size-3.5" /> {tx("Mi ubicación", "My location")}
            </button>
            <button type="button" onClick={() => { setEditPlace((v) => !v); setGpsNote(""); }} className={cn("clx-pill", editPlace && "is-on")}>
              <Search className="size-3.5" /> {tx("Código postal", "ZIP code")}
            </button>
          </div>
          {gpsNote ? <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-snug text-fg">{gpsNote}</p> : null}
          {editPlace ? (
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void searchPlace(); }}>
              <input
                value={placeText}
                onChange={(e) => setPlaceText(e.target.value)}
                inputMode="search"
                autoFocus
                placeholder={tx("Ej. 33157 o Kendall", "e.g. 33157 or Kendall")}
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg"
              />
              <Button type="submit" disabled={placeBusy || !placeText.trim()}>{tx("Usar", "Use")}</Button>
            </form>
          ) : null}
        </div>

        <section data-spot="clima" className={cn("clx-hero clx-rise", `is-${hk}`, night && hk === "sun" && "is-night", !pack && "is-empty")} style={rise(1)} aria-live="polite">
          <div className="clx-hero-top">
            <p className="clx-kicker">{tx("Para el trabajo", "For the work")}</p>
            {ready && pack ? <span className={cn("clx-verdict", `is-${tone}`)}>{chip}</span> : null}
          </div>
          <div className="clx-hero-main">
            <div className="min-w-0">
              <p className="clx-temp">
                {pack ? <CountUp value={Math.round(pack.temp)} format={(n) => `${n}°`} /> : "–"}
              </p>
              <p className="clx-cond">
                {pack ? sky(pack.code, en) : failed ? tx("Sin datos ahora", "No data right now") : tx("Leyendo el cielo…", "Reading the sky…")}
              </p>
              {pack ? (
                <p className="clx-sub">
                  {pack.feels != null ? <span>{tx("Sensación", "Feels")} {Math.round(pack.feels)}°</span> : null}
                  {today ? <span className="whitespace-nowrap">↑{Math.round(today.max)}° ↓{Math.round(today.min)}°</span> : null}
                </p>
              ) : null}
            </div>
            <WxArt code={pack?.code ?? 2} night={night} className="clx-hero-art" />
          </div>
          <p className="clx-say">
            {ready && pack
              ? verdict
              : failed
                ? tx("No pude leer el clima ahora. Vuelve a intentarlo en un rato.", "Couldn't read the weather right now. Try again in a bit.")
                : ""}
          </p>

          {pack && next12.length ? (
            <div className="clx-plan">
              <p className="clx-kicker">{tx("Plan de hoy", "Today's plan")}</p>
              <DayStrip slots={slots} marks={marks} />
              <ul className="clx-plan-list">
                {plan.map((tip, i) => (
                  <li key={i} style={{ "--i": i } as CSSProperties}>
                    <span className="clx-plan-ic">{tip.icon}</span>
                    <span className="min-w-0">
                      {tip.text}
                      {tip.stop ? (
                        <>
                          {" "}
                          <button type="button" className="clx-plan-act" onClick={() => setAskRain(true)}>
                            {t("stop.button")} ›
                          </button>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <GrassEdge mow={tone === "go" && Boolean(pack)} />
        </section>

        <button type="button" className={cn("clx-stop clx-rise", rainNear && "is-near")} style={rise(2)} onClick={() => setAskRain(true)}>
          <CloudRain className="size-5" />
          <span>{t("stop.button")}</span>
          {rainNear ? <small>{storm ? tx("tormenta", "storm") : wetNow ? tx("llueve ahora", "raining now") : tx("lluvia cerca", "rain near")}</small> : null}
        </button>
        {rainReady && rainReady.people.length > 0 ? (
          <section className="mt-3 rounded-xl border-l-4 border-hold bg-hold-bg p-3">
            <p className="font-semibold text-hold">{tx("Mensajes listos", "Messages ready")}</p>
            <p className="mt-1 text-sm text-muted">
              {tx(
                `Los patios de hoy pasaron al ${formatLongDay(rainReady.date)}. Tú envías cada mensaje.`,
                `Today's yards moved to ${formatLongDay(rainReady.date)}. You send each message.`,
              )}
            </p>
            <textarea
              value={rainReady.text}
              onChange={(e) => setRainReady({ ...rainReady, text: e.target.value })}
              rows={3}
              className="mt-2 w-full rounded-md bg-surface px-3 py-2 text-sm"
            />
            <ul className="mt-2 grid gap-2">
              {rainReady.people.map((person) =>
                person.phone ? (
                  <li key={person.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold">{person.name}</span>
                    <span className="flex shrink-0 gap-1">
                      <MessageComposer phone={person.phone} name={person.name} compact initialText={rainReady.text} />
                      <MessageComposer phone={person.phone} name={person.name} compact channel="whatsapp" initialText={rainReady.text} />
                    </span>
                  </li>
                ) : (
                  <li key={person.id} className="text-sm text-muted">
                    {tx(`${person.name} no tiene teléfono.`, `${person.name} has no phone.`)}
                  </li>
                ),
              )}
            </ul>
          </section>
        ) : null}

        <div className="clx-facts clx-rise" style={rise(3)}>
          <Fact
            gauge={<DropGauge pct={soon[0]?.pop ?? 0} />}
            label={tx("Lluvia", "Rain")}
            value={soon[0] ? <CountUp value={soon[0].pop} format={(n) => `${n}%`} /> : "–"}
          />
          <Fact
            gauge={<WindSock kmh={pack?.wind ?? 0} />}
            label={tx("Viento", "Wind")}
            value={pack ? <><CountUp value={Math.round(pack.wind)} format={(n) => String(n)} /><small> km/h</small></> : "–"}
          />
          <Fact
            gauge={<HumidRing pct={pack?.humidity ?? 0} />}
            label={tx("Humedad", "Humidity")}
            value={pack ? <CountUp value={Math.round(pack.humidity)} format={(n) => `${n}%`} /> : "–"}
          />
        </div>

        {next12.length > 0 ? (
          <section className="clx-card clx-rise" style={rise(4)}>
            <div className="clx-card-head">
              <h2 className="clx-h2">{tx("Próximas horas", "Next hours")}</h2>
            </div>
            <p className="clx-line">{hoursLine}</p>
            <HourStrip hours={next12} night={night} nowLabel={tx("Ahora", "Now")} />
          </section>
        ) : null}

        <section className="clx-card clx-rise" style={rise(5)}>
          <div className="clx-card-head">
            <h2 className="clx-h2">{tx("Radar", "Radar")}</h2>
            <p className="clx-live">
              {radarWhen ? (
                <>
                  <i aria-hidden /> {tx("En vivo", "Live")} · {radarWhen}
                </>
              ) : (
                tx("Cargando el radar…", "Loading the radar…")
              )}
            </p>
          </div>
          <div className="clx-radar">
            <RadarMap lat={place.lat} lon={place.lon} host={host} path={shot?.path ?? ""} />
          </div>
          {frames.length > 1 ? (
            <div className="clx-frames">
              <button
                type="button"
                onClick={() => setPlaying((v) => !v)}
                aria-label={playing ? tx("Pausar radar", "Pause radar") : tx("Reproducir radar", "Play radar")}
                className="clx-play"
              >
                {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
              {frames.map((item, index) => (
                <button
                  key={item.time}
                  type="button"
                  aria-label={tx("Ver este momento del radar", "See this radar moment")}
                  onClick={() => { setPlaying(false); setFrame(index); }}
                  className={cn("clx-frame", index === frame && "is-on", index < frame && "is-past")}
                />
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
            <span className="h-2 flex-1 rounded-full" style={{ background: "linear-gradient(90deg,#88ddee,#0077aa,#ffee00,#ff9900,#ff4400,#c10000,#ff99ff)" }} />
            <span className="shrink-0">{tx("ligera → fuerte", "light → heavy")}</span>
          </div>
          <p className="mt-2 text-xs leading-snug text-muted">
            {tx(
              "Pellizca para acercar y arrastra para moverte. El punto es tu zona. Si el color avanza hacia él, la lluvia viene.",
              "Pinch to zoom and drag to move. The dot is your area. If the color moves toward it, rain is coming.",
            )}
          </p>
        </section>

        {tomorrow ? (
          <section className="clx-card clx-tomorrow clx-rise" style={rise(6)}>
            <WxIcon code={tomorrow.code} className="clx-tm-icon" />
            <div className="min-w-0 flex-1">
              <p className="clx-kicker-m">{tx("Mañana", "Tomorrow")}</p>
              <p className="clx-tm-cond">{sky(tomorrow.code, en)}</p>
              <p className="clx-tm-rec">{tomorrowLine(tomorrow, tone, tx)}</p>
            </div>
            <div className="clx-tm-side">
              <p className="clx-tm-temp">{Math.round(tomorrow.max)}°<small>/{Math.round(tomorrow.min)}°</small></p>
              <p className="clx-tm-pop">
                <span className="clx-tm-bar"><span style={{ width: `${Math.max(4, tomorrow.pop)}%` }} /></span>
                {tomorrow.pop}%
              </p>
            </div>
          </section>
        ) : null}

        {pack ? (
          <section className="clx-card clx-tips clx-rise" style={rise(7)}>
            <div className="clx-tip">
              <span className="clx-tip-ic is-sun"><SunMedium className="size-4" /></span>
              <p>
                <b>{(today?.uv ?? 0) >= 7 ? tx("Sol fuerte", "Strong sun") : tx("Sol llevadero", "Easy sun")}{today ? ` · UV ${Math.round(today.uv)}` : ""}</b>
                {(today?.uv ?? 0) >= 7
                  ? tx("Lleva gorra y agua.", "Take a hat and water.")
                  : tx("Aun así, para a beber agua.", "Still stop for water.")}
              </p>
            </div>
            <div className="clx-tip">
              <span className="clx-tip-ic is-grow"><Sprout className="size-4" /></span>
              <p>
                <b>{(pack.humidity ?? 0) >= 75 ? tx("Humedad alta", "High humidity") : tx("Humedad normal", "Normal humidity")} · {Math.round(pack.humidity)}%</b>
                {(pack.humidity ?? 0) >= 75
                  ? tx("El césped crece rápido. Si está seco, es buen día para dejarlo parejo.", "The grass grows fast. If it is dry, it is a good day to leave it even.")
                  : tx("El corte queda más limpio si el pasto no está mojado.", "The cut looks cleaner if the grass is not wet.")}
              </p>
            </div>
          </section>
        ) : null}
      </div>
      <ConfirmDialog
        open={askRain}
        title={t("stop.title")}
        description={
          <div className="grid gap-2">
            <p>{t("stop.help")}</p>
            <ReasonChips value={stopReason} onChange={setStopReason} reasons={STOP_REASONS} />
          </div>
        }
        confirmLabel={stopReason === "Lluvia" ? t("stop.rain") : t("stop.other")}
        pending={rainMut.isPending}
        onConfirm={() => rainMut.mutate()}
        onCancel={() => setAskRain(false)}
      />
    </AppShell>
  );
}

type Tx = (es: string, en: string) => string;
type Tip = { icon: ReactNode; text: string; stop?: boolean };

/** Rough time for one yard, used only to say how many fit before the rain. */
const YARD_MIN = 45;

function rise(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}

function isWet(hour: Hour) {
  return hour.pop >= 50 || hour.rain > 0.2 || wet(hour.code);
}

function addHours(d: Date, n: number) {
  return new Date(d.getTime() + n * 3600_000);
}

/** "3 pm", or "3:20 pm" with minutes. Same short form in both languages. */
function clock(d: Date, minutes = false) {
  const h = d.getHours();
  const m = d.getMinutes();
  const hh = h % 12 || 12;
  return `${hh}${minutes && m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

function span(a: Date, b: Date) {
  const sameHalf = (a.getHours() < 12) === (b.getHours() < 12);
  return sameHalf ? `${a.getHours() % 12 || 12}–${clock(b)}` : `${clock(a)}–${clock(b)}`;
}

/** One plain line for the hour strip: when it is dry and when rain is likely. */
function hourSummary(hours: Hour[], tx: Tx) {
  const t0 = (i: number) => (i < hours.length ? new Date(hours[i].time) : addHours(new Date(hours[hours.length - 1].time), 1));
  const w = hours.findIndex(isWet);
  if (w === -1) {
    const maybe = hours.findIndex((h) => h.pop >= 30);
    return maybe === -1
      ? tx(`Seco las próximas ${hours.length} horas.`, `Dry for the next ${hours.length} hours.`)
      : tx(`Seco, con alguna posibilidad de lluvia hacia las ${clock(t0(maybe))}.`, `Dry, with some chance of rain around ${clock(t0(maybe))}.`);
  }
  let end = hours.findIndex((h, i) => i > w && !isWet(h));
  if (end === -1) end = hours.length;
  if (w === 0) {
    return end >= hours.length
      ? tx("Lluvia probable las próximas horas.", "Rain likely for the next hours.")
      : tx(`Lluvia probable hasta las ${clock(t0(end))}; luego más seco.`, `Rain likely until ${clock(t0(end))}; drier after.`);
  }
  const range = span(t0(w), t0(end));
  return end >= hours.length
    ? tx(`Seco hasta las ${clock(t0(w))}; después, lluvia probable.`, `Dry until ${clock(t0(w))}; rain likely after.`)
    : tx(`Seco hasta las ${clock(t0(w))}; lluvia probable ${range}.`, `Dry until ${clock(t0(w))}; rain likely ${range}.`);
}

/** Two or three short, data-based moves for today. */
function buildPlan(o: {
  next12: Hour[];
  storm: boolean;
  wetNow: boolean;
  windy: boolean;
  hot: boolean;
  wind: number;
  max?: number;
  uv?: number;
  pendingToday?: number;
  doneToday: number;
  tx: Tx;
}): Tip[] {
  const { next12: hours, tx } = o;
  const tips: Tip[] = [];
  if (!hours.length) return tips;
  const at = (i: number) => (i < hours.length ? new Date(hours[i].time) : addHours(new Date(hours[hours.length - 1].time), 1));
  const rawW = hours.findIndex(isWet);
  const n = o.pendingToday;
  // Daylight ends around 7 pm: rain after dark doesn't change today's work.
  const dusk = hours.findIndex((h) => { const hr = new Date(h.time).getHours(); return hr >= 19 || hr < 6; });
  const w = dusk > 0 && rawW >= dusk ? -1 : rawW;
  const restOfDay = dusk > 0;

  // 1 · The dry window.
  if (o.storm) {
    tips.push({ icon: <CloudLightning />, text: tx("Tormenta: no salgas al patio. Mueve los patios de hoy.", "Storm: stay off the yard. Move today's yards."), stop: true });
  } else if (w === -1) {
    tips.push({
      icon: <Clock />,
      text: restOfDay
        ? tx("Seco el resto del día: corta a tu ritmo.", "Dry for the rest of the day: cut at your pace.")
        : tx(`Seco las próximas ${hours.length} horas: corta a tu ritmo.`, `Dry for the next ${hours.length} hours: cut at your pace.`),
    });
  } else if (w === 0) {
    const clear = hours.findIndex((h, i) => i > 0 && !isWet(h));
    tips.push(
      clear === -1
        ? { icon: <CloudRain />, text: tx("Lluvia casi todo el día: mejor mover los patios.", "Rain most of the day: better to move the yards."), stop: true }
        : { icon: <Clock />, text: tx(`Espera: escampa hacia las ${clock(at(clear))}. Dale 1 hora al pasto para secar.`, `Wait: it clears around ${clock(at(clear))}. Give the grass 1 hour to dry.`) },
    );
  } else {
    tips.push({
      icon: <Clock />,
      text: w === 1 && hours.length > 1
        ? tx(`Corta ya: llueve hacia las ${clock(at(w))}.`, `Cut now: rain around ${clock(at(w))}.`)
        : tx(`Corta de ${clock(at(0))} a ${clock(at(w))}; luego llueve.`, `Cut from ${clock(at(0))} to ${clock(at(w))}; rain after.`),
    });
  }

  // 2 · How many of today's yards fit.
  if (!o.storm && n != null) {
    if (n === 0) {
      if (o.doneToday > 0) tips.push({ icon: <Tractor />, text: tx("Ya terminaste los patios de hoy.", "You finished today's yards.") });
    } else if (w === -1) {
      tips.push({ icon: <Tractor />, text: tx(`Te ${n === 1 ? "queda 1 patio" : `quedan ${n} patios`} hoy y el cielo da para todos.`, `${n === 1 ? "1 yard" : `${n} yards`} left today, and the sky allows all of them.`) });
    } else if (w === 0) {
      tips.push({ icon: <Tractor />, text: tx(`Te ${n === 1 ? "queda 1 patio" : `quedan ${n} patios`} hoy. Si no escampa a tiempo, muévelos.`, `${n === 1 ? "1 yard" : `${n} yards`} left today. If it doesn't clear in time, move them.`), stop: true });
    } else {
      const mins = (at(w).getTime() - Date.now()) / 60_000;
      const fit = Math.max(0, Math.floor(mins / YARD_MIN));
      tips.push({
        icon: <Tractor />,
        text: fit >= n
          ? tx(`Te ${n === 1 ? "queda 1 patio" : `quedan ${n} patios`}: ${n === 1 ? "cabe" : "caben todos"} antes de la lluvia.`, `${n === 1 ? "1 yard" : `${n} yards`} left: ${n === 1 ? "it fits" : "all fit"} before the rain.`)
          : fit > 0
            ? tx(`Te quedan ${n} patios; caben unos ${fit} antes de la lluvia (~${YARD_MIN} min c/u). Empieza por los urgentes.`, `${n} yards left; about ${fit} fit before the rain (~${YARD_MIN} min each). Start with the urgent ones.`)
            : tx(`Te ${n === 1 ? "queda 1 patio" : `quedan ${n} patios`} y la lluvia llega pronto: solo lo urgente.`, `${n === 1 ? "1 yard" : `${n} yards`} left and rain is close: only what's urgent.`),
      });
    }
  }

  // 3 · The condition that changes how to work.
  if (o.storm) tips.push({ icon: <Timer />, text: tx("Si oyes truenos, guarda la máquina y espera 30 min después del último.", "If you hear thunder, put the mower away and wait 30 min after the last one.") });
  if (tips.length < 3 && !o.storm) {
    if (o.wetNow) tips.push({ icon: <Droplets />, text: tx("Pasto mojado: sube la cuchilla un punto y vacía la bolsa seguido.", "Wet grass: raise the deck a notch and empty the bag often.") });
    else if (o.windy) tips.push({ icon: <Wind />, text: tx(`Viento de ${Math.round(o.wind)} km/h: deja el soplado para el final.`, `${Math.round(o.wind)} km/h wind: leave the blowing for last.`) });
    else if (o.hot) tips.push({ icon: <GlassWater />, text: tx(`Calor de ${Math.round(o.max ?? 0)}°${o.uv ? ` y UV ${Math.round(o.uv)}` : ""}: para a tomar agua cada hora.`, `${Math.round(o.max ?? 0)}° heat${o.uv ? ` and UV ${Math.round(o.uv)}` : ""}: stop for water every hour.`) });
  }
  return tips.slice(0, 3);
}

function tomorrowLine(day: Day, tone: string, tx: Tx) {
  const dryDay = day.pop < 40 && !wet(day.code);
  if (dryDay && tone !== "go") return tx("Buen día para recuperar los patios de hoy.", "A good day to catch up on today's yards.");
  if (dryDay) return tx("Otro buen día para cortar.", "Another good day to cut.");
  if (day.pop >= 60) return tx("Lluvia probable: deja margen en la agenda.", "Rain likely: leave room in the schedule.");
  return tx("Posibles chubascos: empieza temprano.", "Possible showers: start early.");
}

const CELL = 56;

/** The next hours: icon, a smooth temperature line, and rain chance as small bars. */
function HourStrip({ hours, night, nowLabel }: { hours: Hour[]; night: boolean; nowLabel: string }) {
  const w = hours.length * CELL;
  const temps = hours.map((h) => h.temp);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const y = (t: number) => (hi === lo ? 26 : 34 - ((t - lo) / (hi - lo)) * 18);
  const pts = hours.map((h, i) => [CELL / 2 + i * CELL, y(h.temp)] as const);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`;
  }
  const area = `${d} L${pts[pts.length - 1][0]} 44 L${pts[0][0]} 44 Z`;
  return (
    <div className="clx-hours">
      <div className="clx-hours-in" style={{ width: w }}>
        <div className="clx-hrow">
          {hours.map((h, i) => {
            const t = new Date(h.time);
            const dark = night ? true : t.getHours() < 6 || t.getHours() >= 19;
            return (
              <div key={h.time} className={cn("clx-hcell", i === 0 && "is-now", h.pop >= 50 && "is-wet")} style={{ width: CELL }}>
                <span className="clx-htime">{i === 0 ? nowLabel : clock(t)}</span>
                <WxIcon code={h.code} night={i === 0 ? night : dark} className="clx-hicon" />
              </div>
            );
          })}
        </div>
        <svg width={w} height={46} viewBox={`0 0 ${w} 46`} className="clx-tline" aria-hidden>
          <path d={area} className="clx-tline-fill" />
          <path d={d} className="clx-tline-path" />
          {pts.map(([px, py], i) => (
            <g key={i}>
              <circle cx={px} cy={py} r={i === 0 ? 3.6 : 2.6} className={cn("clx-tline-dot", i === 0 && "is-now")} />
              <text x={px} y={py - 7} textAnchor="middle" className="clx-tline-txt">{Math.round(hours[i].temp)}°</text>
            </g>
          ))}
        </svg>
        <div className="clx-hrow">
          {hours.map((h, i) => (
            <div key={h.time} className={cn("clx-hcell", h.pop >= 50 && "is-wet")} style={{ width: CELL }}>
              <span className="clx-hbar"><span style={{ transform: `scaleY(${Math.max(0.04, h.pop / 100)})`, "--i": i } as CSSProperties} /></span>
              <span className="clx-hpop">{h.pop}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Fact({ gauge, label, value }: { gauge: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="clx-fact">
      {gauge}
      <p className="clx-fact-v">{value}</p>
      <p className="clx-fact-l">{label}</p>
    </div>
  );
}
