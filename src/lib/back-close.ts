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
    window.history.pushState({ ...((window.history.state ?? {}) as object), bzSheet: id }, "", window.location.href);
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
