import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Bell, CalendarRange, Clock, Download, FileSpreadsheet, HardDrive, Hourglass, LayoutGrid, Moon, Palette, Palmtree, Printer, RotateCcw, Store, Sun, Sunrise, Upload, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell, SignOutControl, TitleSearch } from "@/components/app-shell";
import { FingerprintControl } from "@/components/fingerprint-control";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Fold, foldsOpen, setFoldsOpen } from "@/components/fold";
import { Hint } from "@/components/hint";
import { invalidateLawn } from "@/components/job-card";
import { SoundSettings } from "@/components/settings-finder";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { SettingsOrderButton } from "@/components/settings-order-button";
import { useAjustesRank } from "@/lib/ajustes-order";
import { useUndo } from "@/lib/undo";
import { UserManual } from "@/components/user-manual";
import { addDaysISO, endOfWeekISO, lastDayOfMonthISO, monthParts, startOfWeekISO, todayISO } from "@/lib/dates";
import { formatDay, formatStamp } from "@/lib/format";
import { emphasize, useI18n, useTx } from "@/lib/i18n";
import { smartHit } from "@/lib/fuzzy";
import { notificationsSupported, requestNotificationPermission } from "@/lib/reminders";
import { pickBackupFolder, saveBinaryFile, saveCsvFile, writeBackupBundle } from "@/lib/save-file";
import {
  applyVacation,
  clearVacation,
  exportBackup,
  exportReport,
  exportScope,
  exportSheets,
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
  { id: "bosque", es: "Bosque", en: "Forest", swatch: "swatch-bosque" },
  { id: "mar", es: "Mar", en: "Sea", swatch: "swatch-mar" },
  { id: "brasa", es: "Brasa", en: "Ember", swatch: "swatch-brasa" },
  { id: "tinta", es: "Tinta", en: "Ink", swatch: "swatch-tinta" },
  { id: "luna", es: "Luna", en: "Moon", swatch: "swatch-luna" },
  { id: "amoled", es: "AMOLED", en: "AMOLED", swatch: "swatch-amoled" },
];

