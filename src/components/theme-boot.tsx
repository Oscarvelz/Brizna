import { useLayoutEffect } from "react";
import { applyAppearance, applyLocale, readStoredLocale } from "@/lib/theme";

export function ThemeBoot() {
  useLayoutEffect(() => {
    const paint = () => {
      applyAppearance();
      applyLocale(readStoredLocale());
      window.dispatchEvent(new Event("ols-look"));
    };
    paint();
    const onStorage = (event: StorageEvent) => {
      if (event.key && !event.key.startsWith("ols-")) return;
      paint();
    };
    window.addEventListener("storage", onStorage);
    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("ols-look");
      channel.onmessage = paint;
    }
    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, []);
  return null;
}