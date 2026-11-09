import { Masonry } from "@/components/wide-layout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollTop } from "@/components/scroll-top";
import { createFileRoute } from "@tanstack/react-router";
import { BatteryCharging, Bell, BellRing, Check, ChevronDown, ChevronsUpDown, CalendarRange, Clock, FlaskConical, Download, HardDrive, Hourglass, LayoutGrid, Moon, Palette, Palmtree, Printer, RotateCcw, Store, Sun, Sunrise, Upload, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell, SignOutControl, TitleSearch } from "@/components/app-shell";
import { FingerprintControl } from "@/components/fingerprint-control";
import { SyncStatusCard } from "@/components/sync-status";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ExportCenterCard, ExportSheet, useExportLaunch } from "@/components/export-center";
import { Fold, foldsAllState, foldsOpen, setFoldsOpen } from "@/components/fold";
import { Hint } from "@/components/hint";
import { invalidateLawn } from "@/components/job-card";
import { SoundSettings } from "@/components/settings-finder";
import { SampleSettings } from "@/components/sample-data";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { PickerField } from "@/components/ui/picker-field";
import { SettingsOrderButton } from "@/components/settings-order-button";
import { useAjustesRank } from "@/lib/ajustes-order";
import { inAndroidApp, native, nativeNotifyStatus, type NativeNotifyStatus } from "@/spa/native";
import { MORNING, readNotifyPrefs, writeNotifyPrefs, type NotifyPrefs } from "@/lib/native-plan";
import { refreshNativeSoon } from "@/components/native-host";
import { useUndo } from "@/lib/undo";
import { UserManual } from "@/components/user-manual";
import { addDaysISO, todayISO } from "@/lib/dates";
import { formatDay, formatStamp } from "@/lib/format";
import { emphasize, useI18n, useTx } from "@/lib/i18n";
import { smartHit } from "@/lib/fuzzy";
import { notificationsSupported, requestNotificationPermission } from "@/lib/reminders";
import { pickBackupFolder, writeBackupBundle } from "@/lib/save-file";
import {
  applyVacation,
  clearVacation,
  exportBackup,
  exportReport,
  getBackupWeight,
  getSettings,
  importBackupJson,
  listBackups,
  restoreBackup,
  updateSettings,
} from "@/lib/server/lawn";
import { readTabletEnabled, writeTabletEnabled } from "@/lib/tablet-mode";
import {
  applyAppearance,
  applyLocale,
  readAppearance,
  type Appearance,
  type AppearanceMode,
  type DayPalette,
  type NightPalette,
} from "@/lib/theme";
import type { AppSettings, BackupSummary, PaletteName } from "@/lib/types";
import { storeBusinessName } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ajustes")({ component: AjustesPage });

const DAY_THEMES: { id: DayPalette; es: string; en: string; swatch: string }[] = [
  { id: "jardin", es: "Jardín", en: "Garden", swatch: "swatch-jardin" },
  { id: "costa", es: "Costa", en: "Coast", swatch: "swatch-costa" },
  { id: "barro", es: "Barro", en: "Clay", swatch: "swatch-barro" },
  { id: "pino", es: "Pino", en: "Pine", swatch: "swatch-pino" },
  { id: "cielo", es: "Cielo", en: "Sky", swatch: "swatch-cielo" },
  { id: "lima", es: "Lima", en: "Lime", swatch: "swatch-lima" },
  { id: "arena", es: "Arena", en: "Sand", swatch: "swatch-arena" },
  { id: "flor", es: "Flor", en: "Bloom", swatch: "swatch-flor" },
];

const NIGHT_THEMES: { id: NightPalette; es: string; en: string; swatch: string }[] = [
  { id: "noche", es: "Noche", en: "Night", swatch: "swatch-noche" },
  { id: "medianoche", es: "Medianoche", en: "Midnight", swatch: "swatch-medianoche" },
  { id: "ciruela", es: "Ciruela", en: "Plum", swatch: "swatch-ciruela" },
  { id: "grafito", es: "Grafito", en: "Graphite", swatch: "swatch-grafito" },
  { id: "luciernaga", es: "Luciérnaga", en: "Firefly", swatch: "swatch-luciernaga" },
  { id: "amoled", es: "AMOLED", en: "AMOLED", swatch: "swatch-amoled" },
];

const SERVER_PALETTES = new Set<PaletteName>(["jardin", "costa", "barro", "pino", "cielo"]);

function mdToIso(md: string): string {
  const m = /^(\d{2})-(\d{2})$/.exec(md ?? "");
  return m ? `${new Date().getFullYear()}-${m[1]}-${m[2]}` : "";
}