const SERVER_PALETTES = new Set<PaletteName>(["jardin", "costa", "barro", "pino", "cielo"]);

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
      className="mb-6"
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
  const [expandAll, setExpandAll] = useState(() => foldsOpen("aj-"));
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
  const sheets = useMutation({
    mutationFn: () => exportSheets(),
    onSuccess: async (payload) => {
      try {
        await saveCsvFile(`clientes-${payload.stamp}.csv`, payload.clientsCsv);
        await saveCsvFile(`citas-pendientes-${payload.stamp}.csv`, payload.jobsCsv);
        toast.success(
          tx(
            `Hojas listas: ${payload.clientCount} clientes y ${payload.jobCount} citas pendientes.`,
            `Sheets ready: ${payload.clientCount} clients and ${payload.jobCount} pending appointments.`,
          ),
        );
      } catch (err) {
        if ((err instanceof Error ? err.name : "") === "AbortError") return;
        toast.error(tx("No se pudieron guardar las hojas", "Could not save the sheets"));
      }
    },
  });
  const report = useMutation({
    mutationFn: () => exportReport(),
    onSuccess: async (file) => {
      try {
        const pdf = Uint8Array.from(atob(file.pdf), (c) => c.charCodeAt(0));
        const xls = Uint8Array.from(atob(file.xls), (c) => c.charCodeAt(0));
        await saveBinaryFile(`Brizna_Informe_${file.today}.pdf`, pdf, "Informe PDF", ".pdf", "application/pdf");
        await saveBinaryFile(`Brizna_Libro_${file.today}.xls`, xls, "Libro de Excel", ".xls", "application/vnd.ms-excel");
        toast.success(tx("Informe y libro listos.", "Report and workbook ready."));
      } catch (err) {
        if ((err instanceof Error ? err.name : "") === "AbortError") return;
        toast.error(tx("No se pudo guardar el informe", "Could not save the report"));
      }
    },
    onError: () => toast.error(tx("No se pudo preparar el informe", "Could not prepare the report")),
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
        <TitleSearch
          open={findOn}
          onToggle={() => setFindOn((value) => !value)}
          value={needle}
          onChange={setNeedle}
          placeholder={tx("Buscar un ajuste", "Search a setting")}
          label={tx("Buscar en Ajustes", "Search settings")}
        />
      }
    >
      <div className="flex flex-col">
        <div className="mb-3 flex items-center gap-1.5 px-2">
          <label className="flex min-h-11 shrink-0 items-center gap-1.5 text-xs font-semibold text-muted">
            <input
              type="checkbox"
              className="m-0 size-4 shrink-0 accent-primary"
              checked={expandAll}
              aria-label={tx("Desplegar todo", "Expand all")}
              onChange={(e) => {
                const open = e.target.checked;
                setExpandAll(open);
                setFoldsOpen("aj-", open);
              }}
            />
            {tx("Desplegar todo", "Expand all")}
          </label>
          <Hint
            manual="ajustes"
            text={tx(
              "Abre o cierra de una vez todos los ajustes de esta página. La casilla queda alineada con las flechas de abajo.",
              "Opens or closes every setting on this page at once. The box lines up with the arrows below.",
            )}
          />
        </div>
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
          blob="tema pantalla dia noche automatico idioma language colores jardin costa barro pino cielo lima arena flor bosque mar brasa tinta luna amoled theme screen day night"
          title={
            <span className="flex items-center gap-2">
              <Palette className="size-5 shrink-0 text-primary" />
              {tx("Tema", "Theme")}
            </span>
          }
          hint={
            <Hint
              text={tx(
                "El tema de día y el de noche se quedan como los dejes, aunque bajes la pantalla para refrescar.",
                "The day theme and the night theme stay as you left them, even if you pull to refresh.",
              )}
            />
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
                    look.mode === mode && "ring-2 ring-primary",
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </button>
              ))}
            </div>
            <h3 className="mt-4 font-display text-base font-semibold">{tx("Tema de día", "Day theme")}</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {DAY_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => chooseLook({ day: theme.id })}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-md bg-sun px-2 text-sm font-semibold",
                    look.day === theme.id && "ring-2 ring-primary",
                  )}
                >
                  <span className={cn("size-5 shrink-0 rounded-full border border-border", theme.swatch)} />
                  {tx(theme.es, theme.en)}
                </button>
              ))}
            </div>
            <h3 className="mt-4 font-display text-base font-semibold">{tx("Tema de noche", "Night theme")}</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {NIGHT_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => chooseLook({ night: theme.id })}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-md bg-sun px-2 text-sm font-semibold",
                    look.night === theme.id && "ring-2 ring-primary",
                  )}
                >
                  <span className={cn("size-5 shrink-0 rounded-full border border-border", theme.swatch)} />
                  {tx(theme.es, theme.en)}
                </button>
              ))}
            </div>
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
                  className={cn("h-11 rounded-md text-sm font-semibold", locale === code ? "bg-primary text-primary-fg" : "bg-sun text-muted")}
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
          blob="modo tableta multitarea cuadrantes pantalla grande tablet computer split"
          title={
            <span className="flex items-center gap-2">
              <LayoutGrid className="size-5 shrink-0 text-primary" />
              {tx("Modo tableta", "Tablet mode")}
            </span>
          }
          hint={
            <Hint
              manual="ajustes"
              text={tx(
                "En tableta o computadora parte la pantalla en dos, tres o cuatro. Cada ventana cambia de pestaña al tocarla, y lo que hagas en una se ve al momento en las otras.",
                "On a tablet or computer it splits the screen into two, three, or four. Each window changes tab when you tap it, and what you do in one shows up right away in the others.",
              )}
            />
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
          hint={<Hint manual="horas" text={t("hours.auto")} />}
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
            <Hint
              manual="espera"
              text={tx(
                "En espera es alguien que se atrasó y va a pagar. Alto riesgo es cuando pasa los días, el monto o los cortes sin pagar que pongas aquí. El dinero sigue en Por cobrar. Solo la función Perdonar lo borra.",
                "Waiting is someone who is late and will pay. High risk is when they pass the days, the amount, or the unpaid cuts you set here. The money stays in To collect. Only the Forgive function clears it.",
              )}
            />
          }
        >
          <p className="text-sm text-muted">
            {emphasize(
              tx(
                "El dinero sin pagar se queda en Por cobrar. En espera es alguien que se atrasa y va a pagar. Si pasa estos límites, el caso se pone naranja y entra en Clientes, Alto riesgo.",
                "Unpaid money stays in To collect. Waiting is someone who is late and will pay. If they pass these limits, the case turns orange and shows in Clients, High risk.",
              ),
            )}
          </p>
          <Label className="mt-3">{tx("Días para En espera", "Days for Waiting")}</Label>
          <Input
            type="number"
            min={7}
            max={400}
            key={`wait-${settings?.waitDays ?? 45}`}
            defaultValue={settings?.waitDays ?? 45}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n) || n < 7 || n > 400 || n === settings?.waitDays) return;
              void updateSettings({ data: { waitDays: n } }).then(() => qc.invalidateQueries({ queryKey: ["settings"] }));
            }}
          />
          <Label className="mt-3">{tx("Días para alto riesgo", "Days for high risk")}</Label>
          <Input
            type="number"
            min={3}
            max={400}
            key={`risk-${settings?.riskDays ?? 21}`}
            defaultValue={settings?.riskDays ?? 21}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n) || n < 3 || n > 400 || n === settings?.riskDays) return;
              void updateSettings({ data: { riskDays: n } }).then(() => qc.invalidateQueries({ queryKey: ["settings"] }));
            }}
          />
          <Label className="mt-3">{tx("Monto para alto riesgo", "Amount for high risk")}</Label>
          <Input
            type="number"
            min={1}
            max={100000}
            key={`amt-${settings?.riskAmount ?? 200}`}
            defaultValue={settings?.riskAmount ?? 200}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n) || n < 1 || n === settings?.riskAmount) return;
              void updateSettings({ data: { riskAmount: n } }).then(() => qc.invalidateQueries({ queryKey: ["settings"] }));
            }}
          />
          <Label className="mt-3">{tx("Cortes o trabajos sin pagar", "Unpaid cuts or jobs")}</Label>
          <Input
            type="number"
            min={1}
            max={30}
            key={`cuts-${settings?.riskCuts ?? 3}`}
            defaultValue={settings?.riskCuts ?? 3}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n) || n < 1 || n > 30 || n === settings?.riskCuts) return;
              void updateSettings({ data: { riskCuts: n } }).then(() => qc.invalidateQueries({ queryKey: ["settings"] }));
            }}
          />
          <p className="mt-1 text-xs text-muted">
            {emphasize(
              tx(
                "Si todavía debe después de este número de cortes o trabajos hechos, pasa a Alto riesgo.",
                "If they still owe after this many finished cuts or jobs, they become High risk.",
              ),
            )}
          </p>
          <p className="mt-3 text-sm text-muted">
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
          hint={<Hint text={tx("Avisos cuando abres la app: cortes atrasados y la hora de llegada del patio.", "Alerts when you open the app: late cuts and the yard arrival time.")} />}
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
            <Hint
              text={tx(
                "Elige ida y vuelta. Todo lo pendiente de esas fechas, y lo atrasado, se pasa al día del regreso. Si acortas o alargas las fechas, la agenda se reacomoda sola.",
                "Choose departure and return. Everything pending on those dates, and what is late, moves to the return day. If you shorten or lengthen the dates, the schedule rearranges itself.",
              )}
            />
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
          id="aj-hojas"
          order="order-10"
          query={query}
          blob="hojas para imprimir papel pdf excel sheets to print"
          title={
            <span className="flex items-center gap-2">
              <Printer className="size-5 shrink-0 text-primary" />
              {tx("Hojas para imprimir", "Sheets to print")}
            </span>
          }
          hint={
            <Hint
              text={tx(
                "Dos archivos de cálculo: todos los clientes y las citas pendientes. Ábrelos en Excel o imprímelos. También hay una vista lista para imprimir.",
                "Two spreadsheet files: all clients and the pending appointments. Open them in Excel or print them. There is also a view ready to print.",
              )}
            />
          }
        >
          <p className="text-sm text-muted">{tx("Respaldo físico por si hace falta llevar el trabajo en papel.", "A paper backup in case you need to take the work on paper.")}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button onClick={() => sheets.mutate()} disabled={sheets.isPending}>
              <Download />
              {tx("Exportar hojas", "Export sheets")}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/imprimir" search={{}}>
                <Printer />
                {tx("Vista para imprimir", "Print view")}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => report.mutate()} disabled={report.isPending}>
              <FileSpreadsheet />
              {tx("PDF y Excel", "PDF and Excel")}
            </Button>
          </div>
        </SettingFold>

        <ExportBlock query={query} />

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
            <Hint
              text={tx(
                "Guardar copia deja un respaldo en tu cuenta. Restaurar reemplaza clientes y trabajos actuales por los de esa copia.",
                "Save copy keeps a backup in your account. Restore replaces current clients and jobs with those from that copy.",
              )}
            />
          }
        >
          <p className="text-sm text-muted">
            {tx(
              "Se guarda en la cuenta al cambiar datos, al salir y cada pocos minutos. Un archivo dañado no reemplaza uno bueno.",
              "It saves to the account when data changes, when you leave, and every few minutes. A damaged file does not replace a good one.",
            )}
          </p>
          <p className="mt-3 text-sm">
            {settings?.lastBackupAt
              ? tx(`Última copia: ${formatStamp(settings.lastBackupAt)}`, `Last copy: ${formatStamp(settings.lastBackupAt)}`)
              : tx("Todavía no hay una copia extra.", "There is no extra copy yet.")}{" "}
            · {settings?.clientCount ?? 0} {tx("clientes", "clients")} · {settings?.jobCount ?? 0} {tx("trabajos", "jobs")}
          </p>
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
        {!query || smartHit(query, "salir cerrar sesion cuenta sign out huella fingerprint") ? (
        <section className="order-14 mt-6">
          <FingerprintControl />
          <SignOutControl full />
          <p className="mt-2 text-center text-xs text-muted">
            {tx("La cuenta y los clientes quedan en la nube y en este equipo. Entras otra vez con el mismo correo de Faro y Vela.", "The account and the clients stay in the cloud and on this device. Sign in again with the same email as Faro and Vela.")}
          </p>
        </section>
        ) : null}
      </div>
    </AppShell>
  );
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
        <Hint
          manual="temporada"
          text={tx(
            "Es un tramo del año en el que todos los cortes regulares se espacian más, sin cambiar cada ficha. Por ejemplo, de noviembre a febrero cada 21 días. Un cliente puede tener su propio ritmo. Los patios que ya moviste no vuelven atrás.",
            "It is a stretch of the year when every regular cut is spaced out, without editing each file. For example, November through February every 21 days. A client can keep their own pace. Yards you already moved do not jump back.",
          )}
        />
      }
    >
      <p className="text-sm text-muted">
        {tx(
          "Un tramo del año con otro ritmo, sin reescribir cada ficha. Un cliente puede tener la suya. Los patios que ya moviste no vuelven al día viejo.",
          "A stretch of the year with a different pace, without rewriting each file. A client can have their own. Yards you already moved do not go back to the old day.",
        )}
      </p>
      <label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-5 accent-primary" />
        {tx("Usar temporada general", "Use the general season")}
      </label>
      {on ? (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Input value={start} onChange={(e) => setStart(e.target.value)} placeholder="11-01" />
          <Input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="02-28" />
          <Input type="number" min={7} max={60} value={every} onChange={(e) => setEvery(e.target.value)} />
        </div>
      ) : null}
      <Label className="mt-3">{tx("Meses por delante", "Months ahead")}</Label>
      <Input type="number" min={4} max={18} value={horizon} onChange={(e) => setHorizon(e.target.value)} />
      <Button
        className="mt-3"
        onClick={() => {
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

function ExportBlock({ query }: { query: string }) {
  const tx = useTx();
  const today = todayISO();
  const { year, month } = monthParts(today);
  const [scope, setScope] = useState("month");
  const [y1, setY1] = useState(String(year));
  const [y2, setY2] = useState(String(year));
  const range = (() => {
    if (scope === "all") return { from: "1970-01-01", to: "2999-12-31" };
    if (scope === "week") return { from: startOfWeekISO(today), to: endOfWeekISO(today) };
    if (scope === "month") return { from: `${year}-${String(month).padStart(2, "0")}-01`, to: lastDayOfMonthISO(year, month) };
    if (scope === "year") return { from: `${year}-01-01`, to: `${year}-12-31` };
    const a = Math.min(Number(y1) || year, Number(y2) || year);
    const b = Math.max(Number(y1) || year, Number(y2) || year);
    return { from: `${a}-01-01`, to: `${b}-12-31` };
  })();
  const excel = useMutation({
    mutationFn: () => exportScope({ data: range }),
    onSuccess: async (res) => {
      await saveCsvFile(`oscar-${res.from ?? "todo"}-${res.to ?? "todo"}.csv`, res.csv);
      toast.success(tx("Hoja lista. Ábrela en Excel.", "Sheet ready. Open it in Excel."));
    },
    onError: () => toast.error(tx("No se pudo exportar.", "Could not export.")),
  });
  return (
    <SettingFold
      id="aj-exportar"
      order="order-11"
      query={query}
      blob="exportar un tramo excel csv pdf semana mes ano export"
      title={
        <span className="flex items-center gap-2">
          <FileSpreadsheet className="size-5 shrink-0 text-primary" />
          {tx("Exportar un tramo", "Export a stretch")}
        </span>
      }
      hint={
        <Hint
          text={tx(
            "Elige el tramo y exporta una hoja. El PDF sale al imprimir la vista.",
            "Pick the stretch and export a sheet. The PDF comes from printing the view.",
          )}
        />
      }
    >
      <p className="text-sm text-muted">
        {tx("Semana, mes, año, varios años o todo. El PDF usa las páginas que hagan falta al imprimir.", "Week, month, year, several years, or everything. The PDF uses as many pages as printing needs.")}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(
          [
            ["week", tx("Semana", "Week")],
            ["month", tx("Mes", "Month")],
            ["year", tx("Año", "Year")],
            ["years", tx("Años", "Years")],
            ["all", tx("Todo", "All")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setScope(id)}
            className={cn("h-9 rounded-full px-3 text-xs font-semibold", scope === id ? "bg-soil text-primary-fg" : "bg-sun text-muted")}
          >
            {label}
          </button>
        ))}
      </div>
      {scope === "years" ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Input type="number" value={y1} onChange={(e) => setY1(e.target.value)} />
          <Input type="number" value={y2} onChange={(e) => setY2(e.target.value)} />
        </div>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button onClick={() => excel.mutate()} disabled={excel.isPending}>
          <Download />
          Excel
        </Button>
        <Button variant="outline" asChild>
          <Link to="/imprimir" search={range}>
            <Printer />
            PDF
          </Link>
        </Button>
      </div>
    </SettingFold>
  );
}
