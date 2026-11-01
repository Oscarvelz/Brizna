import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, Filter, FolderInput, NotebookPen, Pin, Plus, Settings, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AppShell, TitleSearch } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DensityScope, DensityToggle, useDensity, useQuadCols } from "@/components/density-toggle";
import { htmlToNote } from "@/components/rich-notes";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { addDaysISO, startOfWeekISO, todayISO } from "@/lib/dates";
import { formatDay } from "@/lib/format";
import { meshFrame, viewGrid, type Density, type QuadCols } from "@/lib/density";
import { useTx } from "@/lib/i18n";
import {
  readCabinet,
  readColorMode,
  readTrashDays,
  FOLDER_SWATCHES,
  UNSORTED_NAME,
  withLiveFolders,
  writeCabinet,
  writeColorMode,
  writeTrashDays,
  type CabinetFolder,
  type FolderDesign,
} from "@/lib/pad-cabinet";
import { dropPadFolder, getPad, savePad } from "@/lib/server/lawn";
import type { PadData, PadPage } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fichero")({
  validateSearch: (search: Record<string, unknown>): { carpeta?: string; vista?: "todo" } => {
    const carpeta = typeof search.carpeta === "string" ? search.carpeta.trim().slice(0, 40) : "";
    return {
      ...(carpeta ? { carpeta } : {}),
      ...(search.vista === "todo" ? { vista: "todo" as const } : {}),
    };
  },
  component: FicheroRoute,
});

function FicheroRoute() {
  return (
    <DensityScope scope="fichero">
      <FicheroPage />
    </DensityScope>
  );
}

type SortKey = "new" | "old" | "az" | "pinned";
type WhenKey = "all" | "today" | "week" | "month" | "range";

