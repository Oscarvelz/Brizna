/**
 * progress — la línea general de progreso del índice (ley universal de
 * Oscar, 2026-11-14, nacida en su línea de Cadence): UNA barra sobre TODOS
 * los módulos que dice cuánto de la app entera ya estudió el alumno y
 * cuánto le falta — tan bien integrada que no solo se vea bonita, sino útil.
 *
 * LA CUENTA HONESTA: un módulo terminado cuenta entero; un módulo a medias
 * cuenta la fracción de sí mismo ya caminada (su punto guardado — la escena
 * donde iba — sobre su longitud total en escenas); uno sin tocar cuenta
 * cero. La cifra es siempre la verdad, nunca vanidad. La función es pura:
 * el índice la alimenta con el catálogo y el estado del aparato, y las
 * cercas la conducen sin navegador.
 */

export type OverallProgress = {
  /** Porcentaje estudiado de la app entera (0–100, redondeado). */
  percent: number;
  /** Porcentaje que falta por estudiar (100 − percent). */
  remaining: number;
  /** Módulos terminados. */
  finished: number;
  /** Módulos empezados y no terminados, con camino real (escena > 0). */
  inProgress: number;
  /** Módulos contados (los listos para ver). */
  total: number;
};

export function overallProgress(
  mods: { id: string; ready: boolean; sceneCount: number }[],
  saved: Record<string, { scene: number; done: boolean }>,
): OverallProgress {
  const counted = mods.filter((m) => m.ready && m.sceneCount > 0);
  let walked = 0;
  let finished = 0;
  let inProgress = 0;
  for (const m of counted) {
    const s = saved[m.id];
    if (s?.done) {
      walked += 1;
      finished += 1;
    } else if (s && s.scene > 0) {
      walked += Math.min(1, s.scene / m.sceneCount);
      inProgress += 1;
    }
  }
  const total = counted.length;
  const percent = total ? Math.round((walked / total) * 100) : 0;
  return { percent, remaining: 100 - percent, finished, inProgress, total };
}
