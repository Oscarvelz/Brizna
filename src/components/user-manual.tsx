import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Fold } from "@/components/fold";
import { NameLink, nameDest, nameLinkTerms } from "@/components/name-jump";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { smartHit } from "@/lib/fuzzy";
import { MANUAL, useI18n } from "@/lib/i18n";
import { updateSettings } from "@/lib/server/lawn";
import { applyLocale, applyTheme } from "@/lib/theme";
import type { LocaleName, PaletteName, ThemeName } from "@/lib/types";

const GROUPS = [
  { es: "Día de trabajo", en: "Work day", ids: ["hoy", "vistas", "hecho", "lluvia", "horas", "todos", "sonidos"] },
  { es: "Dinero", en: "Money", ids: ["cobros", "propina", "precio"] },
  { es: "Clientes", en: "Clients", ids: ["una-vez"] },
  { es: "Agenda", en: "Schedule", ids: ["agenda"] },
  { es: "Bloc de notas", en: "Notepad", ids: ["notas"] },
  { es: "Cifras", en: "Figures", ids: ["cifras", "ritmo"] },
  { es: "Ajustes", en: "Settings", ids: ["ajustes", "sesion", "espera", "temporada", "busca", "idioma"] },
];

const TERMS = nameLinkTerms();

function HechoExample() {
  return (
    <svg viewBox="0 0 280 64" className="mt-2 h-16 w-full" role="img" aria-label="Hecho y cobrado, Hecho y pendiente, Hecho y abonado">
      <rect x="4" y="12" width="86" height="36" rx="8" fill="#0f5a2c" />
      <rect x="98" y="12" width="86" height="36" rx="8" fill="#8e1a12" />
      <rect x="192" y="12" width="84" height="36" rx="8" fill="#7a5608" />
      <text x="47" y="34" textAnchor="middle" fill="#fff" fontSize="9" fontFamily="Figtree, sans-serif">Cobrado</text>
      <text x="141" y="34" textAnchor="middle" fill="#fff" fontSize="9" fontFamily="Figtree, sans-serif">Pendiente</text>
      <text x="234" y="34" textAnchor="middle" fill="#fff" fontSize="9" fontFamily="Figtree, sans-serif">Abonado</text>
    </svg>
  );
}

