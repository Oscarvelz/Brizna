/** 1.5.50 (auditoría interna, C2): fetch with a deadline. The weather calls used to go
 *  out with no AbortController at all: on bad coverage a request could hang forever —
 *  the Clima screen stuck on "Leyendo el cielo…", the place search's busy button never
 *  falling — or an old cached reading kept ruling the day with nothing saying its age.
 *  Same pattern the house already uses for translation (translate.ts, 15 s): an
 *  AbortController, a timer, and the rejection lands in the caller's catch. */
export function fetchWithTimeout(url: string, ms = 10_000, init?: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { ...init, signal: ctl.signal }).finally(() => clearTimeout(t));
}
