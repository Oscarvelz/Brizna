import { useEffect, useRef } from "react";

/**
 * Sheets and dialogs own one history step while open, so the phone's back button closes
 * the top one and leaves you on the screen you were on (Oscar: "atrás debe llevarte de donde vienes").
 */
type Entry = { id: number; close: () => void };
const stack: Entry[] = [];
let seq = 0;
let skip = 0;
let installed = false;

/**
 * 1.4.78 (Oscar: tapping "Mayor saldo" threw Cobros to the top, the next tap back down). The router patches
 * window.history.pushState and treats every push as a navigation (scroll reset to the top). A sheet's history
 * step is not a navigation, so it is pushed with the browser's own History.prototype.pushState, unseen by the router.
 */
function pushStep(state: object) {
  const raw = typeof History !== "undefined" ? History.prototype.pushState : null;
  if (raw) raw.call(window.history, state, "", window.location.href);
  else window.history.pushState(state, "", window.location.href);
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("popstate", () => {
    if (skip > 0) {
      skip -= 1;
      return;
    }
    const top = stack[stack.length - 1];
    if (!top) return;
    const st = (window.history.state ?? {}) as { bzSheet?: number };
    if (st.bzSheet === top.id) return;
    stack.pop();
    top.close();
  });
}

export function useBackClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    install();
    const id = ++seq;
    const entry: Entry = { id, close: () => closeRef.current() };
    stack.push(entry);
    pushStep({ ...((window.history.state ?? {}) as object), bzSheet: id });
    return () => {
      const i = stack.indexOf(entry);
      if (i < 0) return; // closed by back: its step is already gone
      stack.splice(i, 1);
      const st = (window.history.state ?? {}) as { bzSheet?: number };
      if (st.bzSheet === id) {
        skip += 1;
        window.history.back();
      }
    };
  }, [open]);
}

/**
 * The same history step for things that are not React state (the "Ir allí" ring): back calls
 * `onBack`; when the thing goes away on its own, call the returned function to take the step back.
 */
export function pushBackStep(onBack: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  install();
  const id = ++seq;
  const entry: Entry = { id, close: onBack };
  stack.push(entry);
  pushStep({ ...((window.history.state ?? {}) as object), bzSheet: id });
  return () => {
    const i = stack.indexOf(entry);
    if (i < 0) return;
    stack.splice(i, 1);
    const st = (window.history.state ?? {}) as { bzSheet?: number };
    if (st.bzSheet === id) {
      skip += 1;
      window.history.back();
    }
  };
}

/**
 * 1.4.79 (Oscar: a link inside a dialog opened Por cobrar behind it and left the dialog on top). Closes every open
 * sheet/dialog at once, takes all their history steps back in one move, then runs `after` (the navigation) once the
 * history has settled, so the new screen is never under an old dialog and back still works as expected.
 */
export function closeAllSheets(after?: () => void) {
  if (typeof window === "undefined") return after?.();
  const open = stack.splice(0, stack.length);
  if (!open.length) return after?.();
  let steps = 0;
  const st = (window.history.state ?? {}) as { bzSheet?: number };
  if (st.bzSheet != null && open.some((e) => e.id === st.bzSheet)) steps = open.filter((e) => e.id <= st.bzSheet!).length;
  for (const e of open.reverse()) e.close();
  if (!steps) return after?.();
  skip += 1;
  const done = () => {
    window.removeEventListener("popstate", done);
    window.setTimeout(() => after?.(), 30);
  };
  window.addEventListener("popstate", done);
  window.history.go(-steps);
}
