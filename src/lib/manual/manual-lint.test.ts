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

// 1.4.96: every dotted link names something real, with a class (screen / flow / trait) and a target that exists.
test("every link reference resolves to a class and a real target", async () => {
  const { REFS, findRef, refCopy } = await import("./refs.ts");
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
  const src = files.map((f) => readFileSync(f, "utf8")).join("\n");
  const errs: string[] = [];
  const ok = (c: unknown, m: string) => { if (!c) errs.push(m); };
  const exists = (s: string) => {
    if (s.startsWith("@")) {
      const t = s.slice(1);
      return new RegExp(`data-(?:spot|spot-alt|ref)=["{][^\\n]*\\b${t}\\b`).test(src) || new RegExp(`spot(?:Alt)?=\\{?[^\\n]*"[^"]*\\b${t}\\b`).test(src) || new RegExp(`spot="${t}"`).test(src);
    }
    if (s.startsWith("#")) return src.includes(`id="${s.slice(1)}"`);
    return s.split(/[\s,>]+/).filter((x) => x.startsWith(".")).every((c) => c.split(".").filter(Boolean).every((k) => src.includes(k)));
  };
  // 1) the words the app turns into links: emphasis list terms with a destination, NameLink terms, [[...]] in texts
  const i18n = readFileSync(join(root, "lib", "i18n.tsx"), "utf8");
  const emph = i18n.slice(i18n.indexOf("const EMPHASIS = ["), i18n.indexOf("];", i18n.indexOf("const EMPHASIS = [")));
  const linked = new Set<string>();
  const topicsSrc = readFileSync(join(import.meta.dirname, "topics.ts"), "utf8").replace(/^\s*\*.*$/gm, "");
  for (const m of topicsSrc.matchAll(/\[\[([^\]"]+)\]\]/g)) {
    linked.add(m[1]!);
    ok(findRef(m[1]!), `[[${m[1]}]] in topics.ts has no reference (it would not be a link)`);
  }
  for (const m of src.matchAll(/<NameLink term=\{tx\("([^"]+)", "([^"]+)"\)\}/g)) for (const t of [m[1]!, m[2]!]) { linked.add(t); ok(findRef(t), `<NameLink term="${t}"> has no reference`); }
  for (const m of emph.matchAll(/"([^"]+)"/g)) if (findRef(m[1]!)) linked.add(m[1]!);
  ok(linked.size > 40, `found only ${linked.size} linked terms`);
  // 2) every reference: class, target, copy
  for (const [terms, r] of REFS) {
    const id = terms.join("/");
    ok(["screen", "flow", "trait"].includes(r.kind), `${id}: no class`);
    if (r.kind === "trait") {
      ok(r.trait && r.where, `${id}: a trait needs what it is and where it happens`);
      ok(!r.to, `${id}: a trait never opens anything`);
      continue;
    }
    ok(r.to && r.spot && r.go, `${id}: needs a screen, a spot and natural "¿Ir …?" words`);
    if (r.spot) ok(exists(r.spot), `${id}: spot ${r.spot} not found in the app`);
    if (r.alt) ok(exists(r.alt), `${id}: alt ${r.alt} not found in the app`);
    if (r.fold) ok(src.includes(`id="${r.fold}"`), `${id}: fold ${r.fold} not found`);
    if (r.kind === "flow") ok(r.note || r.desc, `${id}: a flow says what to tap`);
    if (r.alt) ok(r.missing || r.note, `${id}: a stand-in target needs a line saying why`);
    for (const en of [false, true]) {
      const c = refCopy(terms[0]!, r, en);
      ok(!/^¿Abrir|^Open /.test(c.title), `${id}: dialog says "${c.title}"`);
      ok(!c.title.includes("…") && !c.desc.includes("…"), `${id}: dialog uses "…"`);
      ok(c.yes.length <= 12, `${id}: button "${c.yes}" too long for one line`);
      ok(c.desc.length <= 90, `${id}: dialog line too long (${c.desc.length})`);
    }
  }
  // 3) "Ver en la app" targets exist
  for (const t of MANUAL_TOPICS) if (t.go?.focus) ok(src.includes(`id="${t.go.focus}"`) || src.includes(`"${t.go.focus}"`), `${t.id}: Ver en la app focus ${t.go.focus} not found`);
  assert.deepEqual(errs, []);
});
