import { Contact, MapPin, Navigation, PencilLine, Users } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Hint } from "@/components/hint";
import { OffDayDialog, shiftToMonday, useRareDay } from "@/components/off-day-ask";
import { RichNotes } from "@/components/rich-notes";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { pickPhoneContacts } from "@/lib/contacts";
import { PhotoPicker } from "@/components/photo-picker";
import { PHOTOS_ENABLED } from "@/lib/photos-flag";
import { previewUpcomingCuts, todayISO, weekdayFromISO } from "@/lib/dates";
import { formatDay, mapsHref, money, weekdayLabel, weekdayOptions } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { getSettings, listClients, updateSettings } from "@/lib/server/lawn";
import { useUndo } from "@/lib/undo";
import { DEFAULT_ARRIVAL_PRESETS, DEFAULT_CUE_PRESETS, DEFAULT_DEBT_PRESETS, DEFAULT_PRICE_PRESETS, DEFAULT_TASK_PRESETS, DEFAULT_VISIT_PRESETS, type ClientKind, type ClientRow, type CutsPerMonth } from "@/lib/types";
import { cn } from "@/lib/utils";

export type FrequencyMode = "1" | "2" | "3" | "4" | "5" | "custom";

export type ClientFormValue = {
  name: string;
  phone: string;
  address: string;
  notes: string;
  kind: ClientKind;
  pricePerCut: string;
  cutsPerMonth: CutsPerMonth;
  weekday: number;
  weekday2: number;
  frequencyDays: string;
  frequencyMode: FrequencyMode;
  arrivalTime: string;
  startDate: string;
  paySameDay: boolean;
  payDueDay: string;
  oneTimeDate: string;
  oneTimeTitle: string;
  cue: string;
  richNotes: string;
  standingExtras: string;
  seasonOn: boolean;
  seasonStart: string;
  seasonEnd: string;
  seasonEvery: string;
  pendingPhotos: string[];
  openingBalance: string;
};

export function emptyClientForm(): ClientFormValue {
  const start = todayISO();
  return {
    name: "",
    phone: "",
    address: "",
    notes: "",
    kind: "regular",
    pricePerCut: "30",
    cutsPerMonth: 2,
    weekday: weekdayFromISO(start),
    weekday2: 4,
    frequencyDays: "10",
    frequencyMode: "2",
    arrivalTime: "",
    startDate: start,
    paySameDay: false,
    payDueDay: "",
    oneTimeDate: start,
    oneTimeTitle: "",
    cue: "",
    richNotes: "",
    standingExtras: "",
    seasonOn: false,
    seasonStart: "11-01",
    seasonEnd: "02-28",
    seasonEvery: "21",
    pendingPhotos: [],
    openingBalance: "",
  };
}

function modeFromClient(c: ClientRow): FrequencyMode {
  if (c.frequencyDays && c.frequencyDays > 0) return "custom";
  if (c.cutsPerMonth === 1) return "1";
  if (c.cutsPerMonth === 3) return "3";
  if (c.cutsPerMonth === 4) return "4";
  if (c.cutsPerMonth === 5) return "5";
  return "2";
}

export function formFromClient(c: ClientRow): ClientFormValue {
  return {
    name: c.name,
    phone: c.phone ?? "",
    address: c.address ?? "",
    notes: c.notes ?? "",
    kind: c.kind,
    pricePerCut: String(c.pricePerCut),
    cutsPerMonth: c.cutsPerMonth,
    weekday: c.weekday,
    weekday2: c.weekday2 ?? 4,
    frequencyDays: String(c.frequencyDays ?? 10),
    frequencyMode: modeFromClient(c),
    arrivalTime: c.arrivalTime ?? "",
    startDate: c.startDate ?? todayISO(),
    paySameDay: c.paySameDay,
    payDueDay: c.payDueDay ? String(c.payDueDay) : "",
    oneTimeDate: todayISO(),
    oneTimeTitle: "",
    cue: c.cue ?? "",
    richNotes: c.richNotes ?? "",
    standingExtras: c.standingExtras.join(", "),
    seasonOn: Boolean(c.seasonStart && c.seasonEnd && c.seasonEvery),
    seasonStart: c.seasonStart ?? "11-01",
    seasonEnd: c.seasonEnd ?? "02-28",
    seasonEvery: String(c.seasonEvery ?? 21),
    pendingPhotos: [],
    openingBalance: "",
  };
}

export function payloadFromForm(value: ClientFormValue) {
  const custom = value.frequencyMode === "custom";
  const cutsPerMonth = custom ? 2 : (Number(value.frequencyMode) as CutsPerMonth);
  const startDate = value.kind === "regular" ? value.startDate : value.oneTimeDate;
  return {
    name: value.name,
    phone: value.phone,
    address: value.address,
    notes: value.notes,
    kind: value.kind,
    pricePerCut: Number(value.pricePerCut) || 0,
    cutsPerMonth,
    weekday: startDate ? weekdayFromISO(startDate) : value.weekday,
    weekday2: value.frequencyMode === "5" ? value.weekday2 : null,
    frequencyDays: custom ? Number(value.frequencyDays) || 7 : null,
    arrivalTime: value.arrivalTime,
    startDate,
    paySameDay: value.paySameDay,
    payDueDay: value.paySameDay
      ? null
      : (() => {
          const n = Number(value.payDueDay);
          return n >= 1 && n <= 31 ? n : null;
        })(),
    oneTimeDate: value.oneTimeDate,
    oneTimeTitle: value.oneTimeTitle,
    cue: value.cue,
    richNotes: value.richNotes,
    standingExtras: value.standingExtras,
    seasonStart: value.seasonOn ? value.seasonStart : "",
    seasonEnd: value.seasonOn ? value.seasonEnd : "",
    seasonEvery: value.seasonOn ? Number(value.seasonEvery) || 21 : null,
    openingBalance: Number(value.openingBalance) || 0,
  };
}