function FicheroPage() {
  const tx = useTx();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [trashDays, setTrashDays] = useState(30);
  const [findOn, setFindOn] = useState(false);
  const [needle, setNeedle] = useState("");
  const [gear, setGear] = useState(false);
  const [making, setMaking] = useState(false);
  const [cabinet, setCabinet] = useState<CabinetFolder[]>(() => readCabinet());
  const [colorMode, setColorMode] = useState<"theme" | "custom">(() => readColorMode());
  const density = useDensity();
  const cols = useQuadCols();
  const [sort, setSort] = useState<SortKey>("new");
  const [when, setWhen] = useState<WhenKey>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [onlyPin, setOnlyPin] = useState(false);
  const [onlyClient, setOnlyClient] = useState(false);
  const [folderFilter, setFolderFilter] = useState("");
  const [pinAsk, setPinAsk] = useState<{ page: PadPage; pinned: boolean } | null>(null);
  const [trashAsk, setTrashAsk] = useState<PadPage | null>(null);

  useEffect(() => {
    setTrashDays(readTrashDays());
  }, []);

  const q = useQuery({
    queryKey: ["pad", trashDays],
    queryFn: () => getPad({ data: { trashDays } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!q.data) return;
    const names = q.data.pages.map((page) => page.folder);
    setCabinet((current) => withLiveFolders(current, names));
  }, [q.data]);

  useEffect(() => {
    const days = readTrashDays();
    const cutoff = Date.now() - days * 86_400_000;
    const expired = readCabinet().filter((folder) => folder.trashedAt != null && folder.trashedAt < cutoff);
    if (expired.length === 0) return;
    void Promise.all(expired.map((folder) => dropPadFolder({ data: { name: folder.name } }))).then(() => {
      const left = readCabinet().filter((folder) => !expired.some((item) => item.id === folder.id));
      writeCabinet(left);
      setCabinet(left);
      void qc.invalidateQueries({ queryKey: ["pad"] });
    });
  }, [qc, trashDays]);

  const data = q.data;
  const live = (data?.pages ?? []).filter((page) => !page.deletedAt);
  const active = cabinet.filter((folder) => !folder.trashedAt);
  const unsorted = active.find((folder) => folder.id === "sin-especificar")?.name ?? UNSORTED_NAME;
  const vista = search.vista === "todo";
  const carpeta = !vista ? search.carpeta : undefined;
  const title = vista ? tx("Ver todo", "See all") : carpeta || tx("Fichero", "Cabinet");
  const query = findOn ? needle.trim().toLowerCase() : "";

  function openBloc(back: string) {
    void navigate({ to: "/notas", search: { back } });
  }

  async function addNote() {
    if (making) return;
    const folder = carpeta || unsorted;
    const back = vista ? "todo" : carpeta ? `c:${encodeURIComponent(carpeta)}` : "home";
    setMaking(true);
    try {
      void navigate({ to: "/notas", search: { nueva: folder, back } });
    } catch {
      toast.error(tx("No se pudo crear la nota", "Could not create the note"));
    } finally {
      setMaking(false);
    }
  }

  function remember(next: CabinetFolder[]) {
    setCabinet(next);
    writeCabinet(next);
  }

  function homeOf(page: PadPage) {
    return page.folder || unsorted;
  }

  function matchesWhen(page: PadPage) {
    const day = (page.createdAt || page.updatedAt || "").slice(0, 10);
    if (when === "all") return true;
    if (!day) return false;
    const today = todayISO();
    if (when === "today") return day === today;
    if (when === "week") {
      const start = startOfWeekISO(today);
      return day >= start && day <= addDaysISO(start, 6);
    }
    if (when === "month") return day.slice(0, 7) === today.slice(0, 7);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  }

  function matchesText(page: PadPage) {
    if (!query) return true;
    const blob = `${page.title} ${htmlToNote(page.body)} ${homeOf(page)}`.toLowerCase();
    return blob.includes(query);
  }

  function prepared(list: PadPage[]) {
    return sortNotes(
      list.filter((page) => {
        if (!matchesWhen(page) || !matchesText(page)) return false;
        if (onlyPin && !page.pinned) return false;
        if (onlyClient && page.clientIds.length === 0) return false;
        if (vista && folderFilter && homeOf(page) !== folderFilter) return false;
        return true;
      }),
      sort,
    );
  }

  function askPin(page: PadPage) {
    setPinAsk({ page, pinned: !page.pinned });
  }

  async function setNotePin(page: PadPage, pinned: boolean) {
    qc.setQueriesData<PadData>({ queryKey: ["pad"] }, (old) =>
      old ? { ...old, pages: old.pages.map((item) => (item.id === page.id ? { ...item, pinned } : item)) } : old,
    );
    try {
      await savePad({ data: { pageId: page.id, pinned } });
      toast(pinned ? tx("Nota fijada", "Note pinned") : tx("Ya no está fijada", "Unpinned"));
      await qc.invalidateQueries({ queryKey: ["pad"] });
      await qc.invalidateQueries({ queryKey: ["pad-pins"] });
    } catch {
      await qc.invalidateQueries({ queryKey: ["pad"] });
      toast.error(tx("No se pudo fijar la nota", "Could not pin the note"));
    }
  }

  async function trashNote(page: PadPage) {
    try {
      await savePad({ data: { pageId: page.id, trashed: true } });
      toast(tx("Nota en la papelera", "Note moved to trash"));
      await qc.invalidateQueries({ queryKey: ["pad"] });
    } catch {
      toast.error(tx("No se pudo borrar la nota", "Could not delete the note"));
    }
  }

  async function move(page: PadPage, folder: string) {
    if (!folder || folder === homeOf(page)) return;
    try {
      await savePad({ data: { pageId: page.id, folder } });
      toast.success(tx(`Movida a ${folder}`, `Moved to ${folder}`));
      await qc.invalidateQueries({ queryKey: ["pad"] });
    } catch {
      toast.error(tx("No se pudo mover", "Could not move it"));
    }
  }

  function edit(page: PadPage, writing = false) {
    const back = vista ? "todo" : carpeta ? `c:${encodeURIComponent(carpeta)}` : "home";
    void navigate({
      to: "/notas",
      search: { page: page.id, back, ...(writing ? { editar: "1" as const } : {}) },
    });
  }

  const inside = carpeta
    ? prepared(live.filter((page) => homeOf(page) === carpeta))
    : [];
  const allNotes = vista ? prepared(live) : [];

  return (
    <AppShell
      title={title}
      action={
        <div className="flex items-center">
          <TitleSearch
            open={findOn}
            onToggle={() => setFindOn((value) => !value)}
            value={needle}
            onChange={setNeedle}
            placeholder={tx("Buscar carpeta o nota", "Search a folder or note")}
            label={tx("Buscar en el Fichero", "Search the cabinet")}
          />
          <button
            type="button"
            aria-label={tx("Ajustes de carpetas", "Folder settings")}
            onClick={() => setGear(true)}
            className="grid size-10 shrink-0 place-items-center rounded-full text-fg"
          >
            <Settings className="size-5" />
          </button>
        </div>
      }
    >
      {carpeta || vista ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void navigate({ to: "/fichero" })}
            className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-muted"
          >
            <ChevronLeft className="size-4" />
            {tx("Fichero", "Cabinet")}
          </button>
          <BlocButton onClick={() => openBloc(vista ? "todo" : `c:${encodeURIComponent(carpeta ?? "")}`)} />
        </div>
      ) : null}

      <ViewTools
        beside={
          !carpeta && !vista ? (
            <BlocButton onClick={() => openBloc("home")} />
          ) : undefined
        }
        sort={sort}
        onSort={setSort}
        when={when}
        onWhen={setWhen}
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
        folders={!carpeta && !vista}
        vista={vista}
        active={active}
        folderFilter={folderFilter}
        onFolder={setFolderFilter}
        onlyPin={onlyPin}
        onPin={() => setOnlyPin((value) => !value)}
        onlyClient={onlyClient}
        onClient={() => setOnlyClient((value) => !value)}
        onVista={() =>
          void navigate({
            to: "/fichero",
            search: vista ? {} : { vista: "todo" },
          })
        }
      />

      {q.isLoading || !data ? <div className="h-40 animate-pulse rounded-xl bg-surface-2" /> : null}

      {data && !carpeta && !vista ? (
        <>
          {prepared(live).some((page) => page.pinned) ? (
          <div className="mb-3">
          <NoteList
            notes={[...prepared(live)].filter((page) => page.pinned).sort((a, b) => Number(b.pinned) - Number(a.pinned))}
            density={density}
            cols={cols}
            showFolder
            folders={active}
            unsorted={unsorted}
            clients={data.clients}
            homeOf={homeOf}
            colorMode={colorMode}
            onEdit={edit}
            onPin={askPin}
            onTrash={setTrashAsk}
            onMove={(page, folder) => void move(page, folder)}
          />
          </div>
          ) : null}
          <FolderGrid
            folders={sortFolders(active, live, unsorted, sort, query)}
            notes={live}
            unsorted={unsorted}
            density={density}
            cols={cols}
            colorMode={colorMode}
            whenOn={when !== "all"}
            matches={(page) => matchesWhen(page) && matchesText(page)}
            onOpen={(name) => void navigate({ to: "/fichero", search: { carpeta: name } })}
          />
        </>
      ) : null}

      {data && (carpeta || vista) ? (
        <NoteList
          notes={carpeta ? inside : allNotes}
          density={density}
          cols={cols}
          showFolder={vista}
          folders={active}
          unsorted={unsorted}
          clients={data.clients}
          homeOf={homeOf}
          colorMode={colorMode}
          onEdit={edit}
          onPin={askPin}
          onTrash={setTrashAsk}
          onMove={(page, folder) => void move(page, folder)}
        />
      ) : null}
      <ConfirmDialog
        front
        open={pinAsk != null}
        title={
          pinAsk?.pinned
            ? tx("¿Fijar esta nota?", "Pin this note?")
            : tx("¿Quitar esta nota de fijadas?", "Unpin this note?")
        }
        description={
          pinAsk?.pinned
            ? tx(
                `${pinAsk.page.title || "La nota"} queda fijada en Hoy y en el bloc. No se borra ni se mueve.`,
                `${pinAsk.page.title || "The note"} stays pinned on Today and in the notepad. It is not deleted or moved.`,
              )
            : tx(
                `${pinAsk?.page.title || "La nota"} deja de estar fijada. Sigue en el bloc y no se borra.`,
                `${pinAsk?.page.title || "The note"} is no longer pinned. It stays in the notepad and is not deleted.`,
              )
        }
        confirmLabel={pinAsk?.pinned ? tx("Sí, fijar", "Yes, pin") : tx("Sí, quitar", "Yes, unpin")}
        onConfirm={() => {
          const next = pinAsk;
          setPinAsk(null);
          if (next) void setNotePin(next.page, next.pinned);
        }}
        onCancel={() => setPinAsk(null)}
      />
      <ConfirmDialog
        front
        open={trashAsk != null}
        title={tx("¿Mandar esta nota a la papelera?", "Move this note to the trash?")}
        description={tx(
          `${trashAsk?.title || "La nota"} sale del fichero. Se borra del todo cuando pase el tiempo que elegiste.`,
          `${trashAsk?.title || "The note"} leaves the cabinet. It is deleted for good after the time you chose.`,
        )}
        confirmLabel={tx("Sí, a la papelera", "Yes, trash it")}
        danger
        onConfirm={() => {
          const next = trashAsk;
          setTrashAsk(null);
          if (next) void trashNote(next);
        }}
        onCancel={() => setTrashAsk(null)}
      />

      <button
        type="button"
        disabled={making}
        onClick={() => void addNote()}
        className="fixed right-4 bottom-[calc(5.25rem+var(--bz-chin))] z-20 grid size-14 place-items-center rounded-full bg-primary text-primary-fg shadow-card disabled:opacity-60 md:bottom-6"
        aria-label={carpeta ? tx("Nueva nota en esta carpeta", "New note in this folder") : tx("Nueva nota", "New note")}
      >
        <Plus className="size-6" />
      </button>
      {gear ? (
        <GearSheet
          cabinet={cabinet}
          colorMode={colorMode}
          trashDays={trashDays}
          pages={data?.pages ?? []}
          onColor={(mode) => {
            setColorMode(mode);
            writeColorMode(mode);
          }}
          onDays={(days) => {
            writeTrashDays(days);
            setTrashDays(days);
          }}
          onCabinet={remember}
          onClose={() => setGear(false)}
          onRefresh={async () => {
            await qc.invalidateQueries({ queryKey: ["pad"] });
          }}
        />
      ) : null}
    </AppShell>
  );
}

