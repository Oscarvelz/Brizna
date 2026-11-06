/**
 * 1.4.96: a small solid note next to a lit button ("Continuar aparece al tocar …"). Its own layer, follows the
 * target while the page settles, fades in, stays ~4.5 s, ends on the first tap, a screen change or the lock.
 * With no target it sits above the dock, centered. Only one at a time.
 */

let stopLive: (() => void) | null = null;

export function clearCallout() {
  const s = stopLive;
  stopLive = null;
  s?.();
}

export function calloutOn(): Element | null {
  return document.querySelector(".bz-callout");
}

export function showCallout(text: string, anchor: Element | null, ms = 4600) {
  clearCallout();
  if (!text) return;
  const el = document.createElement("div");
  el.className = "bz-callout";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  const p = document.createElement("span");
  p.className = "bz-callout-t";
  p.textContent = text;
  const arrow = document.createElement("i");
  arrow.className = "bz-callout-arrow";
  arrow.setAttribute("aria-hidden", "true");
  el.append(arrow, p);
  if (!anchor) el.classList.add("is-free");
  document.body.appendChild(el);

  let raf = 0;
  const place = () => {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!anchor || !anchor.isConnected) {
      const dock = document.querySelector(".pod-dock")?.getBoundingClientRect();
      const bottom = dock && dock.height > 0 ? dock.top : vh;
      el.style.transform = `translate(${Math.round((vw - w) / 2)}px, ${Math.round(bottom - h - 14)}px)`;
      el.classList.add("is-free");
    } else {
      const r = anchor.getBoundingClientRect();
      const gap = 10;
      const below = r.bottom + gap + h < vh - 72;
      const top = below ? r.bottom + gap : Math.max(8, r.top - gap - h);
      const cx = r.left + r.width / 2;
      const left = Math.min(Math.max(12, cx - w / 2), vw - w - 12);
      el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      el.classList.toggle("is-above", !below);
      arrow.style.left = `${Math.round(Math.min(Math.max(18, cx - left), w - 18))}px`;
    }
    raf = requestAnimationFrame(place);
  };
  place();
  requestAnimationFrame(() => el.classList.add("is-in"));

  const end = window.setTimeout(() => done(), ms);
  const onTap = () => done();
  const opts = { capture: true } as const;
  window.setTimeout(() => document.addEventListener("pointerdown", onTap, opts), 250);
  window.addEventListener("hashchange", onTap);
  window.addEventListener("bz-locked", onTap);

  function done() {
    if (stopLive === done) stopLive = null;
    cancelAnimationFrame(raf);
    window.clearTimeout(end);
    document.removeEventListener("pointerdown", onTap, opts);
    window.removeEventListener("hashchange", onTap);
    window.removeEventListener("bz-locked", onTap);
    el.classList.remove("is-in");
    el.classList.add("is-out");
    window.setTimeout(() => el.remove(), 220);
  }
  stopLive = done;
}
