import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CloudRain, Droplets, MapPin, SunMedium, Wind } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { invalidateLawn } from "@/components/job-card";
import { MessageComposer } from "@/components/message-composer";
import { RadarMap } from "@/components/radar-map";
import { ReasonChips } from "@/components/reason-chips";
import { Button } from "@/components/ui/button";
import { formatLongDay } from "@/lib/format";
import { reasonLabel, useI18n, useTx } from "@/lib/i18n";
import { shiftForRain } from "@/lib/server/lawn";
import { STOP_REASONS } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clima")({ component: ClimaPage });

const MIAMI = { lat: 25.7617, lon: -80.1918 };
const PLACE_KEY = "ols-weather-place";

type Hour = { time: string; temp: number; pop: number; rain: number; code: number; wind: number };
type Day = { date: string; max: number; min: number; pop: number; rain: number; code: number; uv: number };
type Pack = {
  temp: number;
  code: number;
  humidity: number;
  wind: number;
  rain: number;
  hours: Hour[];
  days: Day[];
};
type Frame = { time: number; path: string };
type Place = { lat: number; lon: number; here: boolean };

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

function readPlace(): Place | null {
  try {
    const raw = sessionStorage.getItem(PLACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Place;
    if (typeof parsed.lat === "number" && typeof parsed.lon === "number") return parsed;
  } catch {
    /* ignore */
  }
  return null;
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
  const [place, setPlace] = useState<Place>(MIAMI.lat ? { ...MIAMI, here: false } : { ...MIAMI, here: false });
  const [pack, setPack] = useState<Pack | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [host, setHost] = useState("");
  const [frame, setFrame] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readPlace();
    if (saved) setPlace(saved);
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude, here: true };
        setPlace(next);
        try {
          sessionStorage.setItem(PLACE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      },
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 12000 },
    );
  }, []);

  useEffect(() => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max&timezone=auto&forecast_days=2`;
    void fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const c = data.current;
        const h = data.hourly;
        const d = data.daily;
        if (!c || !h?.time || !d?.time) return;
        const hours: Hour[] = h.time.slice(0, 24).map((time: string, i: number) => ({
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
        setPack({
          temp: c.temperature_2m,
          code: c.weather_code ?? 0,
          humidity: c.relative_humidity_2m ?? 0,
          wind: c.wind_speed_10m ?? 0,
          rain: c.precipitation ?? 0,
          hours,
          days,
        });
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [place.lat, place.lon]);

  useEffect(() => {
    void fetch("https://api.rainviewer.com/public/weather-maps.json")
      .then((r) => r.json())
      .then((data: { host?: string; radar?: { past?: Frame[] } }) => {
        const past = data.radar?.past ?? [];
        setHost(data.host ?? "");
        setFrames(past.slice(-6));
        setFrame(Math.max(0, past.slice(-6).length - 1));
      })
      .catch(() => undefined);
  }, []);

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

  const now = new Date();
  const soon = pack?.hours.filter((hour) => new Date(hour.time).getTime() >= now.getTime() - 30 * 60 * 1000).slice(0, 8) ?? [];
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

  const shot = frames[frame];
  const radarWhen = shot
    ? new Date(shot.time * 1000).toLocaleTimeString(en ? "en" : "es", { hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <AppShell title={tx("Clima", "Weather")}>
      <p className="mb-3 flex items-center gap-1.5 text-sm text-muted">
        <MapPin className="size-3.5" />
        {place.here ? tx("Tu zona", "Your area") : tx("Miami, hasta que permitas la ubicación", "Miami, until you allow location")}
      </p>

      <section className={cn("rounded-xl px-4 py-4", tone === "alert" ? "bg-late-bg" : tone === "wait" ? "bg-sun" : "bg-done-bg")}>
        <p className="text-xs font-semibold tracking-wide uppercase text-muted">{tx("Para el trabajo", "For the work")}</p>
        <p className="mt-1 font-display text-3xl font-semibold">{pack ? `${Math.round(pack.temp)}°` : "–"}</p>
        <p className="text-sm">{pack ? sky(pack.code, en) : tx("Leyendo el cielo…", "Reading the sky…")}</p>
        <p className="mt-2 text-sm leading-snug">{ready ? verdict : ""}</p>
      </section>

      <Button variant="outline" className="mt-3 w-full" onClick={() => setAskRain(true)}>
        <CloudRain />
        {t("stop.button")}
      </Button>
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

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Fact icon={CloudRain} label={tx("Lluvia", "Rain")} value={soon[0] ? `${soon[0].pop}%` : "–"} />
        <Fact icon={Wind} label={tx("Viento", "Wind")} value={pack ? `${Math.round(pack.wind)} km` : "–"} />
        <Fact icon={Droplets} label={tx("Humedad", "Humidity")} value={pack ? `${Math.round(pack.humidity)}%` : "–"} />
      </div>

      <section className="mt-4 rounded-xl bg-surface p-3 shadow-card">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">{tx("Radar", "Radar")}</h2>
          <p className="text-xs text-muted">
            {radarWhen
              ? tx(`Nubes a las ${radarWhen}`, `Clouds at ${radarWhen}`)
              : tx("Cargando el radar…", "Loading the radar…")}
          </p>
        </div>
        <RadarMap lat={place.lat} lon={place.lon} host={host} path={shot?.path ?? ""} />
        {frames.length > 1 ? (
          <div className="mt-2 flex gap-1">
            {frames.map((item, index) => (
              <button
                key={item.time}
                type="button"
                aria-label={tx("Ver este momento del radar", "See this radar moment")}
                onClick={() => setFrame(index)}
                className={cn("h-1.5 flex-1 rounded-full", index === frame ? "bg-soil" : "bg-sun")}
              />
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-xs leading-snug text-muted">
          {tx(
            "Pellizca para acercar y arrastra para moverte. El punto es tu zona. Si el color avanza hacia él, la lluvia viene.",
            "Pinch to zoom and drag to move. The dot is your area. If the color moves toward it, rain is coming.",
          )}
        </p>
      </section>

      <section className="mt-4">
        <h2 className="mb-2 font-display text-lg font-semibold">{tx("Próximas horas", "Next hours")}</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {soon.map((hour) => (
            <div key={hour.time} className="w-16 shrink-0 rounded-lg bg-surface px-2 py-2 text-center shadow-card">
              <p className="text-[11px] text-muted">{hour.time.slice(11, 16)}</p>
              <p className="mt-1 text-sm font-semibold">{Math.round(hour.temp)}°</p>
              <p className={cn("mt-1 text-[11px] font-semibold", hour.pop >= 50 ? "text-late" : "text-muted")}>{hour.pop}%</p>
            </div>
          ))}
        </div>
      </section>

      {pack?.days[1] ? (
        <section className="mt-4 rounded-xl bg-surface px-4 py-3 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">{tx("Mañana", "Tomorrow")}</p>
              <p className="mt-0.5 font-medium">{sky(pack.days[1].code, en)}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-lg font-semibold">{Math.round(pack.days[1].max)}° / {Math.round(pack.days[1].min)}°</p>
              <p className="text-xs text-muted">{tx(`Lluvia ${pack.days[1].pop}%`, `Rain ${pack.days[1].pop}%`)}</p>
            </div>
          </div>
        </section>
      ) : null}

      <ul className="mt-4 grid gap-2 text-sm leading-snug text-muted">
        <li className="flex gap-2">
          <SunMedium className="mt-0.5 size-4 shrink-0 text-soil" />
          {(pack?.days[0]?.uv ?? 0) >= 7
            ? tx("Sol fuerte. Lleva gorra y agua.", "Strong sun. Take a hat and water.")
            : tx("El sol está llevadero. Aun así, para a beber agua.", "The sun is manageable. Still stop for water.")}
        </li>
        <li className="flex gap-2">
          <Droplets className="mt-0.5 size-4 shrink-0 text-soil" />
          {(pack?.humidity ?? 0) >= 75
            ? tx("Humedad alta: el césped crece rápido. Si está seco, es buen día para dejarlo parejo.", "High humidity: the grass grows fast. If it is dry, it is a good day to leave it even.")
            : tx("Humedad normal. El corte queda más limpio si el pasto no está mojado.", "Normal humidity. The cut looks cleaner if the grass is not wet.")}
        </li>
      </ul>
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

function Fact({ icon: Icon, label, value }: { icon: typeof Wind; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-2 py-3 text-center shadow-card">
      <Icon className="mx-auto size-4 text-soil" />
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
