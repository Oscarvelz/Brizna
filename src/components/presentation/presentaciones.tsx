/**
 * Presentaciones — el índice de la Presentación Guiada, en Ajustes.
 *
 * Vecino del Manual (el manual es texto; las presentaciones, movimiento): cada módulo
 * se anuncia ANTES de darle a ver — nombre, duración honesta CALCULADA del propio guion
 * (durationLabel, nunca escrita a mano), promesa de capacidad (lo que podrás HACER) y
 * estado (visto / a medias, con «Seguir donde ibas») — y todo módulo devuelve aquí.
 *
 * Reanudar = el PRINCIPIO del capítulo donde ibas: las escenas de un capítulo dependen
 * del estado que las anteriores dejan, y el capítulo es la unidad de sentada (así lo
 * hace el índice de Faro, del que este pliegue hereda la forma).
 *
 * Nada de lo que corre aquí toca el libro real: el conductor actúa sobre un escenario
 * vacío y sellado; este pliegue solo lee el estado del aparato (readPresState) y lanza.
 */
import { useEffect, useState } from "react";
import { Check, Play, Presentation } from "lucide-react";
import { Fold } from "@/components/fold";
import { Button } from "@/components/ui/button";
import { useI18n, useTx } from "@/lib/i18n";
import { MODULES, durationLabel, pick, type Module } from "@/lib/presentation/guion";
import { overallProgress } from "@/lib/presentation/progress";
import { peekStay, readPresState } from "@/lib/presentation/state";
import { stageOn } from "@/lib/presentation/stage";
import { launchPresentation } from "@/components/presentation/presentacion";
import type { LocaleName } from "@/lib/types";

type PresState = ReturnType<typeof readPresState>;
type ModuleState = PresState["modules"][string];
type Tx = (es: string, en: string) => string;

function ModuleRow({
  mod,
  saved,
  locale,
  tx,
  onPlay,
}: {
  mod: Module;
  saved: ModuleState | undefined;
  locale: LocaleName;
  tx: Tx;
  onPlay: (mod: Module, resume: boolean) => void;
}) {
  const mid = !!saved && !saved.done && saved.scene > 0;
  return (
    <div className="py-3 first:pt-2 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-semibold text-muted tabular-nums">{mod.n}</span>
        <span className="min-w-0 flex-1 text-base font-semibold">{pick(mod.title, locale)}</span>
        {mod.ready ? (
          <span className="text-xs font-semibold text-muted tabular-nums">{durationLabel(mod, locale)}</span>
        ) : null}
        {saved?.done ? (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-done-bg px-2 text-xs font-semibold text-done ring-1 ring-done/30">
            <Check className="size-3.5" strokeWidth={2.4} />
            {tx("Visto", "Seen")}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted">{pick(mod.promise, locale)}</p>
      {mod.ready ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => onPlay(mod, mid)}>
            <Play />
            {mid ? tx("Seguir donde ibas", "Pick up where you left off") : tx("Verla", "Watch it")}
          </Button>
          {mid ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onPlay(mod, false)}>
              {tx("Desde el principio", "From the start")}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">{tx("En preparación", "In preparation")}</p>
      )}
    </div>
  );
}

/** El pliegue «Presentaciones» de Ajustes, justo encima del Manual (misma clase de
 * orden, y en el DOM va antes: el Masonry desempata por posición, así quedan vecinos). */
