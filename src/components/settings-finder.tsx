import { useState } from "react";
import { Volume2 } from "lucide-react";
import { Hint } from "@/components/hint";
import { Fold } from "@/components/fold";
import { useTx } from "@/lib/i18n";
import { smartHit } from "@/lib/fuzzy";
import { playDing, readSoundPrefs, writeSoundPrefs } from "@/lib/sounds";
import { cn } from "@/lib/utils";

export function SoundSettings({ query = "" }: { query?: string }) {
  const tx = useTx();
  const [prefs, setPrefs] = useState(readSoundPrefs());
  const blob = "sonidos sounds ding volumen silencio tono";
  if (query && !smartHit(query, blob)) return null;

  function save(next: { on: boolean; volume: number }) {
    setPrefs(next);
    writeSoundPrefs(next);
  }

  return (
    <Fold
      id="aj-sonidos"
      forceOpen={Boolean(query)}
      className="order-5 mb-4"
      chevronEnd
      hint={<Hint topic="sonidos" />}
      titleClassName="text-lg"
      contentClassName="px-4 pb-4"
      title={
        <span className="flex items-center gap-2">
          <Volume2 className="size-5 shrink-0 text-primary" />
          {tx("Sonidos", "Sounds")}
        </span>
      }
    >
      <p className="text-sm text-muted">
        {tx(
          "Un ding suave cuando el día queda completo. Se puede apagar o bajar.",
          "A soft ding when the day is fully done. It can be turned off or turned down.",
        )}
      </p>
      <button
        type="button"
        onClick={() => save({ ...prefs, on: !prefs.on })}
        className={cn(
          "mt-4 flex h-12 w-full items-center justify-between rounded-md px-3 text-sm font-semibold",
          prefs.on ? "bg-done-bg text-done" : "bg-surface-2 text-muted",
        )}
      >
        {prefs.on ? tx("Sonidos encendidos", "Sounds on") : tx("Sonidos apagados", "Sounds off")}
      </button>
      <label className="mt-3 block text-sm text-muted">
        {tx("Volumen", "Volume")}
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(prefs.volume * 100)}
          aria-label={tx("Volumen", "Volume")}
          className="mt-1 w-full accent-primary"
          onChange={(e) => save({ ...prefs, volume: Number(e.target.value) / 100 })}
        />
      </label>
      <button type="button" className="mt-2 text-sm font-semibold text-primary" onClick={() => playDing()}>
        {tx("Probar ding", "Try the ding")}
      </button>
    </Fold>
  );
}