function stamp(page: PadPage) {
  return page.createdAt || page.updatedAt || "";
}

function sortNotes(list: PadPage[], sort: SortKey) {
  const copy = [...list];
  if (sort === "az") copy.sort((a, b) => (a.title || "Nota").localeCompare(b.title || "Nota", "es"));
  else if (sort === "old") copy.sort((a, b) => stamp(a).localeCompare(stamp(b)) || a.id - b.id);
  else if (sort === "pinned") copy.sort((a, b) => Number(b.pinned) - Number(a.pinned) || stamp(b).localeCompare(stamp(a)));
  else copy.sort((a, b) => stamp(b).localeCompare(stamp(a)) || b.id - a.id);
  return copy;
}

function sortFolders(folders: CabinetFolder[], notes: PadPage[], unsorted: string, sort: SortKey, query: string) {
  const owned = (folder: CabinetFolder) =>
    notes.filter((page) => (page.folder || unsorted) === folder.name);
  const copy = folders.filter((folder) => {
    if (!query) return true;
    if (folder.name.toLowerCase().includes(query)) return true;
    return owned(folder).some((page) => `${page.title} ${htmlToNote(page.body)}`.toLowerCase().includes(query));
  });
  copy.sort((a, b) => {
    const an = owned(a);
    const bn = owned(b);
    if (sort === "az") return a.name.localeCompare(b.name, "es");
    if (sort === "pinned") return bn.length - an.length || a.name.localeCompare(b.name, "es");
    const latest = (list: PadPage[]) => list.reduce((max, page) => (stamp(page) > max ? stamp(page) : max), "");
    const oldest = (list: PadPage[]) => list.reduce((min, page) => (!min || (stamp(page) && stamp(page) < min) ? stamp(page) : min), "");
    if (sort === "old") return oldest(an).localeCompare(oldest(bn)) || a.name.localeCompare(b.name, "es");
    return latest(bn).localeCompare(latest(an)) || a.name.localeCompare(b.name, "es");
  });
  return copy;
}

function BlocButton({ onClick }: { onClick: () => void }) {
  const tx = useTx();
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-12 min-w-0 max-w-full items-center gap-2 rounded-full bg-primary pr-4 pl-2 font-display text-sm font-semibold text-primary-fg shadow-card"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-fg/15">
        <NotebookPen className="size-4" />
      </span>
      <span className="truncate">{tx("Bloc", "Pad")}</span>
    </button>
  );
}

