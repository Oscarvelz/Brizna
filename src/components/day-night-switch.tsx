import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { useTx } from "@/lib/i18n";
import { updateSettings } from "@/lib/server/lawn";
import { applyAppearance, isNightHour, readAppearance, type AppearanceMode } from "@/lib/theme";

function showingNight(mode: AppearanceMode) {
  if (mode === "night") return true;
  if (mode === "day") return false;
  return isNightHour();
}

export function DayNightSwitch() {
  const tx = useTx();
  const qc = useQueryClient();
  const [night, setNight] = useState(false);

  useEffect(() => {
    const sync = () => setNight(showingNight(readAppearance().mode));
    sync();
    window.addEventListener("ols-look", sync);
    return () => window.removeEventListener("ols-look", sync);
  }, []);

  function choose(next: "day" | "night") {
    if (showingNight(readAppearance().mode) === (next === "night")) return;
    setNight(next === "night");
    applyAppearance({ mode: next });
    void updateSettings({ data: { theme: next === "night" ? "amoled" : "light" } }).then(() =>
      qc.invalidateQueries({ queryKey: ["settings"] }),
    );
  }

  // 1.4.68 (Oscar): one round button. It shows the mode on screen (sun by day, moon at night) and a tap
  // flips it; the icons cross-fade with a small turn in place (220 ms, no overshoot; instant under reduced motion).
  return (
    <button
      type="button"
      data-night={night ? "" : undefined}
      aria-label={night ? tx("Cambiar a día", "Switch to day") : tx("Cambiar a noche", "Switch to night")}
      title={night ? tx("Cambiar a día", "Switch to day") : tx("Cambiar a noche", "Switch to night")}
      onClick={() => choose(night ? "day" : "night")}
      className="bz-daynight"
    >
      <Sun className="bz-daynight-sun" strokeWidth={2} aria-hidden="true" />
      <Moon className="bz-daynight-moon" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