function cadenceCopy(value: ClientFormValue, en = false): string {
  if (value.frequencyMode === "custom") {
    const n = Number(value.frequencyDays) || 7;
    if (en) return n === 1 ? "every day" : `every ${n} days`;
    return n === 1 ? "todos los días" : `cada ${n} días`;
  }
  if (en) {
    if (value.frequencyMode === "1") return "the same day each month";
    if (value.frequencyMode === "3") return "every 10 days (about 3 times a month)";
    if (value.frequencyMode === "4") return "every week";
    if (value.frequencyMode === "5") return "twice a week";
    return "every 2 weeks";
  }
  if (value.frequencyMode === "1") return "el mismo día de cada mes";
  if (value.frequencyMode === "3") return "cada 10 días (unas 3 veces al mes)";
  if (value.frequencyMode === "4") return "cada semana";
  if (value.frequencyMode === "5") return `dos veces por semana`;
  return "cada 2 semanas";
}

export function ClientForm({
  initial,
  submitLabel,
  onSubmit,
  pending,
  onPickMany,
  onAddSeveral,
  swipeKind,
}: {
  initial?: ClientFormValue;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (value: ClientFormValue) => void;
  onPickMany?: (contacts: { name: string; phone: string; address: string }[]) => void;
  onAddSeveral?: () => void;
  swipeKind?: boolean;
}) {
  const tx = useTx();
  const push = useUndo((s) => s.push);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [value, setValue] = useState<ClientFormValue>(initial ?? emptyClientForm());
  const [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hits, setHits] = useState<{ label: string }[]>([]);
  const notesRef = useRef((initial ?? emptyClientForm()).richNotes);
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const rare = useRareDay();
  const [rareAsk, setRareAsk] = useState<null | { iso: string; kind: "sunday" | "free" }>(null);
  const qc = useQueryClient();
  const set = <K extends keyof ClientFormValue>(key: K, v: ClientFormValue[K]) =>
    setValue((prev) => ({ ...prev, [key]: v }));

  function changeKind(next: ClientKind) {
    const before = value.kind;
    if (before === next) return;
    setValue((prev) => ({ ...prev, kind: next }));
    push({
      label: tx("Tipo de cliente", "Client type"),
      undo: async () => setValue((cur) => ({ ...cur, kind: before })),
      redo: async () => setValue((cur) => ({ ...cur, kind: next })),
    });
  }

  function applyPicked(picked: { name: string; phone: string; address: string }[]) {
    if (picked.length === 0) return;
    if (picked.length > 1 && onPickMany) {
      onPickMany(picked);
      return;
    }
    const c = picked[0]!;
    setValue((prev) => ({
      ...prev,
      name: c.name || prev.name,
      phone: c.phone || prev.phone,
      address: c.address || prev.address,
    }));
    toast.success(
      c.address
        ? tx("Contacto y dirección copiados", "Contact and address copied")
        : tx("Contacto copiado. Completa la dirección si hace falta.", "Contact copied. Fill in the address if needed."),
    );
  }

  async function importContact(multiple: boolean) {
    setPicking(true);
    try {
      const picked = await pickPhoneContacts(multiple);
      applyPicked(picked);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "contacts-unavailable") {
        toast.error(
          tx(
            "Abre la app en Chrome del teléfono para leer Contactos.",
            "Open the app in phone Chrome to read Contacts.",
          ),
        );
      } else {
        toast(tx("No se eligió ningún contacto", "No contact was chosen"));
      }
    } finally {
      setPicking(false);
    }
  }

  const upcoming =
    value.kind === "regular" && value.startDate
      ? previewUpcomingCuts({
          weekday: weekdayFromISO(value.startDate),
          weekday2: value.frequencyMode === "5" ? value.weekday2 : null,
          cutsPerMonth:
            value.frequencyMode === "custom" ? 2 : (Number(value.frequencyMode) as CutsPerMonth),
          frequencyDays: value.frequencyMode === "custom" ? Number(value.frequencyDays) || 7 : null,
          startDate: value.startDate,
          today: todayISO(),
          count: 4,
        })
      : [];

  return (
    <form
      className="grid gap-4"
      onTouchStart={(e) => {
        if (!swipeKind) return;
        const target = e.target as HTMLElement;
        if (target.closest("input, textarea, select, button, [contenteditable='true']")) return;
        const touch = e.changedTouches[0];
        if (!touch) return;
        swipe.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(e) => {
        if (!swipe.current) return;
        const start = swipe.current;
        swipe.current = null;
        const touch = e.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        changeKind(value.kind === "regular" ? "one_time" : "regular");
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        const target = e.target;
        if (target instanceof HTMLElement && target.dataset.noteEditor === "1") e.stopPropagation();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.dataset.noteEditor === "1") return;
        if (!value.name.trim()) return;
        const iso = value.kind === "regular" ? value.startDate : value.oneTimeDate;
        const kind = rare.kindOf(iso);
        if (kind) {
          setRareAsk({ iso, kind });
          return;
        }
        onSubmit({ ...value, richNotes: notesRef.current });
      }}
    >
      <KindToggle value={value.kind} onChange={changeKind} />

      <div className={cn("grid gap-2", onAddSeveral && "grid-cols-2")}>
        <Button
          type="button"
          variant="outline"
          onClick={() => void importContact(Boolean(onPickMany))}
          disabled={picking}
        >
          <Contact />
          {tx("Del teléfono", "From the phone")}
        </Button>
        {onAddSeveral ? (
          <Button type="button" variant="outline" onClick={onAddSeveral}>
            <Users />
            {tx("Añadir varios", "Add several")}
          </Button>
        ) : null}
      </div>

      <Field label={tx("Nombre", "Name")}>
        <Input
          required
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder={tx("Fiódor Dostoyevski", "Fyodor Dostoevsky")}
          autoComplete="name"
        />
      </Field>

      {!initial ? (
        <Field
          label={tx("Deuda anterior", "Earlier debt")}
          topic="deuda-anterior"
        >
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">$</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="pl-7"
              value={value.openingBalance}
              onChange={(e) => set("openingBalance", e.target.value)}
              placeholder="0"
            />
          </div>
          <DebtPresets
            value={value.openingBalance}
            presets={settingsQ.data?.debtPresets ?? DEFAULT_DEBT_PRESETS}
            onPick={(amount) => set("openingBalance", String(amount))}
          />
        </Field>
      ) : null}

      <Field
        label={tx("Pista o referencia (opcional)", "Cue or reference (optional)")}
        topic="pista"
      >
        <CueField value={value.cue} onChange={(next) => set("cue", next)} presets={settingsQ.data?.cuePresets ?? DEFAULT_CUE_PRESETS} />
      </Field>

      {PHOTOS_ENABLED ? <Field
        label={tx("Fotos de la ficha", "File photos")}
        hint={tx(
          "Opcional. Productos o indicaciones visuales. No es la foto del patio al marcar Hecho.",
          "Optional. Products or visual instructions. It is not the yard photo when you mark Done.",
        )}
      >
        <PhotoPicker
          onPick={(data) =>
            setValue((prev) => ({ ...prev, pendingPhotos: [...prev.pendingPhotos, data].slice(0, 6) }))
          }
        />
        {value.pendingPhotos.length > 0 ? (
          <p className="mt-1 text-xs text-muted">
            {tx(
              `${value.pendingPhotos.length} lista(s) para guardar con el cliente.`,
              `${value.pendingPhotos.length} ready to save with the client.`,
            )}
          </p>
        ) : null}
      </Field> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tx("Teléfono", "Phone")}>
          <Input
            type="tel"
            inputMode="tel"
            value={value.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="305 555 1234"
          />
        </Field>
        <Field label={value.kind === "one_time" ? tx("Precio del trabajo", "Job price") : tx("Precio por corte", "Price per cut")}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
              $
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="pl-7"
              value={value.pricePerCut}
              onChange={(e) => set("pricePerCut", e.target.value)}
              required
            />
          </div>
          <PricePresets
            value={value.pricePerCut}
            presets={settingsQ.data?.pricePresets ?? DEFAULT_PRICE_PRESETS}
            onPick={(amount) => set("pricePerCut", String(amount))}
          />
        </Field>
      </div>

      <Field
        label={tx("Dirección", "Address")}
        topic="direccion"
      >
        <div className="flex gap-2">
          <Input
            value={value.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder={tx("Calle, número, ciudad", "Street, number, city")}
            className="flex-1"
          />
          {value.address.trim() ? (
            <Button variant="outline" size="icon" asChild>
              <a
                href={mapsHref(value.address)}
                target="_blank"
                rel="noreferrer"
                aria-label={tx("Abrir en Google Maps", "Open in Google Maps")}
              >
                <MapPin />
              </a>
            </Button>
          ) : null}
        </div>
        {value.address.trim() ? (
          <a
            href={mapsHref(value.address)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
          >
            <MapPin className="size-4" />
            {tx("Abrir esta dirección en Google Maps", "Open this address in Google Maps")}
          </a>
        ) : (
          <p className="mt-1.5 text-xs text-muted">
            {tx("Si el contacto del teléfono trae dirección, se copia sola.", "If the phone contact has an address, it is copied on its own.")}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={locating}
            onClick={() => {
              if (!navigator.geolocation) {
                toast.error(tx("Este teléfono no comparte la ubicación.", "This phone does not share location."));
                return;
              }
              setLocating(true);
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const { latitude, longitude } = pos.coords;
                  void fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
                  )
                    .then((r) => r.json())
                    .then((data: { display_name?: string }) => {
                      if (data.display_name) set("address", data.display_name);
                      else toast.error(tx("No se encontró la dirección de este lugar.", "The address for this place was not found."));
                    })
                    .catch(() => toast.error(tx("No se pudo leer el mapa.", "Could not read the map.")))
                    .finally(() => setLocating(false));
                },
                () => {
                  setLocating(false);
                  toast.error(tx("No se pudo usar la ubicación. Actívala e inténtalo de nuevo.", "Could not use the location. Turn it on and try again."));
                },
                { enableHighAccuracy: true, timeout: 8000 },
              );
            }}
          >
            <Navigation className="size-4" />
            {locating ? tx("Buscando…", "Searching…") : tx("Usar dirección actual", "Use current address")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const q = value.address.trim();
              if (q.length < 3) {
                toast.error(tx("Escribe parte de la dirección y luego busca.", "Type part of the address, then search."));
                return;
              }
              void fetch(
                `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`,
              )
                .then((r) => r.json())
                .then((rows: { display_name?: string }[]) => {
                  const next = (rows ?? [])
                    .map((row) => row.display_name)
                    .filter((label): label is string => Boolean(label))
                    .map((label) => ({ label }));
                  setHits(next);
                  if (next.length === 0) toast(tx("No hubo coincidencias. Prueba con calle y ciudad.", "No matches. Try a street and a city."));
                })
                .catch(() => toast.error(tx("No se pudo buscar en el mapa.", "Could not search the map.")));
            }}
          >
            {tx("Buscar en el mapa", "Search the map")}
          </Button>
        </div>
        {hits.length > 0 ? (
          <ul className="mt-2 grid gap-1">
            {hits.map((hit) => (
              <li key={hit.label}>
                <button
                  type="button"
                  className="w-full rounded-sm bg-sun px-2 py-2 text-left text-sm"
                  onClick={() => {
                    set("address", hit.label);
                    setHits([]);
                  }}
                >
                  {hit.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Field>

      {value.kind === "regular" ? (
        <>
          <Field
            label={tx("Frecuencia", "Frequency")}
            topic="frecuencia"
          >
            <NativeSelect
              value={value.frequencyMode}
              onChange={(e) => {
                const mode = e.target.value as FrequencyMode;
                set("frequencyMode", mode);
                if (mode !== "custom") set("cutsPerMonth", Number(mode) as CutsPerMonth);
              }}
            >
              <option value="1">{tx("1 vez al mes", "Once a month")}</option>
              <option value="2">{tx("Cada 2 semanas", "Every 2 weeks")}</option>
              <option value="3">{tx("3 veces al mes", "3 times a month")}</option>
              <option value="4">{tx("Cada semana", "Every week")}</option>
              <option value="5">{tx("2 veces por semana", "Twice a week")}</option>
              <option value="custom">{tx("Personalizada…", "Custom…")}</option>
            </NativeSelect>
            <FrequencyPresets
              mode={value.frequencyMode}
              days={value.frequencyDays}
              onPick={(mode, days) => {
                setValue((prev) => ({
                  ...prev,
                  frequencyMode: mode,
                  frequencyDays: days,
                  cutsPerMonth: mode === "custom" ? prev.cutsPerMonth : (Number(mode) as CutsPerMonth),
                  weekday2: mode === "5" && prev.weekday2 === prev.weekday ? (prev.weekday + 3) % 7 : prev.weekday2,
                }));
              }}
            />
          </Field>

          {value.frequencyMode === "custom" && (
            <Field
              label={tx("Cada cuántos días", "Every how many days")}
              topic="cada-cuantos"
            >
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="size-12 shrink-0 px-0"
                  onClick={() =>
                    set("frequencyDays", String(Math.max(1, (Number(value.frequencyDays) || 7) - 1)))
                  }
                >
                  −
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={value.frequencyDays}
                  onChange={(e) => set("frequencyDays", e.target.value)}
                  required
                  className="text-center text-lg font-semibold tabular-nums"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="size-12 shrink-0 px-0"
                  onClick={() =>
                    set("frequencyDays", String(Math.min(60, (Number(value.frequencyDays) || 7) + 1)))
                  }
                >
                  +
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted">
                {tx(
                  `Un corte ${cadenceCopy(value)}, empezando el día de inicio.`,
                  `One cut ${cadenceCopy(value, true)}, starting on the start day.`,
                )}
              </p>
            </Field>
          )}

          <Field
            label={tx("Día de inicio", "Start day")}
            topic="dia-inicio"
          >
            <Input
              type="date"
              value={value.startDate}
              onChange={(e) => {
                const next = e.target.value;
                setValue((prev) => ({
                  ...prev,
                  startDate: next,
                  weekday: next ? weekdayFromISO(next) : prev.weekday,
                }));
              }}
              required
            />
            {value.startDate ? (
              <p className="mt-2 text-sm text-muted">
                {tx(
                  `Primer corte: ${weekdayLabel(weekdayFromISO(value.startDate))} ${formatDay(value.startDate, "d 'de' MMMM")}. Los demás, ${cadenceCopy(value)}.`,
                  `First cut: ${weekdayLabel(weekdayFromISO(value.startDate))} ${formatDay(value.startDate, "MMMM d")}. The rest, ${cadenceCopy(value, true)}.`,
                )}
              </p>
            ) : null}
            {upcoming.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {upcoming.map((d) => (
                  <li
                    key={d}
                    className="rounded-full bg-today-bg px-2.5 py-1 text-xs font-semibold text-today"
                  >
                    {formatDay(d, "EEE d MMM")}
                  </li>
                ))}
              </ul>
            ) : null}
          </Field>

          <Field
            label={tx("En cada visita (opcional)", "On each visit (optional)")}
            topic="en-cada-visita"
          >
            <Input
              value={value.standingExtras}
              onChange={(e) => set("standingExtras", e.target.value)}
              placeholder={tx("Orilla, soplado, perro suelto", "Edging, blowing, loose dog")}
            />
            <StringPresets
              presets={settingsQ.data?.visitPresets ?? DEFAULT_VISIT_PRESETS}
              selected={(item) => value.standingExtras.toLowerCase().includes(item.toLowerCase())}
              onPick={(item) => {
                const cur = value.standingExtras.trim();
                if (!cur) {
                  set("standingExtras", item);
                  return;
                }
                if (cur.toLowerCase().includes(item.toLowerCase())) return;
                set("standingExtras", `${cur}, ${item}`);
              }}
              onSave={(next) => updateSettings({ data: { visitPresets: next } })}
              saveLabel={tx("Guardar visitas", "Save visit options")}
            />
          </Field>

          <Field
            label={tx("Temporada", "Season")}
            topic="temporada-cliente"
          >
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={value.seasonOn}
                onChange={(e) => set("seasonOn", e.target.checked)}
                className="size-5 accent-primary"
              />
              {tx("Otro ritmo en este tramo", "A different pace in this stretch")}
            </label>
            {value.seasonOn ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Input value={value.seasonStart} onChange={(e) => set("seasonStart", e.target.value)} placeholder="11-01" />
                <Input value={value.seasonEnd} onChange={(e) => set("seasonEnd", e.target.value)} placeholder="02-28" />
                <Input
                  type="number"
                  min={7}
                  max={60}
                  value={value.seasonEvery}
                  onChange={(e) => set("seasonEvery", e.target.value)}
                />
              </div>
            ) : null}
          </Field>

          {value.frequencyMode === "5" && (
            <Field label={tx("Segundo día de la semana", "Second day of the week")}>
              <NativeSelect
                value={value.weekday2}
                onChange={(e) => set("weekday2", Number(e.target.value))}
              >
                {weekdayOptions().map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <ArrivalField
            value={value.arrivalTime}
            presets={settingsQ.data?.arrivalPresets ?? DEFAULT_ARRIVAL_PRESETS}
            onChange={(v) => set("arrivalTime", v)}
          />
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tx("¿Qué día empieza el trabajo?", "What day does the job start?")}>
            <Input
              type="date"
              value={value.oneTimeDate}
              onChange={(e) => set("oneTimeDate", e.target.value)}
              required
            />
          </Field>
          <ArrivalField
            value={value.arrivalTime}
            presets={settingsQ.data?.arrivalPresets ?? DEFAULT_ARRIVAL_PRESETS}
            onChange={(v) => set("arrivalTime", v)}
          />
          <Field label={tx("¿Qué hay que hacer?", "What needs to be done?")}>
            <Input
              value={value.oneTimeTitle}
              onChange={(e) => set("oneTimeTitle", e.target.value)}
              placeholder={tx("Limpieza, poda, fertilizante…", "Cleanup, trim, fertilizer…")}
              required
            />
            <TaskPresets
              presets={settingsQ.data?.taskPresets ?? DEFAULT_TASK_PRESETS}
              onPick={(text) => set("oneTimeTitle", text)}
              onSaved={() => void qc.invalidateQueries({ queryKey: ["settings"] })}
            />
          </Field>
        </div>
      )}

      <fieldset className="rounded-lg bg-surface p-3 shadow-card">
        <legend className="flex items-center gap-1 px-1 text-sm font-medium text-muted">
          {tx("Cobro", "Payment")}
          <Hint topic="cobro-cliente" />
        </legend>
        <div className="grid gap-2">
          <PayChoice
            selected={!value.paySameDay}
            title={tx("El monto se acumula. Requiere confirmación manual", "The amount adds up. It needs a manual confirmation")}
            hint={tx("Cada corte suma a la cuenta. Tú marcas Pagado cuando te pague.", "Each cut is added to the account. You mark Paid when they pay you.")}
            onSelect={() => set("paySameDay", false)}
          />
          <PayChoice
            selected={value.paySameDay}
            title={tx("Paga el mismo día", "Pays the same day")}
            hint={tx("Al marcar el corte como hecho, se registra el cobro solo.", "When you mark the cut done, the payment is recorded on its own.")}
            onSelect={() => {
              set("paySameDay", true);
              set("payDueDay", "");
            }}
          />
          {!value.paySameDay ? (
            <div className="rounded-md bg-bg px-3 py-2.5">
              <p className="text-sm font-semibold">{tx("Día de pago habitual (opcional)", "Usual pay day (optional)")}</p>
              <p className="text-xs text-muted">
                {tx(
                  "Para clientes que pagan un día fijo del mes. No se da por cobrado: si se atrasa, el saldo sigue hasta que tú confirmes.",
                  "For clients who pay on a fixed day of the month. It is not marked collected: if they are late, the balance stays until you confirm.",
                )}
              </p>
              <NativeSelect
                className="mt-2"
                value={value.payDueDay}
                onChange={(e) => set("payDueDay", e.target.value)}
              >
                <option value="">{tx("Sin fecha fija", "No fixed date")}</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>
                    {tx(`El ${d} de cada mes`, `Day ${d} of each month`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
        </div>
      </fieldset>

      <Field
        label={tx("Notas del cliente", "Client notes")}
        topic="notas-cliente"
      >
        <RichNotes
          cornerUndo
          value={value.richNotes}
          onDraft={(text) => {
            notesRef.current = text;
          }}
          onChange={(html) => {
            notesRef.current = html;
            set("richNotes", html);
          }}
          placeholder={tx("Portón al lado, perro, llave debajo de la maceta…", "Gate on the side, dog, key under the pot…")}
        />
      </Field>

      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? tx("Guardando…", "Saving…") : submitLabel}
      </Button>
      <OffDayDialog
        iso={rareAsk?.iso ?? null}
        kind={rareAsk?.kind ?? null}
        pending={pending}
        onKeep={() => {
          const iso = rareAsk?.iso;
          setRareAsk(null);
          if (!iso) return;
          onSubmit({ ...value, richNotes: notesRef.current });
        }}
        onMonday={() => {
          const iso = rareAsk?.iso;
          setRareAsk(null);
          if (!iso) return;
          const next = shiftToMonday(iso);
          if (value.kind === "regular") {
            onSubmit({
              ...value,
              startDate: next,
              weekday: weekdayFromISO(next),
              richNotes: notesRef.current,
            });
          } else {
            onSubmit({ ...value, oneTimeDate: next, richNotes: notesRef.current });
          }
        }}
        onClose={() => setRareAsk(null)}
      />
    </form>
  );
}

function Field({
  label,
  hint,
  topic,
  children,
}: {
  label: string;
  hint?: string;
  topic?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-0.5">
        <Label className="mb-0">{label}</Label>
        {topic ? <Hint topic={topic} /> : hint ? <Hint text={hint} /> : null}
      </div>
      {children}
    </div>
  );
}

function KindToggle({
  value,
  onChange,
}: {
  value: ClientKind;
  onChange: (v: ClientKind) => void;
}) {
  const tx = useTx();
  const options: { id: ClientKind; label: string }[] = [
    { id: "regular", label: tx("Cliente regular", "Regular client") },
    { id: "one_time", label: tx("Trabajo de una vez", "One-time job") },
  ];
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-0.5">
        <Label className="mb-0">{tx("Tipo", "Type")}</Label>
        <Hint topic="tipo-cliente" />
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-2 p-1">
        {options.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "h-11 rounded-sm text-sm font-semibold transition-colors duration-150",
              value === id ? "bz-pick" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PayChoice({
  selected,
  title,
  hint,
  onSelect,
}: {
  selected: boolean;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-md px-3 py-2.5 text-left transition-colors",
        selected ? "bg-today-bg text-fg" : "bg-bg text-muted",
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs">{hint}</p>
    </button>
  );
}

const FREQ_KEY = "ols-freq-presets";
const DEFAULT_FREQ = ["1x/s", "2x/s", "1x/m"];

function readFreqPresets(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FREQ_KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return DEFAULT_FREQ;
    const next = raw
      .map((item) => String(item).trim())
      .filter((item) => {
        const text = item.toLowerCase().replace(/\s/g, "");
        return Boolean(item) && text !== "3x/s" && text !== "3/s";
      })
      .slice(0, 8);
    return next.length > 0 ? next : DEFAULT_FREQ;
  } catch {
    return DEFAULT_FREQ;
  }
}

function parseFreq(code: string): { mode: FrequencyMode; days: string } {
  const text = code.trim().toLowerCase().replace(/\s/g, "");
  if (text === "1x/m" || text === "1/m") return { mode: "1", days: "10" };
  if (text === "1x/s" || text === "1/s") return { mode: "4", days: "7" };
  if (text === "2x/s" || text === "2/s") return { mode: "5", days: "7" };
  if (text === "3x/s" || text === "3/s") return { mode: "custom", days: "2" };
  const every = /^cada(\d+)$/.exec(text) ?? /^(\d+)d$/.exec(text);
  if (every) return { mode: "custom", days: String(Math.min(60, Math.max(1, Number(every[1])))) };
  const times = /^(\d+)x\/s$/.exec(text);
  if (times) {
    const n = Number(times[1]);
    if (n <= 1) return { mode: "4", days: "7" };
    if (n === 2) return { mode: "5", days: "7" };
    return { mode: "custom", days: String(Math.max(1, Math.round(7 / n))) };
  }
  return { mode: "2", days: "14" };
}

function PresetLine({
  editing,
  label,
  onToggle,
  gear = true,
  children,
}: {
  editing: boolean;
  label: string;
  onToggle: () => void;
  gear?: boolean;
  children: ReactNode;
}) {
  const chips = <div className="flex flex-wrap gap-1">{children}</div>;
  if (!gear) return chips;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-start gap-1">
      {chips}
      <button
        type="button"
        aria-label={label}
        aria-pressed={editing}
        onClick={onToggle}
        className={cn(
          "grid size-8 place-items-center rounded-full",
          editing ? "bz-pick bz-pick-icon" : "text-muted hover:bg-sun hover:text-fg",
        )}
      >
        <PencilLine className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function freqOn(code: string, mode: FrequencyMode, days: string) {
  const parsed = parseFreq(code);
  return parsed.mode === mode && (parsed.mode !== "custom" || parsed.days === String(Number(days) || 0));
}

function FrequencyPresets({
  mode,
  days,
  onPick,
}: {
  mode: FrequencyMode;
  days: string;
  onPick: (mode: FrequencyMode, days: string) => void;
}) {
  const tx = useTx();
  const [presets, setPresets] = useState(DEFAULT_FREQ);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_FREQ.join("\n"));
  useEffect(() => {
    const next = readFreqPresets();
    setPresets(next);
    setDraft(next.join("\n"));
  }, []);
  return (
    <div className="mt-2">
      <PresetLine
        editing={editing}
        label={editing ? tx("Cerrar frecuencias", "Close frequencies") : tx("Editar frecuencias", "Edit frequencies")}
        onToggle={() => {
          setDraft(presets.join("\n"));
          setEditing((open) => !open);
        }}
      >
        {presets.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => {
              const parsed = parseFreq(code);
              onPick(parsed.mode, parsed.days);
            }}
            className={cn(
              "h-8 rounded-full px-2 text-[11px] font-semibold",
              freqOn(code, mode, days) ? "bz-pick" : "bg-sun text-muted",
            )}
          >
            {code}
          </button>
        ))}
      </PresetLine>
      {editing ? (
        <div className="mt-2 grid gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded-md bg-bg px-3 py-2 text-sm"
            placeholder={"1x/s\n2x/s\n1x/m"}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const next = draft
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 8);
              if (next.length === 0) {
                toast.error(tx("Escribe una frecuencia por línea, como 1x/s.", "Write one frequency per line, like 1x/s."));
                return;
              }
              try {
                localStorage.setItem(FREQ_KEY, JSON.stringify(next));
              } catch {
                /* ignore */
              }
              setPresets(next);
              setEditing(false);
              toast.success(tx("Frecuencias guardadas", "Frequencies saved"));
            }}
          >
            {tx("Guardar frecuencias", "Save frequencies")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function PricePresets({
  value,
  presets,
  onPick,
}: {
  value: string;
  presets: number[];
  onPick: (amount: number) => void;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(presets.join("\n"));
  const current = Number(value);
  return (
    <div className="mt-2">
      <PresetLine
        editing={editing}
        label={editing ? tx("Cerrar precios", "Close prices") : tx("Editar precios", "Edit prices")}
        onToggle={() => {
          setDraft(presets.join("\n"));
          setEditing((open) => !open);
        }}
      >
        {presets.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onPick(amount)}
            className={cn(
              "h-8 rounded-full px-2 text-[11px] font-semibold",
              current === amount ? "bz-pick" : "bg-sun text-muted",
            )}
          >
            {money(amount)}
          </button>
        ))}
      </PresetLine>
      {editing ? (
        <div className="mt-2 grid gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded-md bg-bg px-3 py-2 text-sm"
            placeholder={tx("Un precio por línea, como 35", "One price per line, like 35")}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const next = draft
                .split("\n")
                .map((line) => Number(line.trim().replace("$", "")))
                .filter((n) => Number.isFinite(n) && n > 0 && n <= 100000)
                .map((n) => Math.round(n * 100) / 100)
                .slice(0, 12);
              if (next.length === 0) {
                toast.error(tx("Escribe un precio por línea, como 35.", "Write one price per line, like 35."));
                return;
              }
              void updateSettings({ data: { pricePresets: next } }).then(async () => {
                qc.setQueryData(["settings"], (prev: { pricePresets?: number[] } | undefined) =>
                  prev ? { ...prev, pricePresets: next } : prev,
                );
                await qc.invalidateQueries({ queryKey: ["settings"] });
                setEditing(false);
                toast.success(tx("Precios guardados", "Prices saved"));
              });
            }}
          >
            {tx("Guardar precios", "Save prices")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DebtPresets({
  value,
  presets,
  onPick,
  editable = true,
}: {
  value: string;
  presets: number[];
  onPick: (amount: number) => void;
  editable?: boolean;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(presets.join("\n"));
  const current = Number(value);
  return (
    <div className="mt-2">
      <PresetLine
        gear={editable}
        editing={editing}
        label={tx("Editar montos", "Edit amounts")}
        onToggle={() => {
          setDraft(presets.join("\n"));
          setEditing((open) => !open);
        }}
      >
        {presets.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onPick(amount)}
            className={cn(
              "h-8 rounded-full px-2 text-[11px] font-semibold",
              current === amount ? "bz-pick" : "bg-sun text-muted",
            )}
          >
            {money(amount)}
          </button>
        ))}
      </PresetLine>
      {editable && editing ? (
        <div className="mt-2 grid gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded-md bg-bg px-3 py-2 text-sm"
            placeholder={tx("Un monto por línea, como 80", "One amount per line, like 80")}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const next = draft
                .split("\n")
                .map((line) => Number(line.trim().replace("$", "")))
                .filter((n) => Number.isFinite(n) && n > 0 && n <= 100000)
                .map((n) => Math.round(n * 100) / 100)
                .slice(0, 12);
              if (next.length === 0) {
                toast.error(tx("Escribe un monto por línea, como 80.", "Write one amount per line, like 80."));
                return;
              }
              void updateSettings({ data: { debtPresets: next } }).then(async () => {
                qc.setQueryData(["settings"], (prev: { debtPresets?: number[] } | undefined) =>
                  prev ? { ...prev, debtPresets: next } : prev,
                );
                await qc.invalidateQueries({ queryKey: ["settings"] });
                setEditing(false);
                toast.success(tx("Montos guardados", "Amounts saved"));
              });
            }}
          >
            {tx("Guardar montos", "Save amounts")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ArrivalField({
  value,
  presets,
  onChange,
}: {
  value: string;
  presets: string[];
  onChange: (v: string) => void;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(presets.join("\n"));
  return (
    <Field label={tx("Hora de llegada (opcional)", "Arrival time (optional)")}>
      <Input type="time" value={value} onChange={(e) => onChange(e.target.value)} />
      <div className="mt-2">
      <PresetLine
        editing={editing}
        label={editing ? tx("Cerrar horas", "Close times") : tx("Editar horas", "Edit times")}
        onToggle={() => {
          setDraft(presets.join("\n"));
          setEditing((v) => !v);
        }}
      >
        {presets.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={cn(
              "h-8 rounded-full px-2 text-[11px] font-semibold",
              value === t ? "bz-pick" : "bg-sun text-muted",
            )}
          >
            {t}
          </button>
        ))}
      </PresetLine>
      </div>
      {editing ? (
        <div className="mt-2 grid gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded-md bg-bg px-3 py-2 text-sm"
            placeholder={tx("Una hora por línea, como 08:00", "One time per line, like 08:00")}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const next = draft
                .split("\n")
                .map((s) => s.trim())
                .filter((s) => /^\d{2}:\d{2}$/.test(s))
                .slice(0, 8);
              if (next.length === 0) {
                toast.error(tx("Usa el formato 08:00, una hora por línea.", "Use the 08:00 format, one time per line."));
                return;
              }
              void updateSettings({ data: { arrivalPresets: next } }).then(async () => {
                await qc.invalidateQueries({ queryKey: ["settings"] });
                setEditing(false);
                toast.success(tx("Horas guardadas", "Times saved"));
              });
            }}
          >
            {tx("Guardar horas", "Save times")}
          </Button>
        </div>
      ) : null}
    </Field>
  );
}

export function TaskPresets({
  presets,
  onPick,
  onSaved,
}: {
  presets: string[];
  onPick: (text: string) => void;
  onSaved: () => void;
}) {
  const tx = useTx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(presets.join("\n"));
  return (
    <div className="mt-2">
      <p className="mb-1 text-sm font-semibold">{tx("Opciones frecuentes", "Frequent options")}</p>
      <PresetLine
        editing={editing}
        label={editing ? tx("Cerrar edición", "Close editing") : tx("Editar opciones", "Edit options")}
        onToggle={() => {
          setDraft(presets.join("\n"));
          setEditing((v) => !v);
        }}
      >
        {presets.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPick(item)}
            className="h-8 rounded-full bg-soil-bg px-2 text-[11px] font-semibold text-soil"
          >
            {item}
          </button>
        ))}
      </PresetLine>
      {editing ? (
        <div className="grid gap-2 pb-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="w-full rounded-md bg-surface px-3 py-2 text-sm"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const next = draft
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 24);
              if (next.length === 0) return;
              void updateSettings({ data: { taskPresets: next } }).then(() => {
                onSaved();
                setEditing(false);
                toast.success(tx("Opciones guardadas", "Options saved"));
              });
            }}
          >
            {tx("Guardar opciones", "Save options")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StringPresets({
  presets,
  selected,
  onPick,
  onSave,
  saveLabel,
}: {
  presets: string[];
  selected: (item: string) => boolean;
  onPick: (item: string) => void;
  onSave: (next: string[]) => Promise<unknown>;
  saveLabel: string;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(presets.join("\n"));
  return (
    <div className="mt-2">
      <PresetLine
        editing={editing}
        label={editing ? tx("Cerrar edición", "Close editing") : tx("Editar opciones", "Edit options")}
        onToggle={() => {
          setDraft(presets.join("\n"));
          setEditing((v) => !v);
        }}
      >
        {presets.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPick(item)}
            className={cn(
              "h-8 rounded-full px-2 text-[11px] font-semibold",
              selected(item) ? "bz-pick" : "bg-sun text-muted",
            )}
          >
            {item}
          </button>
        ))}
      </PresetLine>
      {editing ? (
        <div className="mt-2 grid gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded-md bg-bg px-3 py-2 text-sm"
            placeholder={tx("Una opción por línea", "One option per line")}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const next = draft
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 16);
              if (next.length === 0) {
                toast.error(tx("Escribe al menos una opción.", "Write at least one option."));
                return;
              }
              void onSave(next).then(async () => {
                await qc.invalidateQueries({ queryKey: ["settings"] });
                setEditing(false);
                toast.success(tx("Opciones guardadas", "Options saved"));
              });
            }}
          >
            {saveLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CueField({ value, onChange, presets }: { value: string; onChange: (next: string) => void; presets: string[] }) {
  const tx = useTx();
  const people = useQuery({
    queryKey: ["clients", "cue-mentions"],
    queryFn: () => listClients({ data: { filter: "active", sort: "name" } }),
  });
  const match = /@([^\s@]*)$/.exec(value);
  const query = match ? match[1].trim().toLowerCase() : null;
  const hits =
    query == null
      ? []
      : (people.data ?? [])
          .filter((client) => client.name.trim())
          .filter((client) => {
            const name = client.name.trim().toLowerCase();
            return !query || name.startsWith(query) || name.includes(query);
          })
          .slice(0, 6);

  function pick(name: string) {
    const found = /@([^\s@]*)$/.exec(value);
    const next = found ? `${value.slice(0, found.index)}@${name.trim()} ` : `${value}@${name.trim()} `;
    onChange(next.slice(0, 80));
  }

  return (
    <div className="relative z-30">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={tx("Casa azul, esquina, vecino de @", "Blue house, corner, neighbor of @")}
        maxLength={80}
      />
      {hits.length > 0 ? (
        <ul className="absolute inset-x-0 top-full z-50 mt-1 max-h-52 overflow-auto rounded-md bg-surface shadow-card">
          {hits.map((client) => (
            <li key={client.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center px-3 text-left text-sm font-semibold"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pick(client.name);
                }}
              >
                @{client.name.trim()}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <StringPresets
        presets={presets}
        selected={(item) => value.trim() === item || value.includes(item)}
        onPick={(item) => onChange(item.slice(0, 80))}
        onSave={(next) => updateSettings({ data: { cuePresets: next } })}
        saveLabel={tx("Guardar pistas", "Save cues")}
      />
    </div>
  );
}