function ManualText({ text }: { text: string }) {
  const re = new RegExp(`(${TERMS.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        nameDest(part) ? <NameLink key={`${part}-${i}`} term={part} /> : <span key={`${part}-${i}`}>{part}</span>,
      )}
    </>
  );
}

export function UserManual({
  onLocale,
  forceOpen = false,
}: {
  onLocale: (locale: LocaleName) => void;
  forceOpen?: boolean;
}) {
  const { locale, t } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const sections = MANUAL[locale];
  const query = q.trim();
  const shown = useMemo(
    () =>
      sections.filter(
        (section) =>
          !query ||
          smartHit(
            query,
            `${section.title} ${section.body} ${(section.points ?? []).map((point) => point.body).join(" ")}`,
          ),
      ),
    [sections, query],
  );

  async function preset(
    data: {
      workStart?: string;
      workEnd?: string;
      waitDays?: number;
      riskDays?: number;
      riskAmount?: number;
      riskCuts?: number;
      seasonStart?: string | null;
      seasonEnd?: string | null;
      seasonEvery?: number | null;
      horizonMonths?: number;
      locale?: LocaleName;
    },
    theme?: ThemeName,
    palette?: PaletteName,
  ) {
    await updateSettings({ data });
    if (theme) applyTheme(theme, palette);
    if (data.locale) {
      applyLocale(data.locale);
      onLocale(data.locale);
    }
    await qc.invalidateQueries({ queryKey: ["settings"] });
    toast.success(locale === "en" ? "Settings saved" : "Ajustes guardados");
  }

  function printManual() {
    setOpen("all");
    document.body.classList.add("manual-print");
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => document.body.classList.remove("manual-print"), 400);
    }, 40);
  }

  const groups = GROUPS.map((group) => ({
    ...group,
    label: locale === "en" ? group.en : group.es,
    items: shown.filter((section) => group.ids.includes(section.id)),
  })).filter((group) => group.items.length > 0);

  useEffect(() => {
    const reveal = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash.startsWith("ayuda-")) return;
      const id = hash.slice(6);
      const group = GROUPS.find((item) =>
        item.ids.some((sectionId) => {
          const section = sections.find((row) => row.id === sectionId);
          return section?.id === id || section?.points?.some((point) => point.id === id);
        }),
      );
      if (group) setOpen(locale === "en" ? group.en : group.es);
      let tries = 0;
      const tick = () => {
        const el = document.getElementById(hash);
        const details = el?.closest("details");
        if (!el || (details && !details.open)) {
          if (tries++ < 30) window.setTimeout(tick, 50);
          return;
        }
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("manual-flash");
        window.setTimeout(() => el.classList.remove("manual-flash"), 1800);
      };
      window.setTimeout(tick, 60);
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [locale, sections]);

  return (
    <Fold
      id="aj-manual"
      forceOpen={forceOpen}
      className="order-13 mb-6"
      titleClassName="text-lg"
      contentClassName="px-4 pb-4"
      title={
        <span className="flex items-center gap-2">
          <BookOpen className="size-5 shrink-0 text-primary" />
          {locale === "en" ? "Manual" : "Manual"}
        </span>
      }
    >
      <div id="manual-print" className="[overflow-anchor:none]">
        <h2 className="manual-print-title font-display text-lg font-semibold">{locale === "en" ? "Manual" : "Manual"}</h2>
        <p className="text-sm text-muted">
          {locale === "en"
            ? "Tap a function name to open it. A question first, so a stray tap does not leave the page. Print keeps the current text."
            : "Toca el nombre de una función para abrirla. Primero pregunta, para no salir de la página por un toque sin querer. Imprimir usa el texto de ahora."}
        </p>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={locale === "en" ? "Search the manual" : "Buscar en el manual"}
          className="mt-3 print-hide"
        />
        <div className="mt-3 flex flex-wrap gap-2 print-hide">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              void preset({ workStart: "08:00", workEnd: "17:30", waitDays: 45, riskDays: 21, riskAmount: 200, riskCuts: 3 })
            }
          >
            {locale === "en" ? "Normal week" : "Semana normal"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void preset({ waitDays: 21, riskDays: 10, riskAmount: 100, riskCuts: 2 })}>
            {locale === "en" ? "Short collection" : "Cobro corto"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void preset({ seasonStart: "11-01", seasonEnd: "02-28", seasonEvery: 21, horizonMonths: 12 })}
          >
            {locale === "en" ? "Slow winter" : "Invierno lento"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={printManual}>
            {locale === "en" ? "Print the manual" : "Imprimir el manual"}
          </Button>
        </div>
        <div className="mt-4 grid gap-2">
          {groups.map((group) => {
            const expanded = open === "all" || open === group.label || Boolean(query);
            return (
              <details key={group.label} open={expanded} className="rounded-md bg-bg [overflow-anchor:none]">
                <summary
                  className="cursor-pointer list-none px-3 py-3 font-display text-base font-semibold [&::-webkit-details-marker]:hidden"
                  onClick={(e) => {
                    e.preventDefault();
                    const y = window.scrollY;
                    setOpen((prev) => (prev === group.label ? null : group.label));
                    requestAnimationFrame(() => window.scrollTo(0, y));
                  }}
                >
                  {group.label}
                </summary>
                <div className="grid gap-3 px-3 pb-3">
                  {group.items.map((section) => (
                    <article key={section.id} id={`ayuda-${section.id}`} className="scroll-mt-40">
                      <h3 className="font-display text-base font-semibold">{section.title}</h3>
                      {section.id === "hecho" ? <HechoExample /> : null}
                      <p className="mt-1 text-sm text-muted">
                        <ManualText text={section.body} />
                      </p>
                      {section.points?.map((point) => (
                        <p key={point.id} id={`ayuda-${point.id}`} className="mt-2 scroll-mt-40 text-sm text-muted">
                          <ManualText text={point.body} />
                        </p>
                      ))}
                    </article>
                  ))}
                </div>
              </details>
            );
          })}
          {shown.length === 0 ? <p className="text-sm text-muted">{t("notes.empty")}</p> : null}
        </div>
      </div>
    </Fold>
  );
}
