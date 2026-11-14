/**
 * waivers — exenciones cerradas de las cercas de la Presentación
 * (FENCE-DESIGN §6). Una exención nunca es texto libre: su razón viene de la
 * lista cerrada, y lleva el token y su motivo concreto. En esta ola no hay
 * ninguna: el árbol nace cubierto (cada superficie está en el registro o no
 * existe). Si una ola futura retira o deja fuera una superficie, lo registra
 * aquí en el mismo commit; una exención sin entrada aquí no existe.
 */
export type WaiverReason =
  /** Token que no se enseña por diseño (está en el registro o en el Manual). */
  | "no-ensenado"
  /** Token que solo aparece en texto probado por otra cerca (verificación). */
  | "solo-memoria-verify"
  /** Token del shell nativo (Android), fuera del DOM de la escena. */
  | "shell-nativo"
  /** Token retirado por una ola: la superficie ya no existe. */
  | "retirado";

export type Waiver = {
  /** El token exento (data-spot, data-present, id de tema/pliegue o ruta). */
  token: string;
  reason: WaiverReason;
  /** El porqué concreto, en una línea. */
  note: string;
};

export const WAIVERS: readonly Waiver[] = [];
