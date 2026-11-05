import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Archive, Check, ChevronDown, Filter, MapPin, Phone, Pin, Plus, Search, Trash2, UserCheck, UserMinus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConfirmLink } from "@/components/confirm-link";
import { ContactIcons } from "@/components/contact-icons";
import { CueChip } from "@/components/cue-chip";
import { DensityScope, DensityToggle, useDensity, useQuadCols } from "@/components/density-toggle";
import { Hint } from "@/components/hint";
import { ScrollTop } from "@/components/scroll-top";
import { invalidateLawn } from "@/components/job-card";
import { SwipeRow } from "@/components/swipe-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDay, frequencyLabel, mapsHref, money, telHref, weekdayLabel } from "@/lib/format";
import { MeshName } from "@/components/mesh-name";
import { meshFrame, viewGrid } from "@/lib/density";
import { useTx } from "@/lib/i18n";
import { bulkClients, deleteClient, getClientInventory, listClients, setClientActive } from "@/lib/server/lawn";
import type { ClientFilter, ClientRow, ClientSort } from "@/lib/types";
import { useUndo } from "@/lib/undo";
import { cn } from "@/lib/utils";
import { DayNightSwitch } from "@/components/day-night-switch";
import { WeatherChip } from "@/components/weather-chip";

export const Route = createFileRoute("/clientes/")({
  component: function ClientesRoute() {
    return (
      <DensityScope scope="clientes">
        <ClientesPage />
      </DensityScope>
    );
  },
});

const SORTS: { value: ClientSort; label: string }[] = [
  { value: "name", label: "Nombre A–Z" },
  { value: "name_desc", label: "Nombre Z–A" },
  { value: "newest", label: "Más nuevos" },
  { value: "oldest", label: "Más antiguos" },
  { value: "price_desc", label: "Precio mayor" },
  { value: "price_asc", label: "Precio menor" },
  { value: "balance_desc", label: "Por cobrar mayor" },
  { value: "balance_asc", label: "Por cobrar menor" },
  { value: "next_cut", label: "Próximo corte" },
  { value: "overdue", label: "Atrasados primero" },
];

const SORT_EN: Record<ClientSort, string> = {
  name: "Name A–Z",
  name_desc: "Name Z–A",
  newest: "Newest",
  oldest: "Oldest",
  price_desc: "Highest price",
  price_asc: "Lowest price",
  balance_desc: "Highest to collect",
  balance_asc: "Lowest to collect",
  next_cut: "Next cut",
  overdue: "Late first",
};

const FILTER_EN: Record<ClientFilter, { label: string; hint?: string }> = {
  active: {
    label: "Active",
    hint: "People still on the route. The archive is not included.",
  },
  regular: {
    label: "Regular",
    hint: "Cuts that repeat every week, or on that yard's own pace.",
  },
  one_time: {
    label: "One-time",
    hint: "One-off jobs, not every week: a cleanup, a trim, a new yard that does not repeat.",
  },
  owing: {
    label: "With a balance",
    hint: "They still owe money. The amount stays in To collect.",
  },
  triple: {
    label: "Special cases",
    hint: "Three or more cuts this month, or an extra job. Use it to look at yards that are not the usual cut.",
  },
  risk: {
    label: "High risk",
    hint: "They still owe after the limit you set in Settings. The count uses the last payment, or the last cut if they never paid.",
  },
  blacklist: {
    label: "Blacklist",
    hint: "Blocked clients. They do not enter the automatic schedule and their pending jobs are removed.",
  },
  inactive: {
    label: "Archive",
    hint: "Taken off the route. They stay saved with all their data until you bring them back or delete them.",
  },
};

