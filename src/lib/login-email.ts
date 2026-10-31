const KEY = "ols.last-email";

export function readSavedEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveEmail(email: string) {
  if (typeof window === "undefined") return;
  try {
    const v = email.trim();
    if (v) window.localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
}
