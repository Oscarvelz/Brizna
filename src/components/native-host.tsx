import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { native } from "@/spa/native";
import { buildSchedule, buildWidget, readNotifyPrefs } from "@/lib/native-plan";
import { getNativePlan } from "@/lib/server/lawn";
import { onSyncStatus } from "@/spa/sync";
import { readAppearance } from "@/lib/theme";

/**
 * 1.4.97 Brizna for Android only (renders nothing, and does nothing, in a browser or the PWA).
 * Keeps the app's reminders and the "Hoy" widget in step with the data: on open, after every change (each saved
 * edit, a finished sync), when Brizna comes back to the front, when the reminder settings change, and at midnight.
 * Also opens the screen a tapped reminder or the widget asks for.
 */
let timer = 0;
let running = false;
let again = false;

async function refresh() {
  const n = native();
  if (!n?.setSchedule || !n.setWidget) return;
  if (running) { again = true; return; }
  running = true;
  try {
    const plan = await getNativePlan();
    const items = buildSchedule(plan, readNotifyPrefs());
    n.setSchedule(JSON.stringify(items));
    n.setWidget(JSON.stringify(buildWidget(plan)));
    window.dispatchEvent(new Event("briznanative-status"));
  } catch (err) {
    console.warn("[brizna native] plan", err);
  } finally {
    running = false;
    if (again) { again = false; soon(); }
  }
}

export function refreshNativeSoon(delay = 1200) {
  if (!native()) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void refresh(), delay);
}
const soon = () => refreshNativeSoon();

export function NativeHost() {
  // Test harness only (window.__bzTrace is set by the browser tests, never by the app).
  if (typeof window !== "undefined" && (window as any).__bzTrace && native()) (window as any).__bzNativePlan = { buildSchedule, buildWidget };
  const navigate = useNavigate();
  useEffect(() => {
    const n = native();
    if (!n) return;
    const go = () => {
      const r = n.takeRoute?.() || "";
      if (!r) return;
      // A route may carry the day it points at ("/agenda?dia=2026-11-10", the tomorrow's-cuts
      // reminder): hand the date to Agenda as a search param so it can focus that day.
      const [path, qs] = r.split("?");
      const dia = qs ? new URLSearchParams(qs).get("dia") : null;
      if (path === "/agenda" && dia && /^\d{4}-\d{2}-\d{2}$/.test(dia)) {
        void navigate({ to: "/agenda", search: { dia } });
      } else if (path) {
        void navigate({ to: path as "/" });
      }
    };
    go();
    refreshNativeSoon(2500);
    let lastSync = "";
    const offSync = onSyncStatus((s) => {
      if (lastSync === "syncing" && s === "idle") soon();
      lastSync = s;
    });
    const onVis = () => { if (document.visibilityState === "visible") soon(); };
    // Midnight: the day turns, so tomorrow's list becomes today's.
    const tick = window.setInterval(() => {
      const d = new Date();
      if (d.getHours() === 0 && d.getMinutes() < 2) soon();
    }, 60_000);
    // The widget follows the day/night look: refresh when the mode changes.
    let mode = readAppearance().mode;
    const look = new MutationObserver(() => {
      const m = readAppearance().mode;
      if (m !== mode) { mode = m; soon(); }
    });
    look.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("bz-data-write", soon);
    window.addEventListener("bz-notify-prefs", soon);
    window.addEventListener("briznanative-route", go);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      offSync?.();
      look.disconnect();
      window.clearInterval(tick);
      window.removeEventListener("bz-data-write", soon);
      window.removeEventListener("bz-notify-prefs", soon);
      window.removeEventListener("briznanative-route", go);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [navigate]);
  return null;
}