/** One number setting as a calm row: label + plain sub on the left, a compact −/value/+ control on the right. */
function NumberRow({
  label,
  sub,
  unit,
  prefix,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  sub?: string;
  unit?: string;
  prefix?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (n: number) => unknown;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const commit = (n: number) => {
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const next = clamp(n);
    setDraft(String(next));
    if (next !== value) void onCommit(next);
  };
  const cur = Number(draft) || value;
  return (
    <div className="aj-num">
      <div className="min-w-0 flex-1">
        <p className="aj-num-label">{label}</p>
        {sub ? <p className="aj-num-sub">{sub}</p> : null}
      </div>
      <div className="aj-num-ctl">
        <button type="button" className="aj-num-btn" aria-label="−" disabled={cur <= min} onClick={() => commit(cur - step)}>
          <span aria-hidden>−</span>
        </button>
        <label className="aj-num-val">
          {prefix ? <span className="aj-num-unit">{prefix}</span> : null}
          <input
            inputMode="numeric"
            aria-label={label}
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={() => commit(Number(draft))}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            style={{ width: `${Math.max(2, draft.length) + 0.5}ch` }}
          />
          {unit ? <span className="aj-num-unit">{unit}</span> : null}
        </label>
        <button type="button" className="aj-num-btn" aria-label="+" disabled={cur >= max} onClick={() => commit(cur + step)}>
          <span aria-hidden>+</span>
        </button>
      </div>
    </div>
  );
}

function SettingFold({
  id,
  order,
  title,
  hint,
  query,
  blob,
  children,
}: {
  id: string;
  order: string;
  title: ReactNode;
  hint?: ReactNode;
  query: string;
  blob: string;
  children: ReactNode;
}) {
  const rank = useAjustesRank(id);
  if (query && !smartHit(query, blob)) return null;
  return (
    <Fold
      id={id}
      forceOpen={Boolean(query)}
      className="mb-4"
      chevronEnd
      style={{ order: rank }}
      titleClassName="text-lg"
      contentClassName="px-4 pb-4"
      title={title}
      hint={hint}
    >
      {children}
    </Fold>
  );
}

function AjustesPage() {
  const { locale, setLocale, t } = useI18n();
  const tx = useTx();
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const backupsQ = useQuery({ queryKey: ["backups"], queryFn: () => listBackups() });
  const backupWeightQ = useQuery({ queryKey: ["backup-weight"], queryFn: () => getBackupWeight() });
  const settings = settingsQ.data;
  const [name, setName] = useState<string | null>(null);
  const businessName = name ?? settings?.businessName ?? "Oscar's Lawn Service";
  const push = useUndo((s) => s.push);
  const [restoreTarget, setRestoreTarget] = useState<BackupSummary | null>(null);
  const [restoreJson, setRestoreJson] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  async function saveFullCopy() {
    const [copy, report] = await Promise.all([exportBackup(), exportReport()]);
    const pdf = Uint8Array.from(atob(report.pdf), (c) => c.charCodeAt(0));
    const xls = Uint8Array.from(atob(report.xls), (c) => c.charCodeAt(0));
    return writeBackupBundle({ json: copy.json, pdf, xls });
  }
  const exporter = useExportLaunch();
  const [findOn, setFindOn] = useState(false);
  const [needle, setNeedle] = useState("");
  const query = findOn ? needle.trim() : "";
  const [vacStart, setVacStart] = useState("");
  const [vacEnd, setVacEnd] = useState("");
  const [look, setLook] = useState<Appearance>(() => readAppearance());
  useEffect(() => {
    const sync = () => setLook(readAppearance());
    window.addEventListener("ols-look", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ols-look", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  // 1.5.40 (Oscar): on a tablet or any large screen, Ajustes opens with EVERYTHING deployed —
  // «Desplegar todo» is the established option; folding is the user's decision afterwards.
  // Only when this session holds no choice yet: a user who folded all keeps them folded.
  const [wideDefault] = useState(
    () =>
      foldsAllState("aj-") === undefined &&
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches,
  );
  const [expandAll, setExpandAll] = useState(() => foldsOpen("aj-") || wideDefault);
  useEffect(() => {
    if (wideDefault) setFoldsOpen("aj-", true);
  }, [wideDefault]);
  const [tabletOn, setTabletOn] = useState(() => readTabletEnabled());

  const saveName = useMutation({
    mutationFn: (input: { next: string; prev: string }) => updateSettings({ data: { businessName: input.next } }),
    onSuccess: async (_, input) => {
      storeBusinessName(input.next);
      push({
        label: tx("Nombre del negocio", "Business name"),
        undo: async () => {
          await updateSettings({ data: { businessName: input.prev } });
          storeBusinessName(input.prev);
          setName(input.prev);
          await qc.invalidateQueries({ queryKey: ["settings"] });
        },
        redo: async () => {
          await updateSettings({ data: { businessName: input.next } });
          storeBusinessName(input.next);
          setName(input.next);
          await qc.invalidateQueries({ queryKey: ["settings"] });
        },
      });
      toast.success(tx("Nombre actualizado", "Name updated"));
      await qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
  const saveReminders = useMutation({
    mutationFn: (data: { remindersEnabled?: boolean; reminderMinutes?: number; askYesterday?: boolean }) => updateSettings({ data }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
  const backupNow = useMutation({
    mutationFn: () => saveFullCopy(),
    onSuccess: async (how) => {
      toast.success(
        how === "folder"
          ? tx("Copia, PDF y hoja guardados en la carpeta.", "Copy, PDF, and sheet saved in the folder.")
          : tx("Se descargó el paquete: copia, PDF y hoja.", "The package downloaded: copy, PDF, and sheet."),
      );
      await qc.invalidateQueries({ queryKey: ["settings"] });
      await qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (err) => {
      if ((err instanceof Error ? err.name : "") === "AbortError") return;
      toast.error(tx("No se pudo guardar la copia", "Could not save the copy"));
    },
  });
  const download = useMutation({
    mutationFn: () => saveFullCopy(),
    onSuccess: async (how) => {
      toast.success(
        how === "folder"
          ? tx("Copia, PDF y hoja guardados en la carpeta.", "Copy, PDF, and sheet saved in the folder.")
          : tx("Se descargó el paquete: copia, PDF y hoja.", "The package downloaded: copy, PDF, and sheet."),
      );
      await qc.invalidateQueries({ queryKey: ["settings"] });
      await qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (err) => {
      if ((err instanceof Error ? err.name : "") === "AbortError") return;
      toast.error(tx("No se pudo guardar el archivo", "Could not save the file"));
    },
  });
  const restore = useMutation({
    mutationFn: (id: number) => restoreBackup({ data: { id } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(tx("No se encontró esa copia", "That copy was not found"));
        return;
      }
      toast.success(tx(`Copia restaurada · ${res.clients} clientes`, `Copy restored · ${res.clients} clients`));
      setRestoreTarget(null);
      await invalidateLawn(qc);
    },
    onError: () => toast.error(tx("Esa copia está dañada o no sirve. Se deja lo que ya tienes.", "That copy is damaged or unusable. What you already have stays.")),
  });
  const restoreFile = useMutation({
    mutationFn: (json: string) => importBackupJson({ data: { json } }),
    onSuccess: async (res) => {
      toast.success(tx(`Archivo restaurado · ${res.clients} clientes`, `File restored · ${res.clients} clients`));
      setRestoreJson(null);
      await invalidateLawn(qc);
    },
    onError: () => toast.error(tx("Ese archivo está dañado o no es una copia. No se cambió nada.", "That file is damaged or not a copy. Nothing was changed.")),
  });
  const vacMut = useMutation({
    mutationFn: (range: { start: string; end: string }) => applyVacation({ data: range }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(tx("Revisa las fechas: el fin no puede ser antes del inicio.", "Check the dates: the end cannot be before the start."));
        return;
      }
      toast.success(tx(`${res.moved} trabajos movidos · ${res.days} días de vacaciones`, `${res.moved} jobs moved · ${res.days} days off`));
      await invalidateLawn(qc);
    },
  });
  const vacOff = useMutation({
    mutationFn: () => clearVacation(),
    onSuccess: async () => {
      toast.success(tx("Vacaciones quitadas. La agenda vuelve a su sitio.", "Time off removed. The schedule goes back in place."));
      await invalidateLawn(qc);
    },
  });

  function chooseLook(patch: Partial<Appearance>) {
    const next = applyAppearance(patch);
    setLook(next);
    if (patch.day && SERVER_PALETTES.has(patch.day as PaletteName)) {
      void updateSettings({ data: { palette: patch.day as PaletteName } }).then(() =>
        qc.invalidateQueries({ queryKey: ["settings"] }),
      );
    }
    if (patch.mode === "day" || patch.mode === "night") {
      void updateSettings({ data: { theme: patch.mode === "night" ? "amoled" : "light" } }).then(() =>
        qc.invalidateQueries({ queryKey: ["settings"] }),
      );
    }
  }

  async function toggleReminders(next: boolean) {
    if (next && inAndroidApp()) {
      toast(tx("En la app, los avisos están en Notificaciones, justo debajo.", "In the app, alerts live in Notifications, just below."));
      return;
    }
    if (next) {
      if (!(await requestNotificationPermission())) {
        toast.error(
          notificationsSupported()
            ? tx("Hay que permitir notificaciones en el teléfono", "Notifications must be allowed on the phone")
            : tx("Este navegador no permite avisos", "This browser does not allow alerts"),
        );
        return;
      }
    }
    saveReminders.mutate({ remindersEnabled: next });
    toast(next ? tx("Recordatorios activados", "Reminders on") : tx("Recordatorios apagados", "Reminders off"));
  }

  return (
    <AppShell
      title={tx("Ajustes", "Settings")}
      titleExtra={<SettingsOrderButton />}
      action={
        <span className="ml-auto flex min-w-0 items-center gap-1">
          {/* 1.4.69: "Desplegar todo" lives on the title line (was a lonely row above the cards). */}
          {findOn ? null : (
            <button
              type="button"
              aria-pressed={expandAll}
              onClick={() => {
                const open = !expandAll;
                setExpandAll(open);
                setFoldsOpen("aj-", open);
              }}
              className={cn("bz-chiptoggle", expandAll && "is-on")}
            >
              <ChevronsUpDown aria-hidden />
              {tx("Desplegar todo", "Expand all")}
            </button>
          )}
          {findOn ? null : <Hint topic="ajustes" />}
        <TitleSearch
          open={findOn}
          onToggle={() => setFindOn((value) => !value)}
          value={needle}
          onChange={setNeedle}
          placeholder={tx("Buscar ajuste", "Search")}
          label={tx("Buscar en Ajustes", "Search settings")}
          spot="busca"
        />
        </span>
      }
    >
      <ScrollTop />
      <Masonry className="flex flex-col" three={1150}>
        <SettingFold
          id="aj-nombre"
          order="order-1"
          query={query}
          blob="nombre del negocio empresa titulo business name"
          title={
            <span className="flex items-center gap-2">
              <Store className="size-5 shrink-0 text-primary" />
              {tx("Nombre del negocio", "Business name")}
            </span>
          }
          hint={<Hint topic="nombre-negocio" />}
        >
          <p className="text-sm text-muted">{tx("Toca el título de arriba o cámbialo aquí.", "Tap the title above or change it here.")}</p>
            <Label className="mt-3">{tx("Cómo se llama la empresa", "What the business is called")}</Label>
            <Input value={businessName} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <Button
              className="mt-3"
              disabled={saveName.isPending}
              onClick={() => {
                const next = businessName.trim() || "Oscar's Lawn Service";
                const prev = settings?.businessName ?? next;
                if (next === prev) return;
                saveName.mutate({ next, prev });
              }}
            >
              {tx("Guardar nombre", "Save name")}
            </Button>
          </SettingFold>

        <SettingFold
          id="aj-pantalla"
          order="order-2"
          query={query}
          blob="tema pantalla dia noche automatico idioma language colores jardin costa barro pino cielo lima arena flor noche medianoche ciruela grafito luciernaga luciérnaga amoled theme screen day night"
          title={
            <span className="flex items-center gap-2">
              <Palette className="size-5 shrink-0 text-primary" />
              {tx("Tema", "Theme")}
            </span>
          }
          hint={
            <Hint topic="tema" />
          }
        >
            <p className="text-sm text-muted">
              {tx(
                "Día y noche tienen temas distintos. Automático usa el de día desde las 6:30 y el de noche desde las 6:30 de la tarde.",
                "Day and night have different themes. Automatic uses the day theme from 6:30 and the night theme from 6:30 in the evening.",
              )}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  ["day", tx("Día", "Day"), Sun],
                  ["night", tx("Noche", "Night"), Moon],
                  ["auto", tx("Automático", "Automatic"), Sunrise],
                ] as const
              ).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => chooseLook({ mode: mode as AppearanceMode })}
                  className={cn(
                    "flex min-h-20 flex-col items-center justify-center gap-1 rounded-md bg-sun px-1 text-xs font-semibold",
                    look.mode === mode && "bz-chosen",
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </button>
              ))}
            </div>
            <details className="group mt-4 rounded-md bg-sun">
              <summary className="flex h-12 cursor-pointer list-none items-center gap-2 px-3 [&::-webkit-details-marker]:hidden">
                <span className="flex-1 font-display text-base font-semibold">{tx("Tema de día", "Day theme")}</span>
                {(() => {
                  const cur = DAY_THEMES.find((theme) => theme.id === look.day) ?? DAY_THEMES[0];
                  return (
                    <span className="flex items-center gap-2 text-sm font-semibold text-muted">
                      <span className={cn("size-5 shrink-0 rounded-full", cur.swatch)} />
                      {tx(cur.es, cur.en)}
                    </span>
                  );
                })()}
                <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid grid-cols-2 gap-2 px-2 pb-2">
              {DAY_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => chooseLook({ day: theme.id })}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-md bg-surface px-2 text-sm font-semibold",
                    look.day === theme.id && "bz-chosen",
                  )}
                >
                  <span className={cn("size-5 shrink-0 rounded-full", theme.swatch)} />
                  <span className="flex-1 text-left">{tx(theme.es, theme.en)}</span>
                  {look.day === theme.id ? <Check className="size-4 shrink-0 text-primary" aria-label={tx("Elegido", "Selected")} /> : null}
                </button>
              ))}
              </div>
            </details>
            <details className="group mt-4 rounded-md bg-sun">
              <summary className="flex h-12 cursor-pointer list-none items-center gap-2 px-3 [&::-webkit-details-marker]:hidden">
                <span className="flex-1 font-display text-base font-semibold">{tx("Tema de noche", "Night theme")}</span>
                {(() => {
                  const cur = NIGHT_THEMES.find((theme) => theme.id === look.night) ?? NIGHT_THEMES[0];
                  return (
                    <span className="flex items-center gap-2 text-sm font-semibold text-muted">
                      <span className={cn("size-5 shrink-0 rounded-full", cur.swatch)} />
                      {tx(cur.es, cur.en)}
                    </span>
                  );
                })()}
                <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid grid-cols-2 gap-2 px-2 pb-2">
              {NIGHT_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => chooseLook({ night: theme.id })}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-md bg-surface px-2 text-sm font-semibold",
                    look.night === theme.id && "bz-chosen",
                  )}
                >
                  <span className={cn("size-5 shrink-0 rounded-full", theme.swatch)} />
                  <span className="flex-1 text-left">{tx(theme.es, theme.en)}</span>
                  {look.night === theme.id ? <Check className="size-4 shrink-0 text-primary" aria-label={tx("Elegido", "Selected")} /> : null}
                </button>
              ))}
              </div>
            </details>
            <h3 className="mt-4 font-display text-base font-semibold">{locale === "en" ? "Language" : "Idioma"}</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["es", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setLocale(code);
                    applyLocale(code);
                    void updateSettings({ data: { locale: code } }).then(() => qc.invalidateQueries({ queryKey: ["settings"] }));
                  }}
                  className={cn("h-11 rounded-md text-sm font-semibold", locale === code ? "bz-pick" : "bg-sun text-muted")}
                >
                  {code === "es" ? t("lang.es") : t("lang.en")}
                </button>
              ))}
            </div>
        </SettingFold>

        <SettingFold
          id="aj-tableta"
          order="order-2"
          query={query}
          blob="modo tableta multitarea pantalla dividida ventana flotante burbuja tablet computer split floating window"
          title={
            <span className="flex items-center gap-2">
              <LayoutGrid className="size-5 shrink-0 text-primary" />
              {tx("Modo tableta", "Tablet mode")}
            </span>
          }
          hint={
            <Hint topic="tableta" />
          }
        >
          <p className="text-sm text-muted">
            {tx(
              "Se enciende solo en pantallas grandes. El botón Vista deja elegir 2, 3 o 4, ponerlas lado a lado o arriba y abajo, y cambiar una ventana por otra. En cada ventana se toca la pestaña. En el teléfono no parte la pantalla.",
              "It turns on by itself on large screens. The View button picks 2, 3, or 4, sets them side by side or top and bottom, and swaps one window for another. Each window has tabs you tap. On the phone the screen stays whole.",
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              const next = !tabletOn;
              setTabletOn(next);
              writeTabletEnabled(next);
            }}
            className={cn(
              "mt-4 flex h-12 w-full items-center justify-between rounded-md px-3 text-sm font-semibold",
              tabletOn ? "bg-done-bg text-done" : "bg-surface-2 text-muted",
            )}
          >
            {tabletOn ? tx("Modo tableta encendido", "Tablet mode on") : tx("Modo tableta apagado", "Tablet mode off")}
          </button>
        </SettingFold>

        <SettingFold
          id="aj-horas"
          order="order-3"
          query={query}
          blob="horas de trabajo entrada salida reloj horario work hours"
          title={
            <span className="flex items-center gap-2">
              <Clock className="size-5 shrink-0 text-primary" />
              {t("hours.title")}
            </span>
          }
          hint={<Hint topic="horas" />}
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              {t("hours.in")}
              <Input
                type="time"
                defaultValue={settings?.workStart ?? "08:00"}
                key={`in-${settings?.workStart ?? "08:00"}`}
                onBlur={(e) => {
                  if (!/^\d{2}:\d{2}$/.test(e.target.value)) return;
                  void updateSettings({ data: { workStart: e.target.value } });
                }}
              />
            </label>
            <label className="text-sm">
              {t("hours.out")}
              <Input
                type="time"
                defaultValue={settings?.workEnd ?? "17:30"}
                key={`out-${settings?.workEnd ?? "17:30"}`}
                onBlur={(e) => {
                  if (!/^\d{2}:\d{2}$/.test(e.target.value)) return;
                  void updateSettings({ data: { workEnd: e.target.value } });
                }}
              />
            </label>
          </div>
        </SettingFold>

        <SoundSettings query={query} />

        <SettingFold
          id="aj-espera"
          order="order-4"
          query={query}
          blob="espera alto riesgo dias monto cortes trabajos waiting high risk cuts"
          title={
            <span className="flex items-center gap-2">
              <Hourglass className="size-5 shrink-0 text-primary" />
              {tx("Espera y alto riesgo", "Waiting and high risk")}
            </span>
          }
          hint={
            <Hint topic="espera" />
          }
        >
          <p className="text-sm text-muted">
            {emphasize(
              tx(
                "El dinero sin pagar se queda en Por cobrar. En espera es alguien que se atrasa y va a pagar. Si pasa estos límites, el caso se pone naranja y entra en Clientes, Alto riesgo. Estos límites se aplican a todos AL INSTANTE: cambiarlos reclasifica a cada cliente en el acto. Y un caso en serio (alto riesgo) deja de recibir visitas nuevas hasta que pague, se le perdone o marques «Seguir atendiendo» en su ficha.",
                "Unpaid money stays in To collect. Waiting is someone who is late and will pay. If they pass these limits, the case turns orange and shows in Clients, High risk. These limits apply to everyone INSTANTLY: changing them reclassifies every client right away. And a serious (high-risk) case stops getting new visits until they pay, are forgiven, or you mark \"Keep serving\" on their file.",
              ),
            )}
          </p>
          <div className="aj-nums mt-3">
            <NumberRow
              label={tx("Días para En espera", "Days for Waiting")}
              sub={tx("Atraso que todavía esperas", "Lateness you still wait out")}
              value={settings?.waitDays ?? 45}
              min={7}
              max={400}
              step={1}
              onCommit={(n) => updateSettings({ data: { waitDays: n } }).then(() => Promise.all([qc.invalidateQueries({ queryKey: ["settings"] }), invalidateLawn(qc)]))}
            />
            <NumberRow
              label={tx("Días para alto riesgo", "Days for high risk")}
              sub={tx("Después de En espera", "After Waiting")}
              value={settings?.riskDays ?? 21}
              min={3}
              max={400}
              step={1}
              onCommit={(n) => updateSettings({ data: { riskDays: n } }).then(() => Promise.all([qc.invalidateQueries({ queryKey: ["settings"] }), invalidateLawn(qc)]))}
            />
            <NumberRow
              label={tx("Monto para alto riesgo", "Amount for high risk")}
              sub={tx("Lo que debe, en total", "What they owe, in total")}
              prefix="$"
              value={settings?.riskAmount ?? 200}
              min={1}
              max={100000}
              step={25}
              onCommit={(n) => updateSettings({ data: { riskAmount: n } }).then(() => Promise.all([qc.invalidateQueries({ queryKey: ["settings"] }), invalidateLawn(qc)]))}
            />
            <NumberRow
              label={tx("Cortes sin pagar", "Unpaid cuts")}
              sub={tx("Cortes o trabajos ya hechos", "Cuts or jobs already done")}
              value={settings?.riskCuts ?? 3}
              min={1}
              max={30}
              step={1}
              onCommit={(n) => updateSettings({ data: { riskCuts: n } }).then(() => Promise.all([qc.invalidateQueries({ queryKey: ["settings"] }), invalidateLawn(qc)]))}
            />
          </div>
          <p className="aj-note mt-3 text-sm">
            {emphasize(
              tx(
                "Basta con que se pase del tiempo, del monto o de los cortes. No tienen que cumplirse a la vez.",
                "It is enough to pass the time, the amount, or the cuts. They do not all have to happen at once.",
              ),
            )}
          </p>
        </SettingFold>

        <SettingFold
          id="aj-recordatorios"
          order="order-6"
          query={query}
          blob="recordatorios avisos notificacion reminders alerts ayer horas"
          title={
            <span className="flex items-center gap-2">
              <Bell className="size-5 shrink-0 text-primary" />
              {tx("Recordatorios", "Reminders")}
            </span>
          }
          hint={<Hint topic="recordatorios" />}
        >
          <p className="text-sm text-muted">
            {tx("Avisos de cortes atrasados y de la hora de llegada cuando abres la app en el teléfono.", "Alerts for late cuts and the arrival time when you open the app on the phone.")}
          </p>
          <button
            type="button"
            onClick={() => void toggleReminders(!(settings?.remindersEnabled ?? false))}
            className={cn(
              "mt-4 flex h-12 w-full items-center justify-between rounded-md px-3 text-sm font-semibold",
              settings?.remindersEnabled ? "bg-done-bg text-done" : "bg-surface-2 text-muted",
            )}
          >
            {settings?.remindersEnabled ? tx("Avisos encendidos", "Alerts on") : tx("Avisos apagados", "Alerts off")}
            <span>{settings?.remindersEnabled ? tx("Sí", "Yes") : tx("No", "No")}</span>
          </button>
          <button
            type="button"
            onClick={() => saveReminders.mutate({ askYesterday: !(settings?.askYesterday ?? true) })}
            className={cn(
              "mt-2 flex h-12 w-full items-center justify-between rounded-md px-3 text-sm font-semibold",
              (settings?.askYesterday ?? true) ? "bg-done-bg text-done" : "bg-surface-2 text-muted",
            )}
          >
            {tx("Confirmar el día anterior", "Confirm the previous day")}
            <span>{(settings?.askYesterday ?? true) ? tx("Sí", "Yes") : tx("No", "No")}</span>
          </button>
          <Label className="mt-3">{tx("Avisar antes de la hora de llegada", "Alert before the arrival time")}</Label>
          <NativeSelect value={settings?.reminderMinutes ?? 60} onChange={(e) => saveReminders.mutate({ reminderMinutes: Number(e.target.value) })}>
            <option value={15}>{tx("15 minutos", "15 minutes")}</option>
            <option value={30}>{tx("30 minutos", "30 minutes")}</option>
            <option value={60}>{tx("1 hora", "1 hour")}</option>
            <option value={120}>{tx("2 horas", "2 hours")}</option>
          </NativeSelect>
        </SettingFold>

        {inAndroidApp() ? <NotifyFold query={query} /> : null}

        <SeasonBlock settings={settings} query={query} />

        <SettingFold
          id="aj-vacaciones"
          order="order-8"
          query={query}
          blob="modo vacaciones descanso viaje time off vacation"
          title={
            <span className="flex items-center gap-2">
              <Palmtree className="size-5 shrink-0 text-primary" />
              {tx("Modo vacaciones", "Time off")}
            </span>
          }
          hint={
            <Hint topic="vacaciones" />
          }
        >
          <p className="text-sm text-muted">
            {settings?.vacationStart
              ? tx(
                  `Activo del ${formatDay(settings.vacationStart, "d MMM")} al ${formatDay(settings.vacationEnd ?? settings.vacationStart, "d MMM")}.`,
                  `On from ${formatDay(settings.vacationStart, "d MMM")} to ${formatDay(settings.vacationEnd ?? settings.vacationStart, "d MMM")}.`,
                )
              : tx("Apagado. Sirve para reacomodar los patios pendientes durante las vacaciones.", "Off. Use it to reschedule pending yards during time off.")}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <Label>{tx("Desde", "From")}</Label>
              <Input type="date" value={vacStart || settings?.vacationStart || todayISO()} onChange={(e) => setVacStart(e.target.value)} />
            </div>
            <div>
              <Label>{tx("Hasta", "Until")}</Label>
              <Input type="date" value={vacEnd || settings?.vacationEnd || addDaysISO(todayISO(), 7)} onChange={(e) => setVacEnd(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button
              disabled={vacMut.isPending}
              onClick={() => {
                const start = vacStart || settings?.vacationStart || todayISO();
                const end = vacEnd || settings?.vacationEnd || addDaysISO(todayISO(), 7);
                setVacStart(start);
                setVacEnd(end);
                vacMut.mutate({ start, end });
              }}
            >
              {settings?.vacationStart ? tx("Actualizar fechas", "Update dates") : tx("Activar vacaciones", "Turn on time off")}
            </Button>
            {settings?.vacationStart ? (
              <Button variant="outline" disabled={vacOff.isPending} onClick={() => vacOff.mutate()}>
                {tx("Quitar vacaciones", "Remove time off")}
              </Button>
            ) : null}
          </div>
        </SettingFold>

        <SettingFold
          id="aj-exportar"
          order="order-10"
          query={query}
          blob="exportar imprimir hojas pdf excel hoja de calculo xlsx compartir contador informe export print sheets worksheet share report accountant"
          title={
            <span className="flex items-center gap-2">
              <Printer className="size-5 shrink-0 text-primary" />
              {tx("Exportar e imprimir", "Export and print")}
            </span>
          }
          hint={
            <Hint topic="exportar" />
          }
        >
          <ExportCenterCard onOpen={exporter.launch} />
        </SettingFold>
        <ExportSheet open={exporter.open} preset={exporter.preset} onClose={exporter.close} />

        <SettingFold
          id="aj-ejemplo"
          order="order-12"
          query={query}
          blob="datos de ejemplo muestra demo probar cargar quitar sample data try load remove"
          title={
            <span className="flex items-center gap-2">
              <FlaskConical className="size-5 shrink-0 text-primary" />
              {tx("Datos de ejemplo", "Sample data")}
            </span>
          }
          hint={<Hint topic="ejemplo" />}
        >
          <SampleSettings />
        </SettingFold>

        <SettingFold
          id="aj-copia"
          order="order-12"
          query={query}
          blob="copia de seguridad respaldo restaurar backup save restore"
          title={
            <span className="flex items-center gap-2">
              <HardDrive className="size-5 shrink-0 text-primary" />
              {tx("Copia de seguridad", "Backup")}
            </span>
          }
          hint={
            <Hint topic="copia" />
          }
        >
          <p className="text-sm text-muted">
            {tx(
              "Se guarda en la cuenta al cambiar datos, al salir y cada pocos minutos. Si nada cambió, no se guarda otra copia igual. Un archivo dañado no reemplaza uno bueno. Si este equipo y la nube chocan, la versión de la nube queda aquí marcada «Nube · conflicto» y también se puede restaurar.",
              "It saves to the account when data changes, when you leave, and every few minutes. If nothing changed, no identical copy is saved. A damaged file does not replace a good one. If this device and the cloud clash, the cloud version stays here labelled “Cloud · conflict” and can be restored too.",
            )}
          </p>
          <p className="mt-3 text-sm">
            {settings?.lastBackupAt
              ? tx(`Última copia: ${formatStamp(settings.lastBackupAt)}`, `Last copy: ${formatStamp(settings.lastBackupAt)}`)
              : tx("Todavía no hay una copia extra.", "There is no extra copy yet.")}{" "}
            · {settings?.clientCount ?? 0} {tx("clientes", "clients")} · {settings?.jobCount ?? 0} {tx("trabajos", "jobs")}
          </p>
          {backupWeightQ.data ? (
            <p className="mt-1 text-sm text-muted">
              {tx(
                `Tus respaldos pesan ${(backupWeightQ.data.bytes / 1048576).toFixed(1)} MB · ${backupWeightQ.data.count} ${backupWeightQ.data.count === 1 ? "copia guardada" : "copias guardadas"}`,
                `Your backups weigh ${(backupWeightQ.data.bytes / 1048576).toFixed(1)} MB · ${backupWeightQ.data.count} ${backupWeightQ.data.count === 1 ? "saved copy" : "saved copies"}`,
              )}
            </p>
          ) : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button onClick={() => backupNow.mutate()} disabled={backupNow.isPending}>
              {tx("Guardar copia ahora", "Save a copy now")}
            </Button>
            <Button variant="outline" onClick={() => download.mutate()} disabled={download.isPending}>
              <Download />
              {tx("Guardar archivo", "Save file")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void pickBackupFolder()
                  .then((ok) => {
                    if (!ok) {
                      toast.error(tx("Este navegador no deja elegir carpeta. El archivo se descarga igual.", "This browser does not let you choose a folder. The file still downloads."));
                      return;
                    }
                    toast.success(tx("Carpeta lista. Cada copia nueva deja solo las 5 más recientes.", "Folder ready. Each new copy keeps only the 5 most recent."));
                  })
                  .catch((err: unknown) => {
                    if (err instanceof Error && err.name === "AbortError") return;
                    toast.error(tx("No se pudo elegir la carpeta", "Could not choose the folder"));
                  });
              }}
            >
              {tx("Elegir carpeta", "Choose folder")}
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload />
              {tx("Restaurar archivo", "Restore file")}
            </Button>
          </div>
          <div className="pointer-events-none h-0 overflow-hidden">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void file.text().then((text) => {
                  try {
                    JSON.parse(text);
                    setRestoreJson(text);
                  } catch {
                    toast.error(tx("Ese archivo no es una copia válida", "That file is not a valid copy"));
                  }
                });
              }}
            />
          </div>
          {(backupsQ.data ?? []).length > 0 ? (
            <ul className="mt-4 grid gap-2">
              {(backupsQ.data ?? []).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 rounded-md bg-sun px-3 py-2">
                  <p className="text-sm text-muted">
                    {tx(
                      `${formatStamp(b.createdAt)} · ${b.clientCount} clientes · ${b.jobCount} trabajos`,
                      `${formatStamp(b.createdAt)} · ${b.clientCount} clients · ${b.jobCount} jobs`,
                    )}
                    {b.source === "cloud" ? (
                      <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-fg">
                        {tx("Nube · conflicto", "Cloud · conflict")}
                      </span>
                    ) : null}
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setRestoreTarget(b)}>
                    <RotateCcw />
                    {tx("Restaurar", "Restore")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </SettingFold>

        <ConfirmDialog
          open={Boolean(restoreTarget)}
          title={tx("¿Restaurar esta copia?", "Restore this copy?")}
          description={tx(
            `Se reemplazan los clientes y trabajos actuales por los de ${restoreTarget ? formatStamp(restoreTarget.createdAt) : ""}. Antes se guarda una copia de lo que hay ahora, por si quieres volver.`,
            `Current clients and jobs are replaced by those from ${restoreTarget ? formatStamp(restoreTarget.createdAt) : ""}. A copy of what is there now is saved first, in case you want to go back.`,
          )}
          confirmLabel={tx("Sí, restaurar", "Yes, restore")}
          danger
          pending={restore.isPending}
          onConfirm={() => restoreTarget && restore.mutate(restoreTarget.id)}
          onCancel={() => setRestoreTarget(null)}
        />
        <ConfirmDialog
          open={Boolean(restoreJson)}
          title={tx("¿Restaurar el archivo?", "Restore the file?")}
          description={tx("Reemplaza los datos actuales por los del archivo. Antes se guarda una copia de lo que hay ahora.", "It replaces the current data with the file. A copy of what is there now is saved first.")}
          confirmLabel={tx("Sí, restaurar archivo", "Yes, restore file")}
          danger
          pending={restoreFile.isPending}
          onConfirm={() => restoreJson && restoreFile.mutate(restoreJson)}
          onCancel={() => setRestoreJson(null)}
        />
        {!query || smartHit(query, "manual ayuda usuario user guide") ? (
          <UserManual onLocale={setLocale} forceOpen={Boolean(query)} />
        ) : null}
        {!query || smartHit(query, "salir cerrar sesion cuenta sign out huella fingerprint nube sincronizar sync cloud") ? (
        <div className="order-14" data-masonry-under="aj-ejemplo">
          <SyncStatusCard />
          <FingerprintControl />
        </div>
        ) : null}
        {!query || smartHit(query, "salir cerrar sesion cuenta sign out huella fingerprint nube sincronizar sync cloud") ? (
        <section className="order-14 rounded-xl" data-spot-alt="nube huella">
          <SignOutControl full />
          <p className="mt-2 text-center text-xs text-muted">
            {tx("La cuenta y los clientes quedan en la nube y en este equipo. Entras otra vez con el mismo correo.", "The account and the clients stay in the cloud and on this device. Sign in again with the same email.")}
          </p>
        </section>
        ) : null}
      </Masonry>
    </AppShell>
  );
}

/* 1.4.97 Brizna for Android only: local reminders, battery protection and the Hoy widget. */
function NotifyFold({ query }: { query: string }) {
  const tx = useTx();
  const rank = useAjustesRank("aj-recordatorios");
  const [prefs, setPrefs] = useState<NotifyPrefs>(() => readNotifyPrefs());
  const [st, setSt] = useState<NativeNotifyStatus | null>(() => nativeNotifyStatus());
  useEffect(() => {
    const read = () => setSt(nativeNotifyStatus());
    window.addEventListener("briznanative-status", read);
    document.addEventListener("visibilitychange", read);
    const t = window.setInterval(read, 4000);
    return () => { window.removeEventListener("briznanative-status", read); document.removeEventListener("visibilitychange", read); window.clearInterval(t); };
  }, []);
  if (query && !smartHit(query, "notificaciones avisos recordatorios bateria batería alarma widget hoy notifications battery")) return null;
  const n = native();
  const set = (patch: Partial<NotifyPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeNotifyPrefs(next);
    refreshNativeSoon(300);
  };
  const allowed = st?.permission === "granted";
  const anyOn = prefs.cuts || prefs.pay || prefs.risk || prefs.rain;
  const morning = formatClock(MORNING, tx);
  const types: { key: "cuts" | "pay" | "risk" | "rain"; label: string; sub: string }[] = [
    { key: "cuts", label: tx("Cortes de mañana", "Tomorrow's cuts"), sub: tx("La noche antes, a tu hora", "The night before, at your hour") },
    { key: "pay", label: tx("Días de pago", "Pay days"), sub: tx(`El día que pagan, ${morning}`, `On their pay day, ${morning}`) },
    { key: "risk", label: tx("Atrasados y Alto riesgo", "Late and high risk"), sub: tx(`Cada mañana que haya, ${morning}`, `Each morning there are any, ${morning}`) },
    { key: "rain", label: tx("Parada por lluvia", "Rain stop"), sub: tx(`El día al que pasaron, ${morning}`, `The day they moved to, ${morning}`) },
  ];
  const nextLine = st?.next ? nextWhen(st.next, tx) : null;
  return (
    <Fold
      id="aj-notificaciones"
      forceOpen={Boolean(query)}
      className="mb-4 aj-notif"
      chevronEnd
      style={{ order: rank }}
      titleClassName="text-lg"
      contentClassName="px-4 pb-4"
      title={
        <span className="flex items-center gap-2">
          <BellRing className="size-5 shrink-0 text-primary" />
          {tx("Notificaciones", "Notifications")}
        </span>
      }
      hint={<Hint topic="notificaciones" />}
      peek={<span className={`text-xs font-semibold ${allowed && anyOn ? "text-primary" : "text-muted"}`}>{allowed && anyOn ? tx("encendidas", "on") : tx("apagadas", "off")}</span>}
    >
      <div className="aj-nums">
        <div className="aj-num">
          <Bell className="size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="aj-num-label">{tx("Avisos del teléfono", "Phone alerts")}</p>
            <p className="aj-num-sub">{allowed ? tx("Permitidos", "Allowed") : tx("Brizna aún no puede avisarte", "Brizna can't alert you yet")}</p>
          </div>
          {allowed ? <span className="aj-ok"><Check aria-hidden />{tx("Listo", "Ready")}</span> : (
            <button type="button" className="aj-act" onClick={() => n?.requestNotify?.()}>{tx("Permitir", "Allow")}</button>
          )}
        </div>
        <div className="aj-num">
          <BatteryCharging className="size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="aj-num-label">{st?.battery ? tx("Protegida de la batería", "Safe from battery saving") : tx("Ahorro de batería", "Battery saving")}</p>
            <p className="aj-num-sub">{st?.battery ? tx("Llegan aunque no la abras", "They arrive even if closed") : tx("Puede frenar los avisos", "It may hold alerts back")}</p>
          </div>
          {st?.battery ? <span className="aj-ok"><Check aria-hidden />{tx("Listo", "Ready")}</span> : (
            <button type="button" className="aj-act" onClick={() => n?.requestBattery?.()}>{tx("Proteger", "Protect")}</button>
          )}
        </div>
        {st && !st.exact ? (
          <div className="aj-num">
            <Clock className="size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="aj-num-label">{tx("Hora exacta", "Exact time")}</p>
              <p className="aj-num-sub">{tx("Si no, llegan algo tarde", "Otherwise they come late")}</p>
            </div>
            <button type="button" className="aj-act" onClick={() => n?.requestExact?.()}>{tx("Permitir", "Allow")}</button>
          </div>
        ) : null}
      </div>
      {st?.samsung ? (
        <p className="aj-fine mt-2">
          {tx("En Samsung, añade Brizna en Ajustes\u00a0›\u00a0Batería\u00a0›\u00a0Apps que nunca se suspenden.", "On Samsung, add Brizna in Settings\u00a0›\u00a0Battery\u00a0›\u00a0Never sleeping apps.")}{" "}
          <button type="button" className="aj-link" onClick={() => n?.openAppSettings?.()}>{tx("Abrir", "Open")}</button>
        </p>
      ) : null}

      <div className="aj-nums mt-3">
        {types.map((t) => (
          <div className="aj-num" key={t.key}>
            <div className="min-w-0 flex-1">
              <p className="aj-num-label">{t.label}</p>
              <p className="aj-num-sub">{t.sub}</p>
            </div>
            <button type="button" role="switch" aria-checked={prefs[t.key]} aria-label={t.label} onClick={() => set({ [t.key]: !prefs[t.key] })} className={cn("aj-switch", prefs[t.key] && "is-on")}>
              <span />
            </button>
          </div>
        ))}
        <div className="aj-num">
          <div className="min-w-0 flex-1">
            <p className="aj-num-label">{tx("Aviso de la noche", "Evening alert")}</p>
            <p className="aj-num-sub">{tx("Para los cortes de mañana", "For tomorrow's cuts")}</p>
          </div>
          <PickerField type="time" className="aj-pf" value={prefs.hour.padStart(5, "0")} onChange={(e) => e.target.value && set({ hour: e.target.value.slice(0, 5) })} required />
        </div>
      </div>
      <div className="aj-notif-foot mt-3">
        <p className="aj-fine min-w-0 flex-1">
          {!allowed ? tx("Permite los avisos para recibirlos.", "Allow alerts to get them.") : nextLine ? tx(`Próximo: ${nextLine}`, `Next: ${nextLine}`) : anyOn ? tx("Sin avisos pendientes por ahora.", "No alerts due for now.") : tx("Todos los avisos están apagados.", "All alerts are off.")}
        </p>
        <button
          type="button"
          className="aj-act"
          disabled={!allowed}
          onClick={() => {
            n?.testNotify?.(5000, tx("Brizna: aviso de prueba", "Brizna: test alert"), tx("Así llegan los avisos, aunque Brizna esté cerrada.", "This is how alerts arrive, even with Brizna closed."));
            toast(tx("Llega en 5 segundos. Puedes cerrar la app.", "It arrives in 5 seconds. You can close the app."));
          }}
        >
          {tx("Probar", "Test")}
        </button>
      </div>
      <p className="aj-fine mt-2">{tx("Widget Hoy: mantén pulsado el inicio\u00a0›\u00a0Widgets\u00a0›\u00a0Brizna.", "Hoy widget: hold the home screen\u00a0›\u00a0Widgets\u00a0›\u00a0Brizna.")}</p>
    </Fold>
  );
}

function formatClock(hhmm: string, tx: (es: string, en: string) => string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const pm = h! >= 12;
  const h12 = h! % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")}\u00a0${pm ? tx("p.\u00a0m.", "PM") : tx("a.\u00a0m.", "AM")}`;
}

function nextWhen(ms: number, tx: (es: string, en: string) => string): string {
  const d = new Date(ms);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86_400_000);
  const clock = formatClock(`${d.getHours()}:${d.getMinutes()}`, tx);
  if (diff <= 0) return tx(`hoy, ${clock}`, `today, ${clock}`);
  if (diff === 1) return tx(`mañana, ${clock}`, `tomorrow, ${clock}`);
  const wd = d.toLocaleDateString(tx("es", "en"), { weekday: "long" });
  return tx(`${wd}, ${clock}`, `${wd}, ${clock}`);
}