function ViewTools({
  sort,
  onSort,
  when,
  onWhen,
  from,
  to,
  onFrom,
  onTo,
  folders,
  vista,
  active,
  folderFilter,
  onFolder,
  onlyPin,
  onPin,
  onlyClient,
  onClient,
  onVista,
  beside,
}: {
  sort: SortKey;
  onSort: (value: SortKey) => void;
  when: WhenKey;
  onWhen: (value: WhenKey) => void;
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  folders?: boolean;
  vista: boolean;
  active: CabinetFolder[];
  folderFilter: string;
  onFolder: (value: string) => void;
  onlyPin: boolean;
  onPin: () => void;
  onlyClient: boolean;
  onClient: () => void;
  onVista: () => void;
  beside?: ReactNode;
}) {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  const sorts: { value: SortKey; label: string }[] = [
    { value: "new", label: tx("Nuevas", "Newest") },
    { value: "old", label: tx("Viejas", "Oldest") },
    { value: "az", label: "A–Z" },
    { value: "pinned", label: folders ? tx("Más notas", "Most notes") : tx("Fijadas", "Pinned") },
  ];
  const whens: { value: WhenKey; label: string }[] = [
    { value: "all", label: tx("Todas", "All") },
    { value: "today", label: tx("Hoy", "Today") },
    { value: "week", label: tx("Semana", "Week") },
    { value: "month", label: tx("Mes", "Month") },
    { value: "range", label: tx("Fechas", "Dates") },
  ];
  return (
    <div className="mb-3 grid gap-2">
      <div className="flex items-center justify-between gap-2">
        {beside ? <div className="min-w-0">{beside}</div> : <span className="min-w-0" />}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <label className="inline-flex h-12 items-center gap-2 rounded-full bg-surface px-3 text-sm font-semibold shadow-card">
            <input type="checkbox" className="size-4 accent-primary" checked={vista} onChange={onVista} />
            {tx("Ver todo", "See all")}
          </label>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold shadow-card"
          >
            <Filter className="size-4" />
            {tx("Filtros", "Filters")}
          </button>
        </div>
      </div>
      {open ? (
          <div className="mt-2 grid gap-3 rounded-xl bg-surface p-3 shadow-card">
            <div>
              <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{tx("Orden", "Order")}</p>
              <div className="flex flex-wrap gap-1.5">
                {sorts.map((item) => (
                  <FilterChip key={item.value} on={sort === item.value} onClick={() => onSort(item.value)}>
                    {item.label}
                  </FilterChip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{tx("Fecha", "Date")}</p>
              <div className="flex flex-wrap gap-1.5">
                {whens.map((item) => (
                  <FilterChip key={item.value} on={when === item.value} onClick={() => onWhen(item.value)}>
                    {item.label}
                  </FilterChip>
                ))}
              </div>
            </div>
            {when === "range" ? (
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} aria-label={tx("Desde", "From")} />
                <Input type="date" value={to} onChange={(e) => onTo(e.target.value)} aria-label={tx("Hasta", "To")} />
              </div>
            ) : null}
            {vista ? (
              <div className="grid gap-2">
                <NativeSelect
                  value={folderFilter}
                  onChange={(e) => onFolder(e.target.value)}
                  className="bg-bg"
                  aria-label={tx("Filtrar por carpeta", "Filter by folder")}
                >
                  <option value="">{tx("Todas las carpetas", "All folders")}</option>
                  {active.map((folder) => (
                    <option key={folder.id} value={folder.name}>
                      {folder.name}
                    </option>
                  ))}
                </NativeSelect>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip on={onlyPin} onClick={onPin}>
                    {tx("Solo fijadas", "Pinned only")}
                  </FilterChip>
                  <FilterChip on={onlyClient} onClick={onClient}>
                    {tx("Con cliente", "With a client")}
                  </FilterChip>
                </div>
              </div>
            ) : null}
          </div>
      ) : null}
      <DensityToggle />
    </div>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-3 text-xs font-semibold",
        on ? "bg-primary text-primary-fg" : "bg-bg text-muted",
      )}
    >
      {children}
    </button>
  );
}

function markStyle(design: FolderDesign, color: string | undefined, keepDefaultBar: boolean): { className: string; style?: CSSProperties; dot: boolean; ink?: string; title?: CSSProperties } {
  if (design === "plain") return { className: keepDefaultBar ? "border-l-4 border-primary" : "", dot: false, ink: color, title: color ? { color } : undefined };
  if (!color && design === "bar" && keepDefaultBar) return { className: "border-l-4 border-primary", dot: false };
  const ink = color || "var(--color-primary)";
  if (design === "halo") {
    return {
      className: "",
      style: {
        boxShadow: `0 0 0 1px color-mix(in srgb, ${ink} 42%, transparent), 0 0 26px color-mix(in srgb, ${ink} 55%, transparent)`,
      },
      dot: false,
    };
  }
  if (design === "neon") {
    return {
      className: "",
      style: {
        boxShadow: `inset 0 0 0 1.5px ${ink}, 0 0 10px ${ink}, 0 0 28px color-mix(in srgb, ${ink} 78%, transparent)`,
      },
      title: { color: ink, textShadow: `0 0 8px color-mix(in srgb, ${ink} 85%, transparent)` },
      dot: false,
    };
  }
  if (design === "top") return { className: "border-t-4", style: { borderTopColor: ink }, dot: false };
  if (design === "wash") {
    return {
      className: "",
      style: {
        backgroundColor: `color-mix(in srgb, ${ink} 18%, var(--color-surface))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${ink} 42%, transparent)`,
      },
      dot: false,
    };
  }
  if (design === "ring") return { className: "", style: { boxShadow: `inset 0 0 0 2px ${ink}` }, dot: false };
  if (design === "dot") return { className: keepDefaultBar ? "" : "", dot: true, ink };
  return { className: "border-l-4", style: color ? { borderLeftColor: color } : { borderLeftColor: ink }, dot: false };
}

