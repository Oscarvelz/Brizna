import { todayISO } from "@/lib/dates";

const KEY = "ols-skip-hecho";
const EVENT = "ols-skip-hecho";

export function isHechoConfirmSkipped(today = todayISO()): boolean {
  try {
    return localStorage.getItem(KEY) === today;
  } catch {
    return false;
  }
}

export function setHechoConfirmSkipped(skip: boolean, today = todayISO()): void {
  try {
    if (skip) localStorage.setItem(KEY, today);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore quota / private mode */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function subscribeHechoConfirm(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
