import { useEffect, useRef, useState } from "react";
import type { CircleMarker, Map as LeafletMap, TileLayer } from "leaflet";
import { LocateFixed } from "lucide-react";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

const STREETS = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function nightNow() {
  const root = document.documentElement;
  return root.classList.contains("theme-dark") || root.classList.contains("theme-amoled");
}

type LeafletNS = typeof import("leaflet");

function asLeaflet(mod: LeafletNS): LeafletNS {
  const wrapped = mod as LeafletNS & { default?: LeafletNS };
  return typeof wrapped.map === "function" ? wrapped : (wrapped.default ?? wrapped);
}

export function RadarMap({ lat, lon, host, path }: { lat: number; lon: number; host: string; path: string }) {
  const tx = useTx();
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const baseRef = useRef<TileLayer | null>(null);
  const radarRef = useRef<Map<string, TileLayer>>(new Map());
  const dotRef = useRef<CircleMarker | null>(null);
  const moved = useRef(false);
  const [night, setNight] = useState(false);
  const [ready, setReady] = useState(false);
  const [base, setBase] = useState<"streets" | "satellite">("streets");

  useEffect(() => {
    const sync = () => setNight(nightNow());
    sync();
    window.addEventListener("ols-look", sync);
    return () => window.removeEventListener("ols-look", sync);
  }, []);

  useEffect(() => {
    let dead = false;
    let created: LeafletMap | null = null;
    void import("leaflet").then((mod) => {
      if (dead || !el.current) return;
      const L = asLeaflet(mod);
      created = L.map(el.current, {
        zoomControl: false,
        minZoom: 4,
        maxZoom: 14,
      }).setView([lat, lon], 8);
      L.control.zoom({ position: "bottomright" }).addTo(created);
      created.on("dragstart", () => {
        moved.current = true;
      });
      const radarPane = created.createPane("radar");
      radarPane.style.zIndex = "450";
      mapRef.current = created;
      setReady(true);
      requestAnimationFrame(() => created?.invalidateSize());
    });
    return () => {
      dead = true;
      created?.remove();
      mapRef.current = null;
      baseRef.current = null;
      radarRef.current = new Map();
      dotRef.current = null;
      setReady(false);
    };
    // The map is created once. Later effects move it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let dead = false;
    void import("leaflet").then((mod) => {
      if (dead) return;
      const L = asLeaflet(mod);
      if (baseRef.current) map.removeLayer(baseRef.current);
      const satellite = base === "satellite";
      const layer = L.tileLayer(satellite ? SATELLITE : STREETS, {
        attribution: satellite ? "© Esri" : "© OpenStreetMap",
        maxZoom: 19,
      });
      layer.addTo(map);
      baseRef.current = layer;
    });
    return () => {
      dead = true;
    };
  }, [base, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !host || !path) return;
    let dead = false;
    void import("leaflet").then((mod) => {
      if (dead) return;
      const L = asLeaflet(mod);
      // Keep each radar frame's layer so the loop doesn't flash blank while tiles load.
      const layers = radarRef.current;
      let layer = layers.get(path);
      if (!layer) {
        layer = L.tileLayer(`${host}${path}/256/{z}/{x}/{y}/2/1_1.png`, {
          pane: "radar",
          opacity: 0,
          maxNativeZoom: 7,
          maxZoom: 14,
        });
        layer.addTo(map);
        layers.set(path, layer);
      }
      for (const [key, item] of layers) item.setOpacity(key === path ? 0.78 : 0);
      // Forget frames that are no longer in the last hour.
      if (layers.size > 8) {
        const first = layers.keys().next().value as string;
        if (first !== path) { map.removeLayer(layers.get(first)!); layers.delete(first); }
      }
    });
    return () => {
      dead = true;
    };
  }, [host, path, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let dead = false;
    void import("leaflet").then((mod) => {
      if (dead) return;
      const L = asLeaflet(mod);
      const soil = getComputedStyle(document.documentElement).getPropertyValue("--color-soil").trim() || "#4f3722";
      if (!dotRef.current) {
        dotRef.current = L.circleMarker([lat, lon], {
          radius: 7,
          weight: 2,
          color: "#fff",
          fillColor: soil,
          fillOpacity: 1,
        }).addTo(map);
      } else {
        dotRef.current.setLatLng([lat, lon]);
        dotRef.current.setStyle({ fillColor: soil });
      }
      if (!moved.current) map.setView([lat, lon], map.getZoom());
    });
    return () => {
      dead = true;
    };
  }, [lat, lon, ready, night]);

  return (
    <div className={cn("radar-map relative h-72 overflow-hidden rounded-lg", night && base === "streets" && "is-night")}>
      <div ref={el} className="h-full w-full" />
      <div className="absolute top-2 left-2 z-[500] flex overflow-hidden rounded-full bg-surface shadow-card">
        <button
          type="button"
          onClick={() => setBase("streets")}
          className={cn("h-8 px-3 text-xs font-semibold", base === "streets" ? "bz-pick" : "text-muted")}
        >
          {tx("Calles", "Streets")}
        </button>
        <button
          type="button"
          onClick={() => setBase("satellite")}
          className={cn("h-8 px-3 text-xs font-semibold", base === "satellite" ? "bz-pick" : "text-muted")}
        >
          {tx("Satélite", "Satellite")}
        </button>
      </div>
      <button
        type="button"
        aria-label={tx("Centrar en mi zona", "Center on my area")}
        onClick={() => {
          moved.current = false;
          mapRef.current?.setView([lat, lon], 10);
        }}
        className="absolute top-2 right-2 z-[500] grid size-9 place-items-center rounded-full bg-surface text-fg shadow-card"
      >
        <LocateFixed className="size-4" />
      </button>
      <style>{`
        .radar-map.is-night .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.92); }
        .radar-map .leaflet-container { background: var(--color-bg); font-family: inherit; }
        .radar-map .leaflet-control-zoom a {
          background: var(--color-surface);
          color: var(--color-fg);
          border-bottom-color: var(--color-border);
          width: 32px;
          height: 32px;
          line-height: 30px;
        }
        .radar-map .leaflet-control-zoom { border: 1px solid var(--color-border); border-radius: 10px; overflow: hidden; }
        .radar-map .leaflet-control-attribution {
          background: color-mix(in srgb, var(--color-surface) 84%, transparent);
          color: var(--color-muted);
          font-size: 10px;
        }
      `}</style>
    </div>
  );
}
