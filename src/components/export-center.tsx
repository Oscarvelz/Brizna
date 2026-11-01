import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Calculator,
  Check,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Printer,
  Search,
  Share2,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { actionWords, pillarWords, verdict } from "@/components/asesor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/lib/dates";
import { canShareFiles, downloadPdf, downloadSheet, printReport, shareFile } from "@/lib/export/actions";
import { buildModel, dayLong, type AdvisorWords } from "@/lib/export/model";
import {
  chosenSections,
  loadExportOptions,
  matchPreset,
  PERIODS,
  PRESETS,
  presetOptions,
  resolvePeriod,
  saveExportOptions,
  SECTIONS,
  type ExportOptions,
  type PresetId,
  type SectionId,
} from "@/lib/export/options";
import { renderReport } from "@/lib/export/report-pdf";
import { tabNames } from "@/lib/export/report-xlsx";
import { useI18n, useTx } from "@/lib/i18n";
import { exportCenterData, getAdvisor } from "@/lib/server/lawn";
import { cn } from "@/lib/utils";

/* Ajustes · Exportar e imprimir. One set of choices makes the PDF (to read and print),
   the worksheet (to filter and sum) and the printed pages. Picture first: what you'll get. */

const WORDS: AdvisorWords = { verdict, actionWords, pillarWords };

const PRESET_ICON: Record<PresetId, LucideIcon> = {
  todo: Layers,
  cobros: Wallet,
  agenda: CalendarDays,
  mes: FileText,
  clientes: Users,
  contador: Calculator,
};

/** Grass blades for the sheet's header: the lawn touch, in the app's own colors. */
function Blades({ className }: { className?: string }) {
  const blades = [
    [4, 15, -2], [8, 22, 1], [12, 12, 2], [16, 19, -1], [20, 25, 2], [24, 14, -2], [28, 20, 1], [32, 11, 2], [36, 17, -1],
  ];
  return (
    <svg viewBox="0 0 40 28" className={className} aria-hidden>
      {blades.map(([x, h, lean], i) => (
        <path
          key={i}
          d={`M ${x! - 1.6} 28 Q ${x! + lean! * 0.3} ${28 - h! * 0.6} ${x! + lean!} ${28 - h!} Q ${x! + 0.6 + lean! * 0.3} ${28 - h! * 0.55} ${x! + 1.6} 28 Z`}
          fill="currentColor"
          opacity={0.55 + (i % 3) * 0.2}
        />
      ))}
    </svg>
  );
}

export function useExportLaunch() {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<PresetId | null>(null);
  return {
    open,
    preset,
    launch: (p: PresetId | null = null) => {
      setPreset(p);
      setOpen(true);
    },
    close: () => setOpen(false),
  };
}

