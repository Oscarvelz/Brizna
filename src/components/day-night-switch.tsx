import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { useTx } from "@/lib/i18n";
import { updateSettings } from "@/lib/server/lawn";
import { applyAppearance, isNightHour, readAppearance, type AppearanceMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

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

  return (
    <div
      className="inline-flex h-6 shrink-0 items-center rounded-full bg-sun p-0.5"
      role="group"
      aria-label={tx("Día o noche", "Day or night")}
    >
      <button
        type="button"
        aria-pressed={!night}
        aria-label={tx("Modo día", "Day mode")}
        onClick={() => choose("day")}
        className={cn(
          "relative grid size-5 place-items-center rounded-full before:absolute before:-inset-1",
          !night ? "bz-pick bz-pick-icon" : "text-muted",
        )}
      >
        <Sun className="size-3" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-pressed={night}
        aria-label={tx("Modo noche", "Night mode")}
        onClick={() => choose("night")}
        className={cn(
          "relative grid size-5 place-items-center rounded-full before:absolute before:-inset-1",
          night ? "bz-pick bz-pick-icon" : "text-muted",
        )}
      >
        <Moon className="size-3" strokeWidth={2} />
      </button>
    </div>
  );
}