function ficheroGrid(density: Density, cols: QuadCols) {
  if (density === "quad") return viewGrid(density, cols);
  return cn("grid", density === "dense" ? "gap-1" : "gap-2");
}

function FolderGrid({
  folders,
  notes,
  unsorted,
  density,
  cols,
  colorMode,
  whenOn,
  matches,
  onOpen,
}: {
  folders: CabinetFolder[];
  notes: PadPage[];
  unsorted: string;
  density: Density;
  cols: QuadCols;
  colorMode: "theme" | "custom";
  whenOn: boolean;
  matches: (page: PadPage) => boolean;
  onOpen: (name: string) => void;
}) {
  const tx = useTx();
  const visible = folders.filter((folder) => {
    const owned = notes.filter((page) => (page.folder || unsorted) === folder.name);
    if (whenOn && !owned.some(matches)) return false;
    return true;
  });
  if (visible.length === 0) {
    return <p className="rounded-xl bg-sun px-4 py-5 text-sm text-muted">{tx("Ninguna carpeta con eso.", "No folder matches that.")}</p>;
  }
  return (
    <ul className={ficheroGrid(density, cols)}>
      {visible.map((folder) => {
        const owned = notes.filter((page) => (page.folder || unsorted) === folder.name);
        const tint = colorMode === "custom" && folder.color ? folder.color : undefined;
        const design = folder.design || "bar";
        const mark = markStyle(design, tint, !tint && design === "bar");
        const latest = [...owned].sort((a, b) => stamp(b).localeCompare(stamp(a)))[0];
        return (
          <li key={folder.id}>
            <button
              type="button"
              onClick={() => onOpen(folder.name)}
              className={cn(
                "h-full w-full min-w-0 rounded-xl bg-surface text-left shadow-card",
                mark.className,
                density === "quad" ? meshFrame(cols) : density === "dense" ? "px-2 py-1.5" : density === "compact" ? "px-3 py-2" : "px-3 py-3",
              )}
              style={mark.style}
            >
              <span className={cn("flex gap-1", density === "quad" ? "flex-col items-start" : "items-center justify-between")}>
                <span className={cn("flex min-w-0 items-center gap-1.5 font-semibold", density === "quad" || density === "dense" ? "text-xs" : "font-display text-base")} style={mark.title}>
                  {mark.dot ? <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: mark.ink || "var(--color-primary)" }} /> : null}
                  <span className="truncate">{folder.name}</span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-muted">
                  {owned.length} {owned.length === 1 ? tx("nota", "note") : tx("notas", "notes")}
                </span>
              </span>
              {density !== "dense" && density !== "quad" && latest ? (
                <span className="mt-0.5 block truncate text-xs text-muted">
                  {latest.title || tx("Nota", "Note")}
                  {density === "full" && latest.createdAt ? ` · ${formatDay(latest.createdAt.slice(0, 10), "d MMM")}` : ""}
                </span>
              ) : null}
              {density === "quad" && cols < 4 && latest ? (
                <span className="mt-0.5 block truncate text-[11px] text-muted">{latest.title || tx("Nota", "Note")}</span>
              ) : null}
              {density === "full" ? (
                <span className="mt-1 line-clamp-2 max-h-12 overflow-hidden text-sm text-muted">
                  {htmlToNote(latest?.body ?? "") || tx("Todavía vacía.", "Still empty.")}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SwipeCard({
  children,
  className,
  style,
  onMove,
  onTrash,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onMove: () => void;
  onTrash: () => void;
}) {
  const tx = useTx();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; lock: boolean | null } | null>(null);
  const moved = useRef(false);
  const dxRef = useRef(0);

  function end(e: ReactPointerEvent<HTMLDivElement>) {
    if (start.current?.lock) {
      if (dxRef.current >= 72) onMove();
      else if (dxRef.current <= -72) onTrash();
    }
    start.current = null;
    setDragging(false);
    dxRef.current = 0;
    setDx(0);
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl" data-no-swipe>
      <div className="pointer-events-none absolute inset-0 flex">
        <div className="flex w-1/2 items-center gap-2 bg-soil-bg pl-3 text-soil">
          <FolderInput className="size-4" />
          <span className="text-xs font-semibold">{tx("Mover", "Move")}</span>
        </div>
        <div className="flex w-1/2 items-center justify-end gap-2 bg-late-bg pr-3 text-late">
          <span className="text-xs font-semibold">{tx("Papelera", "Trash")}</span>
          <Trash2 className="size-4" />
        </div>
      </div>
      <div
        className={cn("relative", className)}
        style={{
          ...style,
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 180ms ease",
          touchAction: "pan-y",
        }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("select, input, label, [data-swipe-ignore]")) return;
          moved.current = false;
          start.current = { x: e.clientX, y: e.clientY, lock: null };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const origin = start.current;
          if (!origin) return;
          const x = e.clientX - origin.x;
          const y = e.clientY - origin.y;
          if (origin.lock == null) {
            if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
            origin.lock = Math.abs(x) > Math.abs(y);
            if (!origin.lock) {
              start.current = null;
              return;
            }
            setDragging(true);
          }
          moved.current = true;
          const next = Math.max(-104, Math.min(104, x));
          dxRef.current = next;
          setDx(next);
        }}
        onPointerUp={end}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          dxRef.current = 0;
          setDx(0);
        }}
        onClickCapture={(e) => {
          if (!moved.current) return;
          moved.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>
  );
}

function NoteList({
  notes,
  density,
  cols,
  showFolder,
  folders,
  unsorted,
  clients,
  homeOf,
  colorMode,
  onEdit,
  onPin,
  onTrash,
  onMove,
}: {
  notes: PadPage[];
  density: Density;
  cols: QuadCols;
  showFolder: boolean;
  folders: CabinetFolder[];
  unsorted: string;
  clients: { id: number; name: string }[];
  homeOf: (page: PadPage) => string;
  colorMode: "theme" | "custom";
  onEdit: (page: PadPage, writing?: boolean) => void;
  onPin: (page: PadPage) => void;
  onTrash: (page: PadPage) => void;
  onMove: (page: PadPage, folder: string) => void;
}) {
  const tx = useTx();
  const tap = useRef<{ id: number; at: number; timer: number } | null>(null);
  const [moveFor, setMoveFor] = useState<PadPage | null>(null);
  function pressNote(page: PadPage) {
    const now = Date.now();
    if (tap.current && tap.current.id === page.id && now - tap.current.at < 320) {
      window.clearTimeout(tap.current.timer);
      tap.current = null;
      onEdit(page, true);
      return;
    }
    const timer = window.setTimeout(() => {
      tap.current = null;
      onEdit(page, false);
    }, 320);
    tap.current = { id: page.id, at: now, timer };
  }
  if (notes.length === 0) {
    return <p className="rounded-xl bg-sun px-4 py-5 text-sm text-muted">{tx("Ninguna nota con ese filtro.", "No note matches that filter.")}</p>;
  }
  return (
    <>
    <ul className={ficheroGrid(density, cols)}>
      {notes.map((page) => {
        const day = (page.createdAt || page.updatedAt || "").slice(0, 10);
        const people = page.clientIds
          .map((id) => clients.find((client) => client.id === id)?.name)
          .filter(Boolean)
          .join(", ");
        const home = folders.find((folder) => folder.name === homeOf(page));
        const noteTint = colorMode === "custom" ? home?.noteColor || "" : "";
        const noteDesign = home?.noteDesign;
        const noteMark = noteTint || noteDesign ? markStyle(noteDesign || "bar", noteTint || undefined, false) : null;
        return (
          <li key={page.id} className="min-w-0">
            <SwipeCard
              className={cn(
                "min-w-0 rounded-xl bg-surface shadow-card",
                noteMark?.className,
                density === "quad" ? meshFrame(cols) : density === "dense" ? "px-2 py-1.5" : density === "compact" ? "px-3 py-2" : "px-3 py-3",
              )}
              style={noteMark?.style}
              onMove={() => setMoveFor(page)}
              onTrash={() => onTrash(page)}
            >
            <div className={cn(density === "quad" ? "grid gap-1" : "flex items-start justify-between gap-2")}>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <button type="button" onClick={() => pressNote(page)} className={cn("min-w-0 truncate text-left font-semibold", density === "quad" || density === "dense" ? "text-xs" : "text-base")} style={noteMark?.title}>
                    {noteMark?.dot ? <span className="mr-1.5 inline-block size-2.5 rounded-full align-middle" style={{ backgroundColor: noteMark.ink || noteTint || "var(--color-primary)" }} /> : null}
                    {page.title || tx("Nota", "Note")}
                  </button>
                </div>
                <button type="button" onClick={() => pressNote(page)} className="w-full text-left">
                {density !== "dense" && density !== "quad" ? (
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {day ? formatDay(day, "d MMM yyyy") : ""}
                    {showFolder ? ` · ${homeOf(page)}` : ""}
                    {people ? ` · @${people}` : ""}
                  </span>
                ) : null}
                {density === "quad" && cols < 4 ? (
                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                    {day ? formatDay(day, "d MMM") : ""}
                    {people ? ` · @${people}` : ""}
                  </span>
                ) : null}
                {density === "full" ? (
                  <span className="mt-1 line-clamp-4 max-h-24 overflow-hidden text-sm leading-snug text-muted">
                    {htmlToNote(page.body) || tx("Sin texto.", "No text.")}
                  </span>
                ) : null}
                </button>
              </div>
              <button
                type="button"
                aria-pressed={page.pinned}
                aria-label={page.pinned ? tx("Quitar nota fijada", "Unpin note") : tx("Fijar nota", "Pin note")}
                data-swipe-ignore=""
                onClick={() => onPin(page)}
                className={cn(
                  "grid shrink-0 place-items-center rounded-full",
                  density === "quad" || density === "dense" ? "size-8" : "size-10",
                  page.pinned ? "bg-soil text-primary-fg" : "bg-bg text-fg ring-1 ring-border",
                )}
              >
                <Pin className={cn("size-4", page.pinned && "fill-current")} />
              </button>
            </div>
            </SwipeCard>
          </li>
        );
      })}
    </ul>
    {moveFor ? (
      <div className="fixed inset-0 z-[80] grid place-items-end p-3 sm:place-items-center">
        <button type="button" className="absolute inset-0 bz-scrim" aria-label={tx("Cerrar", "Close")} onClick={() => setMoveFor(null)} />
        <div className="relative w-full max-w-md rounded-xl bg-surface p-4 shadow-card">
          <p className="font-display text-lg font-semibold">{tx("Mover a una carpeta", "Move to a folder")}</p>
          <div className="mt-3 grid max-h-[50dvh] gap-2 overflow-auto">
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => {
                  onMove(moveFor, folder.name);
                  setMoveFor(null);
                }}
                className={cn(
                  "h-11 rounded-md px-3 text-left text-sm font-semibold",
                  homeOf(moveFor) === folder.name ? "bg-primary text-primary-fg" : "bg-bg text-fg",
                )}
              >
                {folder.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

function LookChip({ label, name, color, design }: { label: string; name: string; color: string; design: FolderDesign }) {
  const tint = color || undefined;
  const mark = markStyle(design, tint, !tint && design === "bar");
  return (
    <div className={cn("min-w-0 flex-1 rounded-lg bg-bg px-2 py-1.5", mark.className)} style={mark.style}>
      <p className="text-[10px] font-semibold text-muted">{label}</p>
      <p className="truncate text-xs font-semibold" style={mark.title}>
        {mark.dot ? <span className="mr-1 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: mark.ink || "var(--color-primary)" }} /> : null}
        {name}
      </p>
    </div>
  );
}

function FolderTune({
  folder,
  colorMode,
  onRename,
  onTrash,
  onPaint,
}: {
  folder: CabinetFolder;
  colorMode: "theme" | "custom";
  onRename: (name: string) => void;
  onTrash: () => void;
  onPaint: (patch: Partial<CabinetFolder>) => void;
}) {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  const folderColor = colorMode === "custom" ? folder.color : "";
  const noteColor = colorMode === "custom" ? folder.noteColor || "" : "";
  return (
    <li className="min-w-0 max-w-full overflow-hidden rounded-2xl bg-surface shadow-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center gap-2 px-3 text-left"
      >
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition", open && "rotate-180")} />
        <span className="min-w-0 flex-1 truncate font-semibold">{folder.name}</span>
      </button>
      <div className="flex min-w-0 gap-2 px-3 pb-3">
        <LookChip label={tx("Carpeta", "Folder")} name={folder.name} color={folderColor} design={folder.design || "bar"} />
        <LookChip label={tx("Nota", "Note")} name={tx("Nota", "Note")} color={noteColor} design={folder.noteDesign || "bar"} />
      </div>
      {open ? (
        <div className="min-w-0 max-w-full px-3 pb-3">
          <div className="flex items-center gap-2">
            <Input
              key={`${folder.id}:${folder.name}`}
              defaultValue={folder.name}
              aria-label={tx("Nombre de la carpeta", "Folder name")}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (!next || next === folder.name) {
                  e.target.value = folder.name;
                  return;
                }
                onRename(next);
              }}
              className="h-11 min-w-0 flex-1 bg-bg"
            />
            <button type="button" className="shrink-0 px-1 text-xs font-semibold text-late" onClick={onTrash}>
              {tx("Borrar", "Delete")}
            </button>
          </div>
          <StylePick
            label={tx("Carpeta", "Folder")}
            color={folder.color}
            design={folder.design || "bar"}
            onColor={(color) => onPaint({ color, design: folder.design || "bar" })}
            onDesign={(design) => onPaint({ design, color: folder.color || FOLDER_SWATCHES[0] })}
          />
          <StylePick
            label={tx("Notas de esta carpeta", "Notes in this folder")}
            color={folder.noteColor || ""}
            design={folder.noteDesign || "bar"}
            onColor={(noteColor) => onPaint({ noteColor, noteDesign: folder.noteDesign || "bar" })}
            onDesign={(noteDesign) => onPaint({ noteDesign, noteColor: folder.noteColor || folder.color || FOLDER_SWATCHES[0] })}
          />
        </div>
      ) : null}
    </li>
  );
}

function StylePick({
  label,
  color,
  design,
  onColor,
  onDesign,
}: {
  label: string;
  color: string;
  design: FolderDesign;
  onColor: (color: string) => void;
  onDesign: (design: FolderDesign) => void;
}) {
  const tx = useTx();
  const designs: { id: FolderDesign; label: string }[] = [
    { id: "bar", label: tx("Barra", "Bar") },
    { id: "top", label: tx("Franja", "Stripe") },
    { id: "wash", label: tx("Tinte", "Tint") },
    { id: "dot", label: tx("Punto", "Dot") },
    { id: "ring", label: tx("Aro", "Ring") },
    { id: "plain", label: tx("Nombre", "Name") },
    { id: "halo", label: tx("Halo", "Halo") },
    { id: "neon", label: tx("Neón", "Neon") },
  ];
  return (
    <div className="mt-3 min-w-0 max-w-full border-t border-border/70 pt-3">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <div className="mt-2 flex min-w-0 max-w-full flex-wrap items-center gap-2">
        {FOLDER_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={swatch}
            aria-pressed={color.toLowerCase() === swatch}
            onClick={() => onColor(swatch)}
            className={cn(
              "size-8 rounded-full ring-1 ring-black/10",
              color.toLowerCase() === swatch && "ring-2 ring-fg",
            )}
            style={{ backgroundColor: swatch }}
          />
        ))}
        <label className="relative size-8 overflow-hidden rounded-full ring-1 ring-border" title={tx("Otro color", "Other color")}>
          <input
            type="color"
            aria-label={tx("Otro color", "Other color")}
            value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#1f6a3a"}
            onChange={(e) => onColor(e.target.value)}
            className="absolute -inset-1 size-10 cursor-pointer border-0 p-0"
          />
        </label>
      </div>
      <div className="mt-2.5 flex min-w-0 max-w-full flex-wrap gap-1.5">
        {designs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onDesign(item.id)}
            className={cn(
              "h-8 rounded-full px-3 text-xs font-semibold",
              design === item.id ? "bg-primary text-primary-fg" : "bg-bg text-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function GearSheet({
  cabinet,
  colorMode,
  trashDays,
  pages,
  onColor,
  onDays,
  onCabinet,
  onClose,
  onRefresh,
}: {
  cabinet: CabinetFolder[];
  colorMode: "theme" | "custom";
  trashDays: number;
  pages: PadPage[];
  onColor: (mode: "theme" | "custom") => void;
  onDays: (days: number) => void;
  onCabinet: (next: CabinetFolder[]) => void;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const tx = useTx();
  const [draft, setDraft] = useState("");
  const active = cabinet.filter((folder) => !folder.trashedAt);
  const trashed = cabinet.filter((folder) => folder.trashedAt);
  if (typeof document === "undefined") return null;

  function addFolder() {
    const name = draft.trim().slice(0, 40);
    if (!name) return;
    if (cabinet.some((folder) => folder.name.toLowerCase() === name.toLowerCase())) {
      toast.error(tx("Ya hay una carpeta con ese nombre", "A folder already has that name"));
      return;
    }
    onCabinet([...cabinet, { id: `new-${Date.now()}`, name, color: "", trashedAt: null }]);
    setDraft("");
  }

  async function rename(folder: CabinetFolder, name: string) {
    const nextName = name.trim().slice(0, 40);
    if (!nextName || nextName === folder.name) return;
    if (cabinet.some((item) => item.id !== folder.id && item.name.toLowerCase() === nextName.toLowerCase())) {
      toast.error(tx("Ya hay una carpeta con ese nombre", "A folder already has that name"));
      return;
    }
    const owned = pages.filter((page) => page.folder === folder.name);
    await Promise.all(owned.map((page) => savePad({ data: { pageId: page.id, folder: nextName } })));
    onCabinet(cabinet.map((item) => (item.id === folder.id ? { ...item, name: nextName } : item)));
    await onRefresh();
  }

  async function trashFolder(folder: CabinetFolder) {
    const owned = pages.filter((page) => page.folder === folder.name && !page.deletedAt);
    await Promise.all(owned.map((page) => savePad({ data: { pageId: page.id, trashed: true } })));
    onCabinet(cabinet.map((item) => (item.id === folder.id ? { ...item, trashedAt: Date.now() } : item)));
    toast(tx("Carpeta en la papelera", "Folder moved to trash"));
    await onRefresh();
  }

  async function restoreFolder(folder: CabinetFolder) {
    const owned = pages.filter((page) => page.folder === folder.name && page.deletedAt);
    await Promise.all(owned.map((page) => savePad({ data: { pageId: page.id, trashed: false } })));
    onCabinet(cabinet.map((item) => (item.id === folder.id ? { ...item, trashedAt: null } : item)));
    await onRefresh();
  }

  async function restoreNote(page: PadPage) {
    await savePad({ data: { pageId: page.id, trashed: false } });
    await onRefresh();
  }

  function paint(folder: CabinetFolder, patch: Partial<CabinetFolder>) {
    if (colorMode !== "custom") onColor("custom");
    onCabinet(cabinet.map((item) => (item.id === folder.id ? { ...item, ...patch } : item)));
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] grid grid-cols-1 place-items-end overflow-x-hidden sm:place-items-center sm:p-4">
      <button type="button" aria-label={tx("Cerrar", "Close")} className="absolute inset-0 bz-scrim" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative max-h-[88dvh] w-full min-w-0 max-w-md overflow-x-hidden overflow-y-auto rounded-t-3xl bg-bg p-4 shadow-card sm:max-w-lg sm:rounded-3xl sm:p-5 lg:max-w-xl">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{tx("Carpetas", "Folders")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {tx(
            "El tema sigue los colores de la app. Color propio es tu código: uno para la carpeta y otro para sus notas.",
            "Theme follows the app colors. Own color is your code: one for the folder and one for its notes.",
          )}
        </p>
        <div className="mt-4 grid grid-cols-2 rounded-full bg-surface p-1 shadow-card">
          {(
            [
              ["theme", tx("Tema", "Theme")],
              ["custom", tx("Color propio", "Own color")],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onColor(mode)}
              className={cn(
                "h-10 rounded-full text-sm font-semibold",
                colorMode === mode ? "bg-primary text-primary-fg" : "text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={tx("Nueva carpeta", "New folder")}
            aria-label={tx("Nueva carpeta", "New folder")}
            className="h-11 bg-surface"
          />
          <Button type="button" size="sm" onClick={addFolder}>
            {tx("Agregar", "Add")}
          </Button>
        </div>
        <ul className="mt-4 grid gap-2">
          {active.map((folder) => (
            <FolderTune
              key={folder.id}
              folder={folder}
              colorMode={colorMode}
              onRename={(name) => void rename(folder, name)}
              onTrash={() => void trashFolder(folder)}
              onPaint={(patch) => paint(folder, patch)}
            />
          ))}
        </ul>
        <div className="mt-5 border-t border-border/80 pt-4">
          <p className="font-display text-lg font-semibold">{tx("Papelera", "Trash")}</p>
          <label className="mt-2 flex items-center justify-between gap-2 text-sm text-muted">
            <span>{tx("Borrar del todo a los", "Delete for good after")}</span>
            <span className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={365}
                value={trashDays}
                onChange={(e) => onDays(Math.min(365, Math.max(1, Number(e.target.value) || 1)))}
                className="h-10 w-20 bg-surface"
                aria-label={tx("Días en la papelera", "Days in trash")}
              />
              {tx("días", "days")}
            </span>
          </label>
          {trashed.length === 0 && pages.every((page) => !page.deletedAt) ? (
            <p className="mt-2 text-sm text-muted">{tx("La papelera está vacía.", "Trash is empty.")}</p>
          ) : null}
          <ul className="mt-2 grid gap-1">
            {trashed.map((folder) => (
              <li key={folder.id} className="flex min-h-11 items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold">{folder.name}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => void restoreFolder(folder)}>
                  {tx("Restaurar", "Restore")}
                </Button>
              </li>
            ))}
            {pages
              .filter((page) => page.deletedAt && !trashed.some((folder) => folder.name === page.folder))
              .map((page) => (
                <li key={page.id} className="flex min-h-11 items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm">{page.title || tx("Nota", "Note")}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void restoreNote(page)}>
                    {tx("Restaurar", "Restore")}
                  </Button>
                </li>
              ))}
          </ul>
        </div>
        <Button type="button" variant="secondary" className="mt-4 w-full" onClick={onClose}>
          {tx("Listo", "Done")}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