export function PresentacionesFold({ forceOpen = false }: { forceOpen?: boolean }) {
  const { locale } = useI18n();
  const tx = useTx();
  const [pres, setPres] = useState<PresState>(() => readPresState());

  // El estado se relee al montar y cada vez que la ventana recupera el foco: el usuario
  // vuelve aquí desde un módulo y la tarjeta debe decir la verdad (visto / a medias).
  useEffect(() => {
    setPres(readPresState());
    const onFocus = () => setPres(readPresState());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    // Fold no expone ranura data-* (el Manual tampoco lleva data-spot en su pliegue: su
    // ancla es el id). El ancla del registro de presentaciones se estampa en la cabecera
    // del pliegue, para que el conductor y la cerca la resuelvan como data-present.
    document
      .getElementById("aj-presentaciones")
      ?.querySelector(".bz-fold-head")
      ?.setAttribute("data-present", "ajustes-presentaciones");
    // Si la intención de estancia pide abrir las Presentaciones, el pliegue se abre solo
    // por la vía de la casa (el evento que Fold ya escucha). peekStay solo espía la
    // llave `bz.pres.stay` — retirarla es del conductor, nunca de este pliegue.
    if (peekStay()?.openPres) {
      window.dispatchEvent(new CustomEvent("ols-open-fold", { detail: "aj-presentaciones" }));
    }
  }, []);

  const play = (mod: Module, resume: boolean) => {
    if (stageOn()) return; // dentro de una presentación no se lanza otra
    const saved = pres.modules[mod.id];
    let sceneId = mod.scenes[0]?.id;
    if (resume && saved && !saved.done) {
      const at = mod.scenes[saved.scene];
      const firstOfChapter = at ? mod.scenes.find((s) => s.chapter === at.chapter) : undefined;
      sceneId = firstOfChapter?.id ?? sceneId;
    }
    launchPresentation(mod.id, sceneId);
  };

  const floors: { id: Module["floor"]; label: string }[] = [
    { id: "quick", label: tx("Piso rápido", "Quick floor") },
    { id: "advanced", label: tx("Avanzado", "Advanced") },
  ];

  // La ley de la ficha primera (Oscar, 2026-11-14): el último módulo en uso,
  // si quedó incompleto, abre el índice — su ficha va LA PRIMERA de todas,
  // para continuar donde iba sin buscarla ni tener que recordar cuál era.
  // Sale de su piso mientras viva aquí arriba; al completarse, vuelve.
  const lastMod = pres.lastPlayed ? MODULES.find((m) => m.id === pres.lastPlayed) : undefined;
  const resumeMod = lastMod && pres.modules[lastMod.id] && !pres.modules[lastMod.id].done ? lastMod : undefined;

  return (
    <Fold
      id="aj-presentaciones"
      forceOpen={forceOpen}
      className="order-13 mb-4"
      chevronEnd
      titleClassName="text-lg"
      contentClassName="px-4 pb-4"
      title={
        <span className="flex items-center gap-2">
          <Presentation className="size-5 shrink-0 text-primary" />
          {tx("Presentaciones", "Presentations")}
        </span>
      }
    >
      <p className="text-sm text-muted">
        {tx("La app, en vivo, paso a paso", "The app, live, step by step")}
      </p>
      {(() => {
        // La línea general de progreso (ley universal de Oscar, 2026-11-14):
        // UNA barra sobre todos los módulos — cuánto de la app entera ya se
        // estudió y cuánto falta — con la cuenta honesta de progress.ts (el
        // módulo terminado cuenta entero; el de a medias, su fracción).
        const prog = overallProgress(
          MODULES.map((m) => ({ id: m.id, ready: m.ready, sceneCount: m.scenes.length })),
          pres.modules,
        );
        if (!prog.total) return null;
        return (
          <div className="mt-3">
            <div
              className="h-2 overflow-hidden rounded-full bg-border/60"
              role="progressbar"
              aria-valuenow={prog.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={tx("Tu avance en toda la app", "Your progress across the whole app")}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${prog.percent}%` }} />
            </div>
            <p className="mt-1.5 text-sm font-medium">
              {tx(
                `Has estudiado el ${prog.percent}% de la app`,
                `You've studied ${prog.percent}% of the app`,
              )}
            </p>
            <p className="text-xs text-muted tabular-nums">
              {tx(
                `${prog.finished} de ${prog.total} módulos completos · ${prog.inProgress} en curso · te falta el ${prog.remaining}%`,
                `${prog.finished} of ${prog.total} modules complete · ${prog.inProgress} in progress · ${prog.remaining}% to go`,
              )}
            </p>
          </div>
        );
      })()}
      {resumeMod ? (
        <div>
          <p className="mt-4 text-xs font-semibold tracking-wide text-muted uppercase">
            {tx("Sigue donde ibas", "Pick up where you left off")}
          </p>
          <div className="divide-y divide-border">
            <ModuleRow
              mod={resumeMod}
              saved={pres.modules[resumeMod.id]}
              locale={locale}
              tx={tx}
              onPlay={play}
            />
          </div>
        </div>
      ) : null}
      {floors.map((floor, floorIdx) => {
        const mods = MODULES.filter((mod) => mod.floor === floor.id && mod.id !== resumeMod?.id);
        if (!mods.length) return null;
        return (
          <div key={floor.id}>
            <p
              className={`${floorIdx === 0 ? "mt-4" : "mt-5"} text-xs font-semibold tracking-wide text-muted uppercase`}
            >
              {floor.label}
            </p>
            <div className="divide-y divide-border">
              {mods.map((mod) => (
                <ModuleRow
                  key={mod.id}
                  mod={mod}
                  saved={pres.modules[mod.id]}
                  locale={locale}
                  tx={tx}
                  onPlay={play}
                />
              ))}
            </div>
          </div>
        );
      })}
      <p className="mt-4 border-t border-border pt-3 text-sm text-muted">
        {tx(
          "Nada de lo que veas aquí toca tu libro real: cada presentación actúa sobre un escenario vacío.",
          "Nothing you see here touches your real book: every presentation performs on an empty stage.",
        )}
      </p>
    </Fold>
  );
}