function SeasonBlock({ settings, query }: { settings?: AppSettings; query: string }) {
  const tx = useTx();
  const qc = useQueryClient();
  const [on, setOn] = useState(Boolean(settings?.seasonStart && settings?.seasonEnd && settings?.seasonEvery));
  const [start, setStart] = useState(settings?.seasonStart ?? "11-01");
  const [end, setEnd] = useState(settings?.seasonEnd ?? "02-28");
  const [every, setEvery] = useState(String(settings?.seasonEvery ?? 21));
  const [horizon, setHorizon] = useState(String(settings?.horizonMonths ?? 12));
  return (
    <SettingFold
      id="aj-temporada"
      order="order-7"
      query={query}
      blob="temporada para todos invierno ritmo meses horizonte season"
      title={
        <span className="flex items-center gap-2">
          <CalendarRange className="size-5 shrink-0 text-primary" />
          {tx("Temporada para todos", "Season for everyone")}
        </span>
      }
      hint={
        <Hint topic="temporada" />
      }
    >
      <p className="text-sm text-muted">
        {tx(
          "Cambia el ritmo de todos los patios durante una parte del año. Por ejemplo, cada 21 días en invierno.",
          "Changes the pace of every yard for part of the year. For example, every 21 days in winter.",
        )}
      </p>
      <div className="aj-nums mt-3">
        <div className="aj-num">
          <div className="min-w-0 flex-1">
            <p className="aj-num-label">{tx("Usar temporada", "Use a season")}</p>
            <p className="aj-num-sub">{tx("El mismo ritmo para todos", "The same pace for everyone")}</p>
          </div>
          <button type="button" role="switch" aria-checked={on} onClick={() => setOn(!on)} className={cn("aj-switch", on && "is-on")}>
            <span />
          </button>
        </div>
        {on ? (
          <>
            <div className="aj-num">
              <div className="min-w-0 flex-1">
                <p className="aj-num-label">{tx("Empieza", "Starts")}</p>
                <p className="aj-num-sub">{tx("Cada año, ese día", "Every year, that day")}</p>
              </div>
              <PickerField type="date" noYear className="aj-pf" value={mdToIso(start)} onChange={(e) => e.target.value && setStart(e.target.value.slice(5))} required />
            </div>
            <div className="aj-num">
              <div className="min-w-0 flex-1">
                <p className="aj-num-label">{tx("Termina", "Ends")}</p>
                <p className="aj-num-sub">{tx("Luego vuelve el ritmo de siempre", "Then the usual pace returns")}</p>
              </div>
              <PickerField type="date" noYear className="aj-pf" value={mdToIso(end)} onChange={(e) => e.target.value && setEnd(e.target.value.slice(5))} required />
            </div>
            <NumberRow
              label={tx("Cada cuántos días", "Every how many days")}
              sub={tx("Durante la temporada", "During the season")}
              value={Number(every) || 21}
              min={7}
              max={60}
              step={1}
              onCommit={(n) => setEvery(String(n))}
            />
          </>
        ) : null}
        <NumberRow
          label={tx("Meses por delante", "Months ahead")}
          sub={tx("Hasta dónde llega la agenda", "How far the schedule reaches")}
          value={Number(horizon) || 12}
          min={4}
          max={18}
          step={1}
          onCommit={(n) => setHorizon(String(n))}
        />
      </div>
      <p className="aj-fine mt-2">
        {tx(
          "Un cliente puede tener su propia temporada. Los patios que ya moviste se quedan donde están. La temporada necesita las fechas Y el ritmo (cada cuántos días): sin ritmo, las fechas solas no cambian nada. Guardar — también si solo cambias el fin — regenera la agenda.",
          "A client can have their own season. Yards you already moved stay where they are. A season needs the dates AND the pace (every how many days): dates alone change nothing. Saving — even if you only change the end — rebuilds the schedule.",
        )}
      </p>
      <Button
        className="mt-3 w-full"
        onClick={() => {
          if (on && (!start || !end || !(Number(every) > 0))) {
            toast.error(tx("La temporada necesita fecha de inicio, fecha de fin y ritmo (cada cuántos días).", "A season needs a start date, an end date and a pace (every how many days)."));
            return;
          }
          const months = Number(horizon);
          void updateSettings({
            data: {
              horizonMonths: months >= 4 && months <= 18 ? months : 12,
              seasonStart: on ? start : null,
              seasonEnd: on ? end : null,
              seasonEvery: on ? Number(every) || 21 : null,
            },
          }).then(async () => {
            toast.success(tx("Temporada guardada", "Season saved"));
            await qc.invalidateQueries({ queryKey: ["settings"] });
            await invalidateLawn(qc);
          });
        }}
      >
        {tx("Guardar temporada", "Save season")}
      </Button>
    </SettingFold>
  );
}