/** The card inside Ajustes: quick presets and the button that opens the export sheet. */
export function ExportCenterCard({ onOpen }: { onOpen: (preset: PresetId | null) => void }) {
  const tx = useTx();
  const [last, setLast] = useState<ExportOptions | null>(null);
  useEffect(() => setLast(loadExportOptions()), []);
  const lastPreset = last ? PRESETS.find((p) => p.id === last.preset) : null;
  const lastPeriod = last ? PERIODS.find((p) => p.id === last.period) : null;
  return (
    <div data-export-card>
      <p className="text-sm text-muted">
        {tx(
          "Llévate tu trabajo en PDF para leer e imprimir, o en hoja de cálculo para filtrar y sumar. Tú eliges qué entra.",
          "Take your work as a PDF to read and print, or as a worksheet to filter and sum. You choose what goes in.",
        )}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PRESETS.map((p) => {
          const Icon = PRESET_ICON[p.id];
          return (
            <button
              key={p.id}
              type="button"
              data-quick-preset={p.id}
              onClick={() => onOpen(p.id)}
              className="flex min-h-14 items-center gap-2 rounded-md bg-surface px-3 py-2 text-left shadow-card transition-shadow hover:shadow-card-hover active:scale-[0.98]"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-done-bg text-done">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 text-sm font-semibold leading-tight">{tx(p.es, p.en)}</span>
            </button>
          );
        })}
      </div>
      <Button className="mt-3 w-full" onClick={() => onOpen(null)} data-open-export>
        <FileText />
        {tx("Abrir exportar e imprimir", "Open export and print")}
      </Button>
      {last ? (
        <p className="mt-2 text-xs text-subtle">
          {tx("Última vez: ", "Last time: ")}
          {lastPreset ? tx(lastPreset.es, lastPreset.en) : tx("a medida", "custom")}
          {lastPeriod ? ` · ${tx(lastPeriod.es, lastPeriod.en)}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function Chip({ on, onClick, children, disabled, title, data }: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; title?: string; data?: Record<string, string> }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      disabled={disabled}
      title={title}
      onClick={onClick}
      {...data}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors disabled:opacity-40",
        on ? "bg-primary text-primary-fg shadow-card" : "bg-surface-2 text-fg hover:bg-border",
      )}
    >
      {on ? <Check className="size-4" /> : null}
      {children}
    </button>
  );
}

function Toggle({ on, onChange, label, note }: { on: boolean; onChange: (v: boolean) => void; label: string; note: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center gap-3 rounded-md bg-surface px-3 py-2.5 text-left shadow-card">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted">{note}</span>
      </span>
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-border")}>
        <span className={cn("absolute top-1 size-5 rounded-full bg-surface shadow transition-[left]", on ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}

function Block({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function ExportSheet({ open, preset, onClose }: { open: boolean; preset: PresetId | null; onClose: () => void }) {
  const tx = useTx();
  const { locale } = useI18n();
  const titleId = useId();
  const [o, setO] = useState<ExportOptions>(() => loadExportOptions());
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState<null | "pdf" | "xlsx" | "print" | "share">(null);
  const [shareKind, setShareKind] = useState<"pdf" | "xlsx">("pdf");
  const [canShare, setCanShare] = useState(false);
  const today = todayISO();

  useEffect(() => {
    if (!open) return;
    setCanShare(canShareFiles());
    const saved = loadExportOptions();
    setO(preset ? presetOptions(preset, saved) : saved);
    setFind("");
  }, [open, preset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const update = (patch: Partial<ExportOptions>) =>
    setO((cur) => {
      const next = { ...cur, ...patch };
      next.preset = matchPreset(next);
      saveExportOptions(next);
      return next;
    });

  const span = resolvePeriod(o, today);
  const ahead = o.sections.agenda ? o.ahead : 0;
  const data = useQuery({
    queryKey: ["export-center", span.from, span.to, ahead],
    queryFn: () => exportCenterData({ data: { from: span.from, to: span.to, ahead } }),
    enabled: open,
    staleTime: 30_000,
  });
  const wantAdvisor = open && o.sections.asesor && o.amounts;
  const advisor = useQuery({ queryKey: ["advisor"], queryFn: () => getAdvisor(), enabled: wantAdvisor, staleTime: 60_000 });

  const deferred = useDeferredValue(o);
  const model = useMemo(() => {
    if (!data.data) return null;
    try {
      return buildModel(data.data, deferred.sections.asesor ? (advisor.data ?? null) : null, deferred, locale, WORDS);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [data.data, advisor.data, deferred, locale]);
  const pages = useMemo(() => {
    if (!model) return 0;
    try {
      return renderReport(model).doc.pageCount;
    } catch {
      return 0;
    }
  }, [model]);
  const tabs = model ? tabNames(model) : [];

  const allClients = data.data?.clients ?? [];
  const groupCount = {
    active: allClients.filter((c) => c.isActive && c.kind !== "one_time").length,
    oneTime: allClients.filter((c) => c.isActive && c.kind === "one_time").length,
    archived: allClients.filter((c) => !c.isActive).length,
  };
  const pickable = allClients
    .filter((c) => (c.isActive ? (c.kind === "one_time" ? o.groups.oneTime : o.groups.active) : o.groups.archived))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const shown = find.trim() ? pickable.filter((c) => c.name.toLowerCase().includes(find.trim().toLowerCase())) : pickable;
  const live = chosenSections(o);
  const ready = Boolean(model) && !data.isFetching && (!wantAdvisor || !advisor.isLoading);

  async function run(kind: "pdf" | "xlsx" | "print" | "share") {
    if (!model || busy) return;
    setBusy(kind);
    try {
      if (kind === "pdf") {
        await downloadPdf(model, o);
        toast.success(tx("PDF listo.", "PDF ready."));
      } else if (kind === "xlsx") {
        await downloadSheet(model, o);
        toast.success(tx("Hoja de cálculo lista.", "Worksheet ready."));
      } else if (kind === "print") {
        await printReport(model);
      } else {
        const how = await shareFile(model, o, shareKind);
        if (how === "saved") toast.success(tx("Este equipo no comparte archivos: lo guardé.", "This device can't share files: saved it instead."));
      }
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name !== "AbortError") toast.error(tx("No se pudo preparar el archivo. Prueba otra vez.", "Could not prepare the file. Try again."));
    } finally {
      setBusy(null);
    }
  }

  if (!open || typeof document === "undefined") return null;
  const presetDef = PRESETS.find((p) => p.id === o.preset);
  const setSection = (id: SectionId, on: boolean) => update({ sections: { ...o.sections, [id]: on } });
  const periodText = model ? model.periodLabel : `${dayLong(span.from, locale)} – ${dayLong(span.to, locale)}`;
  const clientsIn = model?.clients.length ?? 0;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-4" data-export-sheet>
      <button type="button" aria-label={tx("Cerrar", "Close")} className="absolute inset-0 bz-scrim" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[96dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl bg-bg shadow-card sm:max-h-[92dvh] sm:rounded-xl"
      >
        {/* Header */}
        <div className="relative flex items-start gap-3 bg-surface px-4 pb-3 pt-4 sm:px-5">
          <Blades className="absolute bottom-0 right-14 h-7 w-12 text-primary/50" />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-xl font-semibold">
              {tx("Exportar e imprimir", "Export and print")}
            </h2>
            <p className="text-sm text-muted">{tx("PDF para leer e imprimir · hoja para filtrar y sumar.", "PDF to read and print · worksheet to filter and sum.")}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={tx("Cerrar", "Close")} className="-mr-2 -mt-1 size-10">
            <X />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 sm:px-5">
          <Block title={tx("¿Qué quieres llevarte?", "What do you want to take?")}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRESETS.map((p) => {
                const Icon = PRESET_ICON[p.id];
                const on = o.preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    data-preset={p.id}
                    onClick={() => {
                      const next = presetOptions(p.id, o);
                      saveExportOptions(next);
                      setO(next);
                    }}
                    className={cn(
                      "flex min-h-[4.5rem] flex-col items-start gap-1 rounded-md px-3 py-2.5 text-left transition-[box-shadow,background-color]",
                      on ? "bg-primary text-primary-fg shadow-card" : "bg-surface shadow-card hover:shadow-card-hover",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
                      <Icon className="size-4 shrink-0" />
                      {tx(p.es, p.en)}
                    </span>
                    <span className={cn("text-xs leading-snug", on ? "text-primary-fg/85" : "text-muted")}>{tx(p.noteEs, p.noteEn)}</span>
                  </button>
                );
              })}
            </div>
            {o.preset === "custom" ? <p className="mt-2 text-xs text-muted">{tx("A tu medida: cambiaste alguna casilla.", "Your own mix: you changed a box.")}</p> : null}
          </Block>

          <Block title={tx("¿De cuándo?", "Which dates?")} aside={<span className="text-xs text-muted">{periodText}</span>}>
            <div className="flex flex-wrap gap-1.5">
              {PERIODS.map((p) => (
                <Chip key={p.id} on={o.period === p.id} onClick={() => update({ period: p.id, ...(p.id === "custom" && !o.from ? { from: span.from, to: span.to } : {}) })} data={{ "data-period": p.id }}>
                  {tx(p.es, p.en)}
                </Chip>
              ))}
            </div>
            {o.period === "custom" ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-muted">
                  {tx("Desde", "From")}
                  <Input type="date" value={o.from} max={o.to || undefined} onChange={(e) => update({ from: e.target.value })} className="mt-1" />
                </label>
                <label className="text-xs text-muted">
                  {tx("Hasta", "To")}
                  <Input type="date" value={o.to} min={o.from || undefined} onChange={(e) => update({ to: e.target.value })} className="mt-1" />
                </label>
              </div>
            ) : null}
            {o.sections.agenda ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-semibold text-muted">{tx("Hoja de ruta:", "Route sheet:")}</span>
                {([7, 14, 28] as const).map((d) => (
                  <Chip key={d} on={o.ahead === d} onClick={() => update({ ahead: d })}>
                    {d === 7 ? tx("1 semana", "1 week") : d === 14 ? tx("2 semanas", "2 weeks") : tx("4 semanas", "4 weeks")}
                  </Chip>
                ))}
              </div>
            ) : null}
          </Block>

          <Block
            title={tx("¿Qué incluir?", "What to include?")}
            aside={
              <span className="flex gap-3 text-xs font-semibold">
                <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => update({ sections: Object.fromEntries(SECTIONS.map((s) => [s.id, true])) as ExportOptions["sections"] })}>
                  {tx("Todo", "All")}
                </button>
                <button type="button" className="text-muted underline-offset-2 hover:underline" onClick={() => update({ sections: Object.fromEntries(SECTIONS.map((s) => [s.id, false])) as ExportOptions["sections"] })}>
                  {tx("Nada", "None")}
                </button>
              </span>
            }
          >
            <div className="grid gap-1.5 sm:grid-cols-2">
              {SECTIONS.map((s) => {
                const blocked = s.money && !o.amounts;
                const on = o.sections[s.id] && !blocked;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={blocked}
                    data-section={s.id}
                    onClick={() => setSection(s.id, !o.sections[s.id])}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors disabled:opacity-45",
                      on ? "bg-done-bg" : "bg-surface shadow-card",
                    )}
                  >
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-[0.35rem] border-2", on ? "border-primary bg-primary text-primary-fg" : "border-border")}>
                      {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight">{tx(s.es, s.en)}</span>
                      <span className="block text-xs leading-snug text-muted">{blocked ? tx("Necesita los montos", "Needs amounts on") : tx(s.noteEs, s.noteEn)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Block>

          <Block title={tx("¿Qué clientes?", "Which clients?")} aside={<span className="text-xs text-muted">{data.data ? tx(`${clientsIn} en el informe`, `${clientsIn} in the report`) : ""}</span>}>
            <div className="flex flex-wrap gap-1.5">
              <Chip on={o.groups.active} onClick={() => update({ groups: { ...o.groups, active: !o.groups.active } })}>
                {tx("Activos", "Active")} <span className="opacity-70">{groupCount.active}</span>
              </Chip>
              <Chip on={o.groups.oneTime} onClick={() => update({ groups: { ...o.groups, oneTime: !o.groups.oneTime } })}>
                {tx("De una vez", "One-time")} <span className="opacity-70">{groupCount.oneTime}</span>
              </Chip>
              <Chip on={o.groups.archived} onClick={() => update({ groups: { ...o.groups, archived: !o.groups.archived } })}>
                {tx("Archivados", "Archived")} <span className="opacity-70">{groupCount.archived}</span>
              </Chip>
            </div>
            <div className="mt-2 flex gap-1.5" role="radiogroup">
              <Chip on={!o.pick} onClick={() => update({ pick: null })}>
                {tx("Todos", "Everyone")}
              </Chip>
              <Chip on={Boolean(o.pick)} onClick={() => update({ pick: o.pick ?? [] })} data={{ "data-pick": "some" }}>
                {tx("Elegir clientes", "Pick clients")}
                {o.pick?.length ? <span className="opacity-70">{o.pick.length}</span> : null}
              </Chip>
            </div>
            {o.pick ? (
              <div className="mt-2 rounded-md bg-surface p-2 shadow-card">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                  <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder={tx("Buscar cliente", "Find a client")} className="h-10 pl-9 shadow-none" />
                </div>
                <div className="mt-2 max-h-56 overflow-y-auto">
                  {shown.map((c) => {
                    const on = o.pick?.includes(c.id) ?? false;
                    return (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 hover:bg-surface-2">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--color-primary)]"
                          checked={on}
                          onChange={() => {
                            const cur = new Set(o.pick ?? []);
                            if (on) cur.delete(c.id);
                            else cur.add(c.id);
                            update({ pick: [...cur] });
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                        {c.balance > 0 ? <span className="text-xs font-semibold text-late">{tx("debe", "owes")}</span> : null}
                      </label>
                    );
                  })}
                  {!shown.length ? <p className="px-2 py-3 text-sm text-muted">{tx("Nadie con ese nombre.", "Nobody by that name.")}</p> : null}
                </div>
                {o.pick.length === 0 ? <p className="mt-1 px-2 text-xs text-muted">{tx("Marca uno o más. Sin marcar, entran todos.", "Tick one or more. With none ticked, everyone is in.")}</p> : null}
              </div>
            ) : null}
          </Block>

          <Block title={tx("Privacidad", "Privacy")}>
            <div className="grid gap-1.5 sm:grid-cols-3">
              <Toggle on={o.phones} onChange={(v) => update({ phones: v })} label={tx("Teléfonos", "Phone numbers")} note={o.phones ? tx("Se incluyen", "Included") : tx("Se ocultan", "Hidden")} />
              <Toggle on={o.names} onChange={(v) => update({ names: v })} label={tx("Nombres", "Names")} note={o.names ? tx("Nombre completo", "Full name") : tx("Solo iniciales (J.P.)", "Initials only (J.P.)")} />
              <Toggle on={o.amounts} onChange={(v) => update({ amounts: v })} label={tx("Montos", "Amounts")} note={o.amounts ? tx("Con dinero", "With money") : tx("Sin dinero (para ayudantes)", "No money (for helpers)")} />
            </div>
          </Block>
        </div>

        {/* What you'll get + actions */}
        <div className="border-t border-border bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5" data-export-summary>
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-done-bg text-done">
              {ready ? <Blades className="h-6 w-8" /> : <Loader2 className="size-5 animate-spin" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">
                {!live.length
                  ? tx("Elige al menos una sección.", "Pick at least one section.")
                  : ready
                    ? tx(`PDF de ${pages} ${pages === 1 ? "página" : "páginas"} · hoja con ${tabs.length} ${tabs.length === 1 ? "pestaña" : "pestañas"}`, `${pages}-page PDF · worksheet with ${tabs.length} ${tabs.length === 1 ? "tab" : "tabs"}`)
                    : tx("Preparando…", "Getting it ready…")}
              </p>
              <p className="truncate text-xs text-muted">
                {presetDef ? tx(presetDef.es, presetDef.en) : tx("A medida", "Custom")} · {periodText}
                {clientsIn ? ` · ${clientsIn} ${tx("clientes", "clients")}` : ""}
                {!o.names ? ` · ${tx("iniciales", "initials")}` : ""}
                {!o.phones ? ` · ${tx("sin teléfonos", "no phones")}` : ""}
                {!o.amounts ? ` · ${tx("sin montos", "no amounts")}` : ""}
              </p>
            </div>
          </div>
          {ready && live.length ? (
            <p className="mt-1.5 hidden line-clamp-2 text-xs text-muted sm:block" data-export-tabs>
              {tx("Pestañas: ", "Tabs: ")}
              {tabs.map((t) => t.name).join(" · ")}
            </p>
          ) : null}
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button size="sm" disabled={!ready || !live.length || Boolean(busy)} onClick={() => run("pdf")} data-export-action="pdf">
              {busy === "pdf" ? <Loader2 className="animate-spin" /> : <FileText />}
              {tx("Descargar PDF", "Download PDF")}
            </Button>
            <Button size="sm" variant="outline" disabled={!ready || !live.length || Boolean(busy)} onClick={() => run("xlsx")} data-export-action="xlsx">
              {busy === "xlsx" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              {tx("Descargar hoja", "Download sheet")}
            </Button>
            <Button size="sm" variant="outline" disabled={!ready || !live.length || Boolean(busy)} onClick={() => run("print")} data-export-action="print">
              {busy === "print" ? <Loader2 className="animate-spin" /> : <Printer />}
              {tx("Imprimir", "Print")}
            </Button>
            <Button size="sm" variant="outline" disabled={!ready || !live.length || Boolean(busy)} onClick={() => run("share")} data-export-action="share">
              {busy === "share" ? <Loader2 className="animate-spin" /> : <Share2 />}
              {tx("Compartir", "Share")}
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted">
            <span title={canShare ? undefined : tx("Este equipo no comparte archivos: Compartir lo guarda.", "This device can't share files: Share saves it.")}>{canShare ? tx("Compartir envía:", "Share sends:") : tx("Compartir guarda:", "Share saves:")}</span>
            <span className="flex gap-1" role="radiogroup">
              {(["pdf", "xlsx"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={shareKind === k}
                  onClick={() => setShareKind(k)}
                  className={cn("h-7 rounded-full px-2.5 font-semibold", shareKind === k ? "bg-primary text-primary-fg" : "bg-surface-2 text-fg")}
                >
                  {k === "pdf" ? "PDF" : tx("Hoja", "Sheet")}
                </button>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
