import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Hint } from "@/components/hint";
import { Fold } from "@/components/fold";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { rememberOrigin } from "@/lib/manual/nav";
import { MANUAL_CHAPTERS, MANUAL_TOPICS } from "@/lib/manual/topics";
import { updateSettings } from "@/lib/server/lawn";
import { applyLocale } from "@/lib/theme";
import type { LocaleName } from "@/lib/types";

/** Ajustes card: opens the full manual (its own screen) and keeps the three quick presets. */
export function UserManual({
  onLocale,
  forceOpen = false,
}: {
  onLocale: (locale: LocaleName) => void;
  forceOpen?: boolean;
}) {
  const { locale } = useI18n();
  const tx = (es: string, en: string) => (locale === "en" ? en : es);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function preset(data: {
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
  }) {
    await updateSettings({ data });
    if (data.locale) {
      applyLocale(data.locale);
      onLocale(data.locale);
    }
    await qc.invalidateQueries({ queryKey: ["settings"] });
    toast.success(tx("Ajustes guardados", "Settings saved"));
  }

  function open() {
    rememberOrigin("/ajustes");
    void navigate({ to: "/manual" });
  }

  return (
    <Fold
      id="aj-manual"
      forceOpen={forceOpen}
      className="order-13 mb-4"
      chevronEnd
      hint={<Hint topic="manual-uso" />}
      titleClassName="text-lg"
      contentClassName="px-4 pb-4"
      title={
        <span className="flex items-center gap-2">
          <BookOpen className="size-5 shrink-0 text-primary" />
          {tx("Manual", "Manual")}
        </span>
      }
    >
      <p className="text-sm text-muted">
        {tx(
          `${MANUAL_CHAPTERS.length} capítulos, ${MANUAL_TOPICS.length} temas. Cada (?) de la app abre aquí su tema exacto.`,
          `${MANUAL_CHAPTERS.length} chapters, ${MANUAL_TOPICS.length} topics. Every (?) in the app opens its exact topic here.`,
        )}
      </p>
      <Button type="button" className="mt-3 w-full sm:w-auto" onClick={open} data-present="manual-abrir">
        {tx("Abrir el manual", "Open the manual")}
        <ArrowRight />
      </Button>
      <p className="mt-4 text-xs font-semibold tracking-wide text-muted uppercase">{tx("Ajustes rápidos", "Quick settings")}</p>
      <div className="mt-2 flex flex-wrap gap-2" data-present="aj-rapidos">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void preset({ workStart: "08:00", workEnd: "17:30", waitDays: 45, riskDays: 21, riskAmount: 200, riskCuts: 3 })}
        >
          {tx("Semana normal", "Normal week")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void preset({ waitDays: 21, riskDays: 10, riskAmount: 100, riskCuts: 2 })}>
          {tx("Cobro corto", "Short collection")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void preset({ seasonStart: "11-01", seasonEnd: "02-28", seasonEvery: 21, horizonMonths: 12 })}
        >
          {tx("Invierno lento", "Slow winter")}
        </Button>
      </div>
    </Fold>
  );
}