const FILTERS: { value: ClientFilter; label: string; hint?: string }[] = [
  { value: "active", label: "Activos", hint: "Quienes siguen en la ruta. No incluye los archivos." },
  { value: "regular", label: "Regulares", hint: "Cortes que se repiten cada semana, o al ritmo de ese patio." },
  {
    value: "one_time",
    label: "De una vez",
    hint: "Trabajos sueltos, no de cada semana: una limpieza, una poda, un patio nuevo que no se repite.",
  },
  { value: "owing", label: "Con saldo", hint: "Todavía deben dinero. El monto sigue en Por cobrar." },
  {
    value: "triple",
    label: "Casos especiales",
    hint: "Tres o más cortes este mes, o un trabajo extra. Sirve para mirar los patios que no son el corte de siempre.",
  },
  {
    value: "risk",
    label: "Alto riesgo",
    hint: "Siguen debiendo después del plazo que elegiste en Ajustes. El conteo usa el último pago, o el último corte si nunca pagaron.",
  },
  {
    value: "blacklist",
    label: "Lista negra",
    hint: "Clientes vetados. No entran en la agenda automática y se quitan sus trabajos pendientes.",
  },
  {
    value: "inactive",
    label: "Archivos",
    hint: "Dados de baja. Quedan guardados con todos sus datos hasta que los reactives o los borres.",
  },
];

