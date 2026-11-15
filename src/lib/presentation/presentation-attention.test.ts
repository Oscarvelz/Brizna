// Presentation attention, entrapment and honesty fences (principles 14, 16
// and 17, plus the named-region frame of principle 11 reinforced): source
// probes in the house family style, pinning the shapes a future wave must
// not quietly undo —
//  · 16: every performed TEACHING kind (do, press, swipe) waits the FULL
//    caption life before acting: first you read, then you watch, then you
//    touch — the action never competes with the reading that explains it.
//    (The captionless machinery `tap` carries no reading to protect; the
//    fence pins its announced time to what the engine runs instead.)
//  · 14: a performed beat that already landed is never re-performed when
//    the clock resumes (the won guards), and the conductor listens for the
//    app going to the background, pausing there and resuming only if it
//    was playing — a lesson never traps its student.
//  · 17: a module that finished with skipped scenes is NOT recorded as
//    learned; the record honours what the final card declares.
//  · 11R: the region the dialogue names carries a visible frame
//    (.pres-regionframe), not merely an unveiled window.
// Run: node --experimental-strip-types --test src/lib/presentation/presentation-attention.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..", "..");
const tsx = readFileSync(join(SRC, "components/presentation/presentacion.tsx"), "utf8");
const css = readFileSync(join(SRC, "components/presentation/presentacion.css"), "utf8");
const guion = readFileSync(join(SRC, "lib/presentation/guion.ts"), "utf8");

test("16: every performed teaching kind waits the full caption before acting", () => {
  const beats = tsx.match(/const beat = capDwell \/ speed/g) ?? [];
  assert.ok(beats.length >= 3, `expected the caption-first beat in do, press and swipe; found ${beats.length}`);
  for (const fn of ["pressEl(el", "swipeEl(el"]) {
    const at = tsx.indexOf(fn);
    assert.ok(at > 0, `${fn} must exist in the conductor`);
    const beatAt = tsx.lastIndexOf("const beat = capDwell / speed", at);
    assert.ok(beatAt > 0 && beatAt < at, `${fn} must be scheduled only after its caption-first beat is computed`);
  }
  // El do es la caída final del efecto: su toque también va tras el pie.
  const doAt = tsx.indexOf("el compás interactivo");
  const doTapAt = tsx.indexOf("tapEl(el)", doAt);
  const doBeatAt = tsx.indexOf("const beat = capDwell / speed", doAt);
  assert.ok(doAt > 0 && doBeatAt > doAt && doBeatAt < doTapAt, "the do branch must compute its caption-first beat before tapping");
  // El tap es maquinaria sin pie (su tipo no lleva leyenda): no le pide
  // lectura, pero su cuenta anunciada es la que el motor corre.
  assert.match(guion, /case "tap":\s*\n\s*return 950;/, "stepMs(tap) must announce 300 + 650, as the engine runs it");
});

test("14: a landed beat is never re-performed on resume, and backgrounding pauses the clock", () => {
  const guards = tsx.match(/if \(r\.won\)/g) ?? [];
  assert.ok(guards.length >= 4, `expected a won guard in tap, do, press and swipe; found ${guards.length}`);
  assert.match(tsx, /document\.addEventListener\("visibilitychange", onVis\)/,
    "the conductor must listen for the app going to the background");
  assert.match(tsx, /hiddenPauseRef\.current = true;\s*\n\s*setRun\(\{ \.\.\.cur, playing: false \}\)/,
    "going hidden must pause a playing lesson");
  assert.match(tsx, /if \(now && !now\.finished\) setRun\(\{ \.\.\.now, playing: true \}\)/,
    "returning resumes only a lesson the backgrounding itself paused");
});

test("17: a module with skipped scenes is not recorded as learned", () => {
  assert.ok(!/saveProgress\(done, true\)/.test(tsx), "no finish path may record done unconditionally");
  assert.match(tsx, /saveProgress\(done, done\.skipped\.length === 0\)/, "the advance finish must honour skips");
  assert.match(tsx, /saveProgress\(done, skipped\.length === 0\)/, "the skip finish must honour skips");
});

test("11R: the named region carries a visible frame", () => {
  assert.match(tsx, /className="pres-regionframe"/, "the footprint beats must render the region frame");
  assert.match(tsx, /seatTop && clearHole/, "the frame belongs to the footprint's clear region");
  assert.match(css, /\.pres-regionframe\s*\{[^}]*var\(--color-accent\)/, "the frame paints with the house accent");
});
