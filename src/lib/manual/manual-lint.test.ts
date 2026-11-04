// Manual lint (1.4.61): the manual adds to the (?) bubbles, it never repeats them.
// Run: npm run lint:manual (also part of npm test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { HINT_ONLY, MANUAL_TOPICS, findHint, findTopic, topicBody, type L } from "./topics.ts";

const MIN_BODY = 320; // letters of manual body per language, beyond the bubble
const MAX_HINT_SENTENCES = 2;
const MAX_HINT_CHARS = 230;

const norm = (s: string) => s.replace(/\[\[|\]\]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const sentences = (s: string) =>
  norm(s)
    .split(/(?<=[.!?…])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 25);
const langs = [0, 1] as const;

test("every manual page adds real detail and never repeats its (?) text", () => {
  const errs: string[] = [];
  const ok = (c: unknown, m: string) => { if (!c) errs.push(m); };
  for (const t of MANUAL_TOPICS) {
    ok(t.how, `${t.id}: missing "how"`);
    ok(t.example, `${t.id}: missing "example"`);
    const bubbles: L[] = [t.what, ...(t.whatAlt ? [t.whatAlt] : []), ...HINT_ONLY.filter((h) => h.into === t.id).flatMap((h) => [h.what, ...(h.whatAlt ? [h.whatAlt] : [])])];
    for (const i of langs) {
      const body = norm(topicBody(t).map((p) => p[i]).join(" "));
      ok(body.length >= MIN_BODY, `${t.id} [${i ? "en" : "es"}]: body ${body.length} < ${MIN_BODY} letters`);
      ok(norm(t.sum[i]) !== norm(t.what[i]), `${t.id}: summary repeats the bubble`);
      for (const b of bubbles) {
        ok(!body.includes(norm(b[i])), `${t.id} [${i ? "en" : "es"}]: body contains the bubble text verbatim`);
        for (const s of sentences(b[i])) ok(!body.includes(s), `${t.id} [${i ? "en" : "es"}]: body repeats bubble sentence "${s}"`);
      }
    }
  }
  assert.deepEqual(errs, []);
});

test("bubbles stay short: one or two plain sentences", () => {
  const errs: string[] = [];
  const ok = (c: unknown, m: string) => { if (!c) errs.push(m); };
  const all = [...MANUAL_TOPICS.map((t) => ({ id: t.id, pairs: [t.what, t.whatAlt] })), ...HINT_ONLY.map((h) => ({ id: h.id, pairs: [h.what, h.whatAlt] }))];
  for (const { id, pairs } of all) {
    for (const p of pairs) {
      if (!p) continue;
      for (const i of langs) {
        const text = p[i].replace(/\[\[|\]\]/g, "").trim();
        const n = text.split(/(?<=[.!?…])\s+/).filter(Boolean).length;
        ok(n <= MAX_HINT_SENTENCES, `${id} [${i ? "en" : "es"}]: bubble has ${n} sentences`);
        ok(text.length <= MAX_HINT_CHARS, `${id} [${i ? "en" : "es"}]: bubble is ${text.length} letters`);
      }
    }
  }
  assert.deepEqual(errs, []);
});

test("ids, merges and related links resolve", () => {
  const ids = new Set(MANUAL_TOPICS.map((t) => t.id));
  assert.equal(ids.size, MANUAL_TOPICS.length, "duplicate topic id");
  for (const h of HINT_ONLY) {
    assert.ok(!ids.has(h.id), `${h.id}: both a topic and a hint-only bubble`);
    assert.ok(ids.has(h.into), `${h.id}: merged into unknown topic ${h.into}`);
    assert.equal(findTopic(h.id)?.id, h.into);
  }
  for (const t of MANUAL_TOPICS) for (const r of t.related ?? []) assert.ok(ids.has(r) && r !== t.id, `${t.id}: bad related id ${r}`);
});

test("every <Hint topic> in the app has a bubble and a manual page", () => {
  const root = join(import.meta.dirname, "..", "..");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".tsx")) files.push(p);
    }
  };
  walk(root);
  const used = new Set<string>();
  for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/topic(?:=|:\s*)["']([a-z0-9-]+)["']/g)) used.add(m[1]!);
  for (const m of readFileSync(join(root, "routes", "agenda.tsx"), "utf8").matchAll(/"(pasar-[a-z-]+)"/g)) used.add(m[1]!);
  assert.ok(used.size > 30, `found only ${used.size} hint ids`);
  for (const id of used) {
    const h = findHint(id);
    assert.ok(h, `<Hint topic="${id}"> has no bubble`);
    assert.ok(h.topic, `<Hint topic="${id}"> has no manual page`);
  }
});
