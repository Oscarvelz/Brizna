const KEY = "ols-sounds";

export type SoundPrefs = { on: boolean; volume: number };

export function readSoundPrefs(): SoundPrefs {
  if (typeof localStorage === "undefined") return { on: true, volume: 0.35 };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "") as Partial<SoundPrefs>;
    const volume = typeof raw.volume === "number" ? Math.min(1, Math.max(0, raw.volume)) : 0.35;
    return { on: raw.on !== false, volume };
  } catch {
    return { on: true, volume: 0.35 };
  }
}

export function writeSoundPrefs(next: SoundPrefs) {
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("ols-sounds"));
}

function tone(freq: number, ms: number, gain: number, type: OscillatorType) {
  const prefs = readSoundPrefs();
  if (!prefs.on || prefs.volume <= 0) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.value = gain * prefs.volume;
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start();
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
  osc.stop(ctx.currentTime + ms / 1000);
  osc.onended = () => void ctx.close();
}

export function playTick() {
  tone(660, 90, 0.04, "sine");
}

export function playDing() {
  tone(880, 160, 0.05, "sine");
  window.setTimeout(() => tone(1174, 220, 0.04, "sine"), 90);
}