function SortMenu({ value, onChange }: { value: ClientSort; onChange: (next: ClientSort) => void }) {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = SORTS.find((item) => item.value === value) ?? SORTS[0]!;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-sm bg-surface px-3 text-left text-sm font-semibold text-fg shadow-card"
      >
        <span className="truncate">{tx(current.label, SORT_EN[current.value])}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul role="listbox" className="absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-auto rounded-md bg-surface py-1 shadow-card">
          {SORTS.map((item) => {
            const selected = item.value === value;
            return (
              <li key={item.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm",
                    selected ? "bg-primary/10 font-semibold text-primary" : "text-fg active:bg-sun",
                  )}
                >
                  <span>{tx(item.label, SORT_EN[item.value])}</span>
                  {selected ? <Check className="size-4 shrink-0" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ClientesPage() {
  const tx = useTx();
  const search = useSearch({ from: "/clientes" });
  const navigate = useNavigate({ from: "/clientes" });
  const density = useDensity();
  const cols = useQuadCols();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<ClientSort>("name");
  const [filter, setFilter] = useState<ClientFilter>(search.filter ?? "active");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Inventario is pinned by default (1.4.61). It stays pinned unless unpinned after this change
  // (new key, so an old "0" from before does not count).
  const [invPin, setInvPin] = useState(() => {
    try {
      return localStorage.getItem("ols-inventory-pin-v2") !== "0";
    } catch {
      return true;
    }
  });
  const [askUnpin, setAskUnpin] = useState(false);
  const savePin = (next: boolean) => {
    setInvPin(next);
    if (next) setInvOpen(true);
    try {
      localStorage.setItem("ols-inventory-pin-v2", next ? "1" : "0");
      localStorage.setItem("ols-inventory-pin", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  const [invOpen, setInvOpen] = useState(invPin);
  const [picked, setPicked] = useState<number[]>([]);
  const [askBulk, setAskBulk] = useState<"reactivate" | "delete" | null>(null);
  const query = useQuery({
    queryKey: ["clients", { q, sort, filter, flow: search.flow, since: search.since, until: search.until }],
    queryFn: () =>
      listClients({
        data: {
          q,
          sort,
          filter,
          flow: search.flow,
          since: search.since,
          until: search.until,
        },
      }),
  });
  const inventory = useQuery({ queryKey: ["inventory"], queryFn: () => getClientInventory() });
  const clients = query.data ?? [];
  const totalPrice = useMemo(
    () => clients.reduce((s, c) => s + (c.kind === "regular" ? c.pricePerCut : 0), 0),
    [clients],
  );
  const inArchive = filter === "inactive";

  useEffect(() => {
    if (search.filter) setFilter(search.filter);
  }, [search.filter]);

  useEffect(() => {
    if (!search.filter || search.filter === "active") return;
    const t = window.setTimeout(() => {
      document.getElementById("lista-clientes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 280);
    return () => window.clearTimeout(t);
  }, [search.filter]);

  useEffect(() => {
    setPicked([]);
  }, [filter, q]);

  function applyFilter(next: ClientFilter) {
    setFilter(next);
    void navigate({ search: { filter: next } });
    window.setTimeout(() => {
      document.getElementById("lista-clientes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 280);
  }

  function toggle(id: number) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAll() {
    if (picked.length === clients.length) setPicked([]);
    else setPicked(clients.map((c) => c.id));
  }

  const bulk = useMutation({
    mutationFn: (action: "reactivate" | "delete") => bulkClients({ data: { ids: picked, action } }),
    onSuccess: async (_, action) => {
      toast.success(
        action === "reactivate"
          ? tx(`${picked.length} reactivados`, `${picked.length} reactivated`)
          : tx(`${picked.length} eliminados para siempre`, `${picked.length} deleted forever`),
      );
      setPicked([]);
      setAskBulk(null);
      await invalidateLawn(qc);
    },
    onError: () => toast.error(tx("No se pudo completar", "Could not finish")),
  });

  const gap = density === "dense" ? "gap-1.5" : density === "compact" ? "gap-2" : "gap-3";

  return (
    <AppShell
      title={inArchive ? tx("Archivos", "Archive") : tx("Clientes", "Clients")}
      action={
        <span className="inline-flex items-center gap-3">
          <WeatherChip />
          <span className="mr-2 grid w-10 shrink-0 place-items-center">
            <DayNightSwitch />
          </span>
        </span>
      }
    >
      <ScrollTop aboveFab />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_12rem]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              inArchive
                ? tx("Buscar en archivos", "Search the archive")
                : tx("Nombre, teléfono, dirección o pista", "Name, phone, address, or cue")
            }
            className="pl-10"
          />
        </div>
        <SortMenu value={sort} onChange={setSort} />
      </div>

      {search.flow ? (
        <p className="mb-3 rounded-md bg-sun px-3 py-2 text-sm">
          {search.flow === "altas"
            ? tx("Clientes nuevos de ese mes.", "New clients from that month.")
            : tx("Clientes dados de baja ese mes.", "Clients taken off that month.")}{" "}
          <button type="button" className="font-semibold text-primary" onClick={() => applyFilter("active")}>
            {tx("Ver todos", "See all")}
          </button>
        </p>
      ) : null}

      <details
        id="inventario"
        className="group mb-4 rounded-md bg-surface px-3 py-2 shadow-card"
        open={invPin || invOpen}
        onToggle={(event) => {
          const next = (event.currentTarget as HTMLDetailsElement).open;
          if (!next && invPin) return;
          setInvOpen(next);
        }}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold touch-manipulation [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-1">
            {tx("Inventario de clientes", "Client inventory")}
            <Hint topic="inventario" />
          </span>
          <span className="ml-auto flex items-center gap-1">
            <span className="text-xs font-medium text-muted group-open:hidden">{tx("Ver", "View")}</span>
            <button
              type="button"
              aria-pressed={invPin}
              aria-label={invPin ? tx("Dejar de fijar el inventario", "Unpin the inventory") : tx("Fijar el inventario", "Pin the inventory")}
              className={cn("grid size-9 place-items-center rounded-full", invPin ? "bz-pick bz-pick-icon" : "text-muted")}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (invPin) setAskUnpin(true);
                else savePin(true);
              }}
            >
              <Pin className={cn("size-3.5", invPin && "fill-current")} />
            </button>
          </span>
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-1.5 pb-1">
          <Link
            to="/clientes"
            search={{ filter: "regular" }}
            className="bz-inv-tile is-today rounded-sm bg-today-bg px-1.5 py-1.5 text-center"
          >
            <p className="font-display text-lg font-semibold tabular-nums text-today">
              {inventory.data?.regular ?? "—"}
            </p>
            <p className="text-xs text-muted">{tx("Permanentes", "Regular")}</p>
          </Link>
          <Link
            to="/clientes"
            search={{ filter: "one_time" }}
            className="bz-inv-tile is-pending rounded-sm bg-pending-bg px-1.5 py-1.5 text-center"
          >
            <p className="font-display text-lg font-semibold tabular-nums text-pending">
              {inventory.data?.oneTime ?? "—"}
            </p>
            <p className="text-xs text-muted">{tx("Una vez", "One-time")}</p>
          </Link>
          <Link
            to="/clientes"
            search={{ filter: "active" }}
            className="bz-inv-tile is-sun rounded-sm bg-sun px-1.5 py-1.5 text-center"
          >
            <p className="font-display text-lg font-semibold tabular-nums">{inventory.data?.total ?? "—"}</p>
            <p className="text-xs text-muted">{tx("Juntos", "Together")}</p>
          </Link>
          <Link
            to="/clientes"
            search={{ filter: "inactive" }}
            className="bz-inv-tile is-soil rounded-sm bg-soil-bg px-1.5 py-1.5 text-center"
          >
            <p className="font-display text-lg font-semibold tabular-nums text-soil">
              {inventory.data?.archived ?? "—"}
            </p>
            <p className="text-xs text-muted">{tx("Archivos", "Archive")}</p>
          </Link>
        </div>
      </details>
      <ConfirmDialog
        open={askUnpin}
        title={tx("¿Dejar de fijar el inventario?", "Unpin the inventory?")}
        description={tx(
          "Ya no quedará abierto al entrar. Puedes fijarlo otra vez cuando quieras.",
          "It will no longer stay open when you come in. You can pin it again anytime.",
        )}
        confirmLabel={tx("Dejar de fijar", "Unpin")}
        cancelLabel={tx("Mantener", "Keep it")}
        onConfirm={() => {
          setAskUnpin(false);
          savePin(false);
        }}
        onCancel={() => setAskUnpin(false)}
      />

      <div className="relative mb-4" data-no-swipe>
        <div data-spot="clientes-filtros" data-spot-alt="archivo" className="flex h-11 w-full items-center gap-1 rounded-full bg-surface pr-1 pl-3 text-sm font-semibold shadow-card">
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
            className="flex h-11 min-w-0 flex-1 items-center gap-2 text-left"
          >
            <Filter className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">
              {tx(FILTERS.find((item) => item.value === filter)?.label ?? "Activos", FILTER_EN[filter].label)}
            </span>
          </button>
          <Hint topic="clientes-filtros" />
        </div>
        {filtersOpen ? (
          <div className="mt-2 grid gap-1 rounded-2xl bg-surface p-2 pb-3 shadow-card">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  applyFilter(item.value);
                  setFiltersOpen(false);
                }}
                className={cn(
                  "rounded-xl px-3 py-2 text-left",
                  filter === item.value ? "bz-pick" : "hover:bg-sun",
                )}
              >
                <span className="block text-sm font-semibold">{tx(item.label, FILTER_EN[item.value].label)}</span>
                {item.hint ? (
                  <span className={cn("mt-0.5 block text-xs leading-snug", filter === item.value ? "text-primary-fg/80" : "text-muted")}>
                    {tx(item.hint, FILTER_EN[item.value].hint ?? item.hint)}
                  </span>
                ) : (
                  <span className={cn("mt-0.5 block text-xs", filter === item.value ? "text-primary-fg/80" : "text-muted")}>
                    {tx("La lista de siempre.", "The usual list.")}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {inArchive && clients.length > 0 ? (
        <div data-spot="archivo" className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface p-2 shadow-card">
          <button
            type="button"
            onClick={selectAll}
            className="h-11 rounded-sm px-3 text-sm font-semibold hover:bg-sun"
          >
            {picked.length === clients.length ? tx("Quitar selección", "Clear selection") : tx("Seleccionar todo", "Select all")}
          </button>
          <span className="text-sm text-muted">{tx(`${picked.length} elegidos`, `${picked.length} selected`)}</span>
          <Button size="sm" disabled={!picked.length} onClick={() => setAskBulk("reactivate")}>
            {tx("Reactivar", "Reactivate")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-late"
            disabled={!picked.length}
            onClick={() => setAskBulk("delete")}
          >
            {tx("Borrar", "Delete")}
          </Button>
        </div>
      ) : null}

      <div className="mb-3 grid gap-2">
        <p className="bz-tally">
          {clients.length} {clients.length === 1 ? tx("cliente", "client") : tx("clientes", "clients")}
          {filter === "regular" || filter === "active"
            ? ` · ${money(totalPrice)} ${tx("por ronda de cortes", "per round of cuts")}`
            : null}
          {filter === "triple" ? tx(" con 3 o más cortes este mes", " with 3 or more cuts this month") : null}
          <Hint topic={inArchive ? "archivo" : "lista-clientes"} />
        </p>
        <DensityToggle />
      </div>

      {query.isLoading && (
        <div className="grid gap-3">
          <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
          <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
        </div>
      )}

      {!query.isLoading && clients.length === 0 && (
        <div className="rounded-xl bg-sun px-5 py-8 text-center">
          <Archive className="mx-auto mb-2 size-8 text-muted" />
          <p className="font-display text-lg font-semibold">
            {inArchive ? tx("Archivos vacío", "Archive is empty") : tx("Nadie por aquí", "Nobody here")}
          </p>
          <p className="mt-1 text-sm text-muted">
            {inArchive
              ? tx(
                  "Los clientes dados de baja aparecen aquí, con todos sus datos.",
                  "Clients taken off the route appear here, with all their data.",
                )
              : tx("Añade un cliente o cambia el filtro.", "Add a client or change the filter.")}
          </p>
        </div>
      )}

      <ul id="lista-clientes" className={viewGrid(density, cols, gap)}>
        {clients.map((c) => (
          <li key={c.id}>
            <ClientListCard
              client={c}
              selecting={inArchive}
              selected={picked.includes(c.id)}
              onToggle={() => toggle(c.id)}
            />
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={askBulk === "reactivate"}
        title={tx(
          `¿Reactivar ${picked.length} ${picked.length === 1 ? "cliente" : "clientes"}?`,
          `Reactivate ${picked.length} ${picked.length === 1 ? "client" : "clients"}?`,
        )}
        description={tx(
          "Vuelven a la agenda con su horario y su cuenta.",
          "They return to the schedule with their times and their account.",
        )}
        confirmLabel={tx("Sí, reactivar", "Yes, reactivate")}
        pending={bulk.isPending}
        onConfirm={() => bulk.mutate("reactivate")}
        onCancel={() => setAskBulk(null)}
      />
      <ConfirmDialog
        open={askBulk === "delete"}
        title={tx(
          `¿Eliminar ${picked.length} ${picked.length === 1 ? "cliente" : "clientes"}?`,
          `Delete ${picked.length} ${picked.length === 1 ? "client" : "clients"} forever?`,
        )}
        description={tx(
          "Se borra el historial de cada uno. Esta acción no se puede deshacer. Antes se guarda una copia.",
          "Each history is deleted. This cannot be undone. A copy is saved first.",
        )}
        confirmLabel={tx("Eliminar", "Delete")}
        danger
        pending={bulk.isPending}
        onConfirm={() => bulk.mutate("delete")}
        onCancel={() => setAskBulk(null)}
      />
      <Link
        to="/nuevo"
        className="alive-fab fixed right-4 bottom-[calc(5.25rem+var(--bz-chin))] z-20 grid size-14 place-items-center rounded-full bg-primary text-primary-fg shadow-card"
        aria-label={tx("Añadir cliente", "Add client")}
      >
        <Plus className="size-6" />
      </Link>
    </AppShell>
  );
}

function ClientListCard({
  client,
  selecting,
  selected,
  onToggle,
}: {
  client: ClientRow;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const density = useDensity();
  const cols = useQuadCols();
  const dense = density === "dense";
  const media = density === "compact";
  const quad = density === "quad";
  const push = useUndo((s) => s.push);
  const [askOff, setAskOff] = useState(false);
  const [askDel, setAskDel] = useState(false);
  const [askOn, setAskOn] = useState(false);

  const deactivate = useMutation({
    mutationFn: () => setClientActive({ data: { id: client.id, isActive: false } }),
    onSuccess: async () => {
      toast(tx("Movido a Archivos", "Moved to Archive"));
      setAskOff(false);
      push({
        label: tx(`Archivar ${client.name}`, `Archive ${client.name}`),
        undo: async () => {
          await setClientActive({ data: { id: client.id, isActive: true } });
          await invalidateLawn(qc);
        },
        redo: async () => {
          await setClientActive({ data: { id: client.id, isActive: false } });
          await invalidateLawn(qc);
        },
      });
      await invalidateLawn(qc);
    },
  });
  const reactivate = useMutation({
    mutationFn: () => setClientActive({ data: { id: client.id, isActive: true } }),
    onSuccess: async () => {
      toast(tx("Cliente reactivado", "Client reactivated"));
      setAskOn(false);
      push({
        label: tx(`Reactivar ${client.name}`, `Reactivate ${client.name}`),
        undo: async () => {
          await setClientActive({ data: { id: client.id, isActive: false } });
          await invalidateLawn(qc);
        },
        redo: async () => {
          await setClientActive({ data: { id: client.id, isActive: true } });
          await invalidateLawn(qc);
        },
      });
      await invalidateLawn(qc);
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteClient({ data: { id: client.id } }),
    onSuccess: async () => {
      toast(tx("Cliente eliminado", "Client deleted"));
      setAskDel(false);
      await invalidateLawn(qc);
    },
  });

  return (
    <>
      <SwipeRow
        leftActions={
          <>
            {client.phone ? (
              <ConfirmLink
                href={telHref(client.phone)}
                kind="call"
                name={client.name}
                className="flex h-full flex-1 flex-col items-center justify-center gap-1 bg-done text-xs font-semibold text-primary-fg"
              >
                <Phone className="size-5" />
                {tx("Llamar", "Call")}
              </ConfirmLink>
            ) : (
              <span className="flex flex-1 flex-col items-center justify-center gap-1 bg-surface-2 text-xs font-semibold text-muted">
                {tx("Sin tel.", "No phone")}
              </span>
            )}
            {client.address ? (
              <ConfirmLink
                href={mapsHref(client.address)}
                kind="maps"
                name={client.name}
                label={tx("Abrir el mapa", "Open the map")}
                className="flex h-full flex-1 flex-col items-center justify-center gap-1 bg-money text-xs font-semibold text-primary-fg"
              >
                <MapPin className="size-5" aria-label={tx("Abrir el mapa", "Open the map")} />
              </ConfirmLink>
            ) : (
              <span className="flex flex-1 flex-col items-center justify-center gap-1 bg-surface-2 text-xs font-semibold text-muted">
                {tx("Sin dir.", "No address")}
              </span>
            )}
          </>
        }
        rightActions={
          <>
            {client.isActive ? (
              <button
                type="button"
                onClick={() => setAskOff(true)}
                className="flex flex-1 flex-col items-center justify-center gap-1 bg-pending text-xs font-semibold text-primary-fg"
              >
                <UserMinus className="size-5" />
                {tx("Baja", "Archive")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAskOn(true)}
                className="flex flex-1 flex-col items-center justify-center gap-1 bg-done text-xs font-semibold text-primary-fg"
              >
                <UserCheck className="size-5" />
                {tx("Alta", "Restore")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAskDel(true)}
              className="flex flex-1 flex-col items-center justify-center gap-1 bg-late text-xs font-semibold text-primary-fg"
            >
              <Trash2 className="size-5" />
              {tx("Borrar", "Delete")}
            </button>
          </>
        }
      >
        <article
          data-spot="lista-clientes ficha-deuda precio movimientos cambios-hechos"
          className={cn(
            "min-w-0 max-w-full overflow-hidden rounded-xl bg-surface shadow-card",
            quad ? meshFrame(cols) : dense ? "px-2 py-1.5" : media ? "p-2.5" : "p-4",
            client.overdueDate && "border-l-4 border-late bg-late-bg",
            !client.overdueDate && client.balance > 0 && "border-l-4 border-money",
            !client.overdueDate &&
              client.balance <= 0 &&
              client.kind === "one_time" &&
              "border-l-4 border-pending",
            !client.overdueDate &&
              client.balance <= 0 &&
              client.kind === "regular" &&
              "border-l-4 border-today",
            selected && "ring-2 ring-primary",
          )}
        >
          <div className="flex items-start gap-2">
            {selecting ? (
              <button
                type="button"
                aria-label={selected ? tx("Quitar de la selección", "Remove from selection") : tx("Seleccionar", "Select")}
                onClick={onToggle}
                className={cn(
                  "mt-0.5 grid size-11 shrink-0 place-items-center rounded-sm",
                  selected ? "bz-pick bz-pick-icon" : "bg-sun text-muted",
                )}
              >
                {selected ? <Check className="size-5" /> : null}
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-1">
                <Link to="/clientes/$id" params={{ id: String(client.id) }} className="min-w-0 flex-1 block">
                  <div className={cn("flex min-w-0", quad && cols >= 3 ? "flex-col items-stretch gap-0.5" : dense ? "items-center justify-between gap-2" : "items-start justify-between gap-2")}>
                    <div className={cn("min-w-0", quad && cols >= 3 ? "" : "flex-1")}>
                      {quad ? (
                        <MeshName name={client.name} cols={cols} />
                      ) : (
                      <p
                        className={cn(
                          "font-semibold leading-snug",
                          dense ? "truncate text-xs" : media ? "truncate text-sm" : "font-display text-lg",
                        )}
                      >
                        {client.name}
                      </p>
                      )}
                      {!dense && !media && !quad && client.cue ? <CueChip text={client.cue} className="mt-1" /> : null}
                      {!dense && (!quad || cols < 3) ? (
                        <p className={cn("truncate text-muted", quad || dense ? "text-[11px]" : media ? "text-xs" : "text-sm")}>
                          {client.kind === "one_time"
                            ? tx("Trabajo de una vez", "One-time job")
                            : `${frequencyLabel(client.cutsPerMonth, {
                                frequencyDays: client.frequencyDays,
                                weekday2: client.weekday2,
                              })} · ${weekdayLabel(client.weekday)}`}
                        </p>
                      ) : null}
                    </div>
                    {dense && client.balance > 0 && Math.round(client.balance * 100) !== Math.round(client.pricePerCut * 100) ? (
                      <p className="shrink-0 text-[11px] text-muted">
                        {tx("Debe", "Owes")} <span className="font-semibold tabular-nums text-due">{money(client.balance)}</span>
                      </p>
                    ) : null}
                    <p
                      className={cn(
                        "shrink-0 font-semibold tabular-nums",
                        quad && cols === 4 ? "text-xs" : quad || dense ? "text-xs" : media ? "text-sm" : "font-display text-lg",
                      )}
                    >
                      {money(client.pricePerCut)}
                    </p>
                    {quad && cols >= 3 && client.nextCutDate ? (
                      <p className="whitespace-nowrap text-[11px] leading-tight text-muted">{formatDay(client.nextCutDate, "d MMM")}</p>
                    ) : null}
                    {quad && cols === 4 && client.balance > 0 && Math.round(client.balance * 100) !== Math.round(client.pricePerCut * 100) ? (
                      <p className="truncate text-[11px] text-muted">
                        {tx("Debe", "Owes")} <span className="font-semibold tabular-nums text-due">{money(client.balance)}</span>
                      </p>
                    ) : null}
                  </div>
                </Link>
              </div>
              {!dense && !quad ? (
                <ContactIcons
                  phone={client.phone}
                  address={client.address}
                  name={client.name}
                  tight={media}
                  className="mt-2"
                />
              ) : null}
              {quad && cols < 4 ? (
                <ContactIcons
                  phone={client.phone}
                  address={client.address}
                  name={client.name}
                  tight
                  variant="some"
                  className="mt-1"
                />
              ) : null}
              {media && !quad && (client.balance > 0 || client.overdueDate || !client.isActive) ? (
                <p className="mt-1 truncate text-xs font-semibold">
                  {client.balance > 0 && Math.round(client.balance * 100) !== Math.round(client.pricePerCut * 100) ? `${tx("Por cobrar", "To collect")} ${money(client.balance)}` : ""}
                  {client.overdueDate ? ` · ${tx("Atrasado", "Late")}` : ""}
                  {!client.isActive ? ` · ${tx("Archivo", "Archive")}` : ""}
                </p>
              ) : null}
              {quad && cols === 2 && client.balance > 0 && Math.round(client.balance * 100) !== Math.round(client.pricePerCut * 100) ? (
                <p className="mt-1 truncate text-[11px] text-muted">
                  {tx("Debe", "Owes")} <span className="font-semibold text-due">{money(client.balance)}</span>
                </p>
              ) : null}
              {!dense && !media && !quad && (client.balance > 0 ||
                client.credit > 0 ||
                client.overdueDate ||
                client.tripleCut ||
                client.hasExtra ||
                client.highRisk ||
                client.payTier === "espera" ||
                client.blacklisted ||
                (!dense && client.paySameDay) ||
                (!dense && client.nextCutDate) ||
                !client.isActive) && (
                <Link
                  to="/clientes/$id"
                  params={{ id: String(client.id) }}
                  className={cn("flex flex-wrap items-center gap-2 text-sm", dense ? "mt-1.5" : "mt-3")}
                >
                  {client.balance > 0 && (
                    <span className="rounded-full bg-money-bg px-2.5 py-1 font-semibold text-money">
                      {tx("Por cobrar", "To collect")} {money(client.balance)}
                    </span>
                  )}
                  {client.credit > 0 && (
                    <span className="rounded-full bg-done-bg px-2.5 py-1 font-semibold text-done">
                      {tx("Adelanto", "Advance")} {money(client.credit)}
                    </span>
                  )}
                  {client.tripleCut && (
                    <span className="rounded-full bg-pending-bg px-2.5 py-1 font-semibold text-pending">
                      {tx(`${client.cutsThisMonth} cortes este mes`, `${client.cutsThisMonth} cuts this month`)}
                    </span>
                  )}
                  {client.hasExtra && (
                    <span className="rounded-full bg-money-bg px-2.5 py-1 font-semibold text-money">
                      Extra
                    </span>
                  )}
                  {client.payTier === "espera" && (
                    <span className="rounded-full bg-hold-bg px-2.5 py-1 font-semibold text-hold">
                      {tx("En espera", "Waiting")}
                    </span>
                  )}
                  {client.highRisk && (
                    <span className="rounded-full bg-hold px-2.5 py-1 font-semibold text-primary-fg">
                      {tx("Alto riesgo", "High risk")}
                    </span>
                  )}
                  {client.blacklisted && (
                    <span className="rounded-full bg-fg px-2.5 py-1 font-semibold text-bg">
                      {tx("Lista negra", "Blacklist")}
                    </span>
                  )}
                  {client.overdueDate && (
                    <span className="rounded-full bg-late px-2.5 py-1 font-semibold text-primary-fg">
                      {tx("Atrasado", "Late")}
                    </span>
                  )}
                  {client.paySameDay && !dense && (
                    <span className="rounded-full bg-done-bg px-2.5 py-1 font-semibold text-done">
                      {tx("Paga hoy", "Pays today")}
                    </span>
                  )}
                  {client.nextCutDate && !dense && (
                    <span className="text-muted">
                      {tx(`Próximo corte: ${client.nextCutDate.slice(5)}`, `Next cut: ${client.nextCutDate.slice(5)}`)}
                    </span>
                  )}
                  {!client.isActive && <span className="text-muted">{tx("En archivos", "In archive")}</span>}
                </Link>
              )}
            </div>
          </div>
        </article>
      </SwipeRow>

      <ConfirmDialog
        open={askOff}
        title={tx(`¿Pasar a archivos a ${client.name}?`, `Move ${client.name} to the archive?`)}
        description={tx(
          "Sale de la agenda. Queda guardado en Archivos con todos sus datos hasta que lo reactives o lo borres.",
          "They leave the schedule. They stay saved in Archive with all their data until you bring them back or delete them.",
        )}
        confirmLabel={tx("Mover a archivos", "Move to archive")}
        pending={deactivate.isPending}
        onConfirm={() => deactivate.mutate()}
        onCancel={() => setAskOff(false)}
      />
      <ConfirmDialog
        open={askOn}
        title={tx(`¿Reactivar a ${client.name}?`, `Reactivate ${client.name}?`)}
        description={tx("Vuelve a la agenda con su horario y su cuenta.", "They return to the schedule with their times and their account.")}
        confirmLabel={tx("Sí, reactivar", "Yes, reactivate")}
        pending={reactivate.isPending}
        onConfirm={() => reactivate.mutate()}
        onCancel={() => setAskOn(false)}
      />
      <ConfirmDialog
        open={askDel}
        title={tx(`¿Eliminar a ${client.name}?`, `Delete ${client.name}?`)}
        description={tx(
          "Se borra el cliente y todo su historial. Esta acción no se puede deshacer.",
          "The client and their whole history are deleted. This cannot be undone.",
        )}
        confirmLabel={tx("Eliminar", "Delete")}
        danger
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setAskDel(false)}
      />
    </>
  );
}
