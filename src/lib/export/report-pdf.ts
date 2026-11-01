import { money } from "@/lib/format";
import { Doc, fitText, hex, textWidth, wrapText, type RGB } from "./doc";
import { cap, dayLong, dayShort, fmtHours, type Model } from "./model";
import type { SectionId } from "./options";

/**
 * The PDF (and the printed pages): a readable report, not a copy of the worksheet.
 * Big figures first, one plain sentence per section, then clean tables. Long lists are
 * summed up by month and client here; every row lives in the worksheet.
 */

const C = {
  ink: hex("1A261C"),
  muted: hex("56625A"),
  subtle: hex("8A948C"),
  rule: hex("DCE2D8"),
  faint: hex("F4F7F0"),
  white: [1, 1, 1] as RGB,
  green: hex("1F6A3A"),
  greenSoft: hex("DDEFE1"),
  leaf: hex("3E8E55"),
  blade1: hex("2F7A48"),
  blade2: hex("5A9E62"),
  blade3: hex("8DBE76"),
  money: hex("0F5C6B"),
  moneySoft: hex("DDF0F3"),
  late: hex("B42318"),
  lateSoft: hex("FBE4DF"),
  pending: hex("8A5A12"),
  pendingSoft: hex("F7EACB"),
  soil: hex("6B4E31"),
  soilSoft: hex("EFE4D3"),
  a0: hex("4C9A5F"),
  a31: hex("D8A21E"),
  a61: hex("D9731B"),
  a91: hex("B42318"),
  aOpen: hex("A08E74"),
};

const W = 612;
const H = 792;
const L = 42;
const R = W - 42;
const CW = R - L;
const TOP = 74;
const BOTTOM = 748;

/** Above this many rows a list is summed up in the PDF (every row is in the worksheet). */
const PDF_ROWS = 60;
const LONG_ROWS = 220;

type Align = "left" | "right" | "center";
interface Col {
  label: string;
  w: number;
  align?: Align;
  bold?: boolean;
}
type Cell =
  | string
  | { text: string; color?: RGB; bold?: boolean; sub?: string }
  | { chip: string; fg: RGB; bg: RGB }
  | { check: true; label?: string }
  | { bar: number; color: RGB; text?: string }
  | { stack: { v: number; color: RGB }[]; total: number; text?: string };

export interface PdfResult {
  doc: Doc;
  title: string;
}

export function renderReport(m: Model): PdfResult {
  // Two passes: the first finds the page each section starts on, for the contents line.
  const first = layout(m, null);
  const second = layout(m, first.starts);
  return { doc: second.doc, title: `${m.business} · ${m.title}` };
}

export function reportPdfBytes(m: Model): Uint8Array {
  const { doc, title } = renderReport(m);
  return doc.toBytes(title, m.business);
}

/* ------------------------------------------------------------------ lawn touches */

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A row of grass blades on a thin line: the divider of the report. */
function grass(doc: Doc, x: number, y: number, w: number, h = 12, seed = 7) {
  const rnd = rand(seed);
  doc.line(x, y, x + w, y, C.blade3, 0.8);
  const colors = [C.blade1, C.blade2, C.blade3];
  let at = x + 2;
  while (at < x + w - 3) {
    const bh = h * (0.45 + rnd() * 0.55);
    const lean = (rnd() - 0.5) * 5;
    const bw = 1.3 + rnd() * 1.1;
    blade(doc, at, y, bh, lean, bw, colors[Math.floor(rnd() * 3)]!);
    at += 2.6 + rnd() * 4.2;
  }
}

function blade(doc: Doc, x: number, base: number, h: number, lean: number, bw: number, color: RGB) {
  const pts: [number, number][] = [];
  const steps = 6;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    pts.push([x - bw * (1 - t) + lean * t * t, base - h * t]);
  }
  for (let i = steps; i >= 0; i -= 1) {
    const t = i / steps;
    pts.push([x + bw * (1 - t) + lean * t * t, base - h * t]);
  }
  doc.poly(pts, color);
}

/** A small leaf (the section bullet). */
function leaf(doc: Doc, x: number, y: number, s: number, color: RGB, angle = -0.6) {
  const pts: [number, number][] = [];
  const n = 12;
  const cx = x + s / 2;
  const cy = y + s / 2;
  const rot = (px: number, py: number): [number, number] => {
    const dx = px - cx;
    const dy = py - cy;
    return [cx + dx * Math.cos(angle) - dy * Math.sin(angle), cy + dx * Math.sin(angle) + dy * Math.cos(angle)];
  };
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    pts.push(rot(x + s * t, cy - s * 0.36 * Math.sin(Math.PI * t)));
  }
  for (let i = n - 1; i > 0; i -= 1) {
    const t = i / n;
    pts.push(rot(x + s * t, cy + s * 0.36 * Math.sin(Math.PI * t)));
  }
  doc.poly(pts, color);
  const a = rot(x + s * 0.12, cy);
  const b = rot(x + s * 0.86, cy);
  doc.line(a[0], a[1], b[0], b[1], C.white, 0.5);
}

function chip(doc: Doc, x: number, y: number, text: string, fg: RGB, bg: RGB, size = 7, maxW = 200) {
  const shown = fitText(text, size, maxW - 10, true);
  const w = textWidth(shown, size, true) + 10;
  doc.round(x, y, w, size + 6, (size + 6) / 2, bg);
  doc.text(x + 5, y + 3.2, shown, { size, bold: true, color: fg });
  return w;
}

/* ------------------------------------------------------------------ layout */

interface Ctx {
  doc: Doc;
  m: Model;
  y: number;
  section: string;
  starts: Partial<Record<SectionId, number>>;
}

function layout(m: Model, known: Partial<Record<SectionId, number>> | null) {
  const doc = new Doc(W, H);
  const ctx: Ctx = { doc, m, y: TOP, section: "", starts: {} };
  const tx = m.tx;
  doc.addPage();
  const cover = m.sections.includes("resumen");
  if (cover) drawCover(ctx, known);
  else drawTitleBlock(ctx, known);

  for (const id of m.sections) {
    if (id === "resumen") {
      ctx.starts.resumen = 1;
      continue;
    }
    const fresh = id === "agenda" || id === "asesor";
    if (fresh && !(doc.pageCount === 1 && !cover && ctx.y < 230)) newPage(ctx);
    sectionHead(ctx, id);
    if (id === "cobros") drawCobros(ctx);
    else if (id === "pagos") drawPagos(ctx);
    else if (id === "trabajos") drawTrabajos(ctx);
    else if (id === "agenda") drawAgenda(ctx);
    else if (id === "clientes") drawClientes(ctx);
    else if (id === "precios") drawPrecios(ctx);
    else if (id === "horas") drawHoras(ctx);
    else if (id === "propinas") drawPropinas(ctx);
    else if (id === "pospuestos") drawPospuestos(ctx);
    else if (id === "notas") drawNotas(ctx);
    else if (id === "asesor") drawAsesor(ctx);
    ctx.y += 22;
  }
  if (!m.sections.length) {
    doc.text(L, ctx.y + 10, tx("No elegiste ninguna sección.", "No sections were chosen."), { size: 12, color: C.muted });
  }

  // Header and footer on every page, now that the count is known.
  const total = doc.pageCount;
  for (let i = 0; i < total; i += 1) {
    doc.usePage(i);
    const isCover = i === 0;
    if (!isCover) {
      doc.text(L, 34, m.business, { size: 8.5, bold: true, color: C.green, max: 250 });
      doc.text(R, 34, `${m.title} · ${m.periodLabel}`, { size: 8, color: C.muted, align: "right", max: 300 });
      doc.line(L, 50, R, 50, C.rule, 0.6);
    }
    doc.line(L, 764, R, 764, C.rule, 0.6);
    leaf(doc, L, 770, 8, C.leaf);
    doc.text(L + 12, 771, fitText(`${m.business} · ${m.title} · ${m.periodLabel}`, 7.5, 360), { size: 7.5, color: C.muted });
    doc.text(R, 771, tx(`Página ${i + 1} de ${total}`, `Page ${i + 1} of ${total}`), { size: 7.5, bold: true, color: C.muted, align: "right" });
  }
  return { doc, starts: ctx.starts };
}

function newPage(ctx: Ctx, cont?: string) {
  ctx.doc.addPage();
  ctx.y = TOP;
  if (cont) {
    ctx.doc.text(L, ctx.y, cont, { size: 9, bold: true, color: C.subtle });
    ctx.y += 18;
  }
}

function ensure(ctx: Ctx, h: number) {
  if (ctx.y + h > BOTTOM) {
    newPage(ctx, ctx.section ? `${ctx.section} ${ctx.m.tx("(sigue)", "(continued)")}` : undefined);
    return true;
  }
  return false;
}

function para(ctx: Ctx, text: string, size = 10, color: RGB = C.ink, bold = false, width = CW, x = L, lead = 1.38) {
  const lines = wrapText(text, size, width, bold);
  for (const line of lines) {
    ensure(ctx, size * lead);
    ctx.doc.text(x, ctx.y, line, { size, color, bold });
    ctx.y += size * lead;
  }
}

function sectionHead(ctx: Ctx, id: SectionId) {
  const { doc, m } = ctx;
  ctx.section = "";
  if (ctx.y > TOP + 4) ensure(ctx, 170);
  ctx.section = m.sectionTitle(id);
  ctx.starts[id] = doc.pageCount;
  leaf(doc, L, ctx.y + 1, 15, C.leaf);
  doc.text(L + 21, ctx.y, m.sectionTitle(id), { size: 17, bold: true, color: C.ink });
  ctx.y += 26;
  const sentence = m.takeaway[id];
  if (sentence) {
    para(ctx, sentence, 10.5, C.ink);
    ctx.y += 6;
  }
}

/** A row of small figures: label above, value below. */
function stats(ctx: Ctx, items: { label: string; value: string; color?: RGB }[]) {
  const shown = items.filter((i) => i.value !== "");
  if (!shown.length) return;
  ensure(ctx, 44);
  const gap = 8;
  const w = (CW - gap * (shown.length - 1)) / shown.length;
  shown.forEach((it, i) => {
    const x = L + i * (w + gap);
    ctx.doc.round(x, ctx.y, w, 38, 6, C.faint, C.rule, 0.5);
    ctx.doc.text(x + 9, ctx.y + 7, it.label, { size: 7, bold: true, color: C.muted, max: w - 16 });
    ctx.doc.text(x + 9, ctx.y + 18, it.value, { size: 13, bold: true, color: it.color ?? C.ink, max: w - 16 });
  });
  ctx.y += 48;
}

function note(ctx: Ctx, text: string) {
  ensure(ctx, 16);
  leaf(ctx.doc, L, ctx.y + 1, 7, C.blade3);
  para(ctx, text, 8, C.muted, false, CW - 12, L + 11, 1.35);
  ctx.y += 2;
}

function subhead(ctx: Ctx, text: string) {
  ensure(ctx, 40);
  ctx.doc.text(L, ctx.y, text, { size: 10.5, bold: true, color: C.green });
  ctx.y += 16;
}

/** A table with a header that repeats on each page, zebra rows and optional totals. */
function table(ctx: Ctx, cols: Col[], rows: Cell[][], opts: { rowH?: number; totals?: Cell[]; size?: number; heights?: number[] } = {}) {
  const { doc } = ctx;
  const size = opts.size ?? 8.5;
  const baseH = opts.rowH ?? 17;
  const scale = CW / cols.reduce((a, c) => a + c.w, 0);
  const widths = cols.map((c) => c.w * scale);
  const xs = widths.map((_, i) => L + widths.slice(0, i).reduce((a, b) => a + b, 0));
  const drawHead = () => {
    doc.rect(L, ctx.y, CW, 18, C.greenSoft);
    cols.forEach((c, i) => {
      const pad = 5;
      const x = c.align === "right" ? xs[i]! + widths[i]! - pad : c.align === "center" ? xs[i]! + widths[i]! / 2 : xs[i]! + pad;
      doc.text(x, ctx.y + 5.5, c.label, { size: 7.2, bold: true, color: C.green, align: c.align ?? "left", max: widths[i]! - pad * 2 });
    });
    ctx.y += 18;
  };
  if (ctx.y + 18 + baseH * 2 > BOTTOM) ensure(ctx, 18 + baseH * 2 + 40);
  drawHead();
  rows.forEach((row, ri) => {
    const h = opts.heights?.[ri] ?? baseH;
    // The last row keeps the totals company, so a total never sits alone on a page.
    const need = ri === rows.length - 1 && opts.totals ? h + 22 : h;
    if (ctx.y + need > BOTTOM) {
      newPage(ctx, `${ctx.section} ${ctx.m.tx("(sigue)", "(continued)")}`);
      drawHead();
    }
    if (ri % 2 === 1) doc.rect(L, ctx.y, CW, h, C.faint);
    row.forEach((cell, ci) => drawCell(doc, cell, xs[ci]!, ctx.y, widths[ci]!, h, cols[ci]!, size));
    ctx.y += h;
  });
  doc.line(L, ctx.y, R, ctx.y, C.rule, 0.6);
  if (opts.totals) {
    if (ctx.y + 20 > BOTTOM) newPage(ctx, `${ctx.section} ${ctx.m.tx("(sigue)", "(continued)")}`);
    doc.line(L, ctx.y, R, ctx.y, C.ink, 0.9);
    opts.totals.forEach((cell, ci) => drawCell(doc, typeof cell === "string" ? { text: cell, bold: true } : cell, xs[ci]!, ctx.y + 1, widths[ci]!, 18, cols[ci]!, size));
    ctx.y += 20;
  }
  ctx.y += 8;
}

function drawCell(doc: Doc, cell: Cell, x: number, y: number, w: number, h: number, col: Col, size: number) {
  const pad = 5;
  const align = col.align ?? "left";
  const tx = align === "right" ? x + w - pad : align === "center" ? x + w / 2 : x + pad;
  const max = w - pad * 2;
  if (typeof cell === "string") cell = { text: cell };
  if ("chip" in cell) {
    if (!cell.chip) return;
    const cw = Math.min(max, textWidth(cell.chip, 7, true) + 10);
    const cx = align === "right" ? x + w - pad - cw : align === "center" ? x + (w - cw) / 2 : x + pad;
    chip(doc, cx, y + (h - 13) / 2, cell.chip, cell.fg, cell.bg, 7, max);
    return;
  }
  if ("check" in cell) {
    const s = 9;
    const cx = align === "center" ? x + (w - s) / 2 : x + pad;
    doc.checkbox(cx, y + (h - s) / 2, s, C.muted);
    if (cell.label) doc.text(cx + s + 4, y + (h - 7 * 0.72) / 2 - 0.5, cell.label, { size: 7, bold: true, color: C.late, max: w - s - pad * 2 - 4 });
    return;
  }
  if ("bar" in cell) {
    const textW = cell.text ? Math.min(46, max * 0.45) : 0;
    const bw = Math.max(0, max - textW - (textW ? 4 : 0));
    doc.round(x + pad, y + h / 2 - 3, bw, 6, 3, C.faint, C.rule, 0.3);
    if (cell.bar > 0) doc.round(x + pad, y + h / 2 - 3, Math.max(3, bw * Math.min(1, cell.bar)), 6, 3, cell.color);
    if (cell.text) doc.text(x + w - pad, y + (h - size * 0.72) / 2 - 0.5, cell.text, { size: size - 0.5, color: C.ink, align: "right", max: textW });
    return;
  }
  if ("stack" in cell) {
    const textW = cell.text ? Math.min(48, max * 0.45) : 0;
    const bw = Math.max(0, max - textW - (textW ? 4 : 0));
    doc.round(x + pad, y + h / 2 - 3, bw, 6, 3, C.faint, C.rule, 0.3);
    let at = x + pad;
    for (const part of cell.stack) {
      if (part.v <= 0 || cell.total <= 0) continue;
      const pw = (part.v / cell.total) * bw;
      doc.rect(at, y + h / 2 - 3, pw, 6, part.color);
      at += pw;
    }
    if (cell.text) doc.text(x + w - pad, y + (h - size * 0.72) / 2 - 0.5, cell.text, { size: size - 0.5, color: C.ink, align: "right", max: textW });
    return;
  }
  if (typeof cell === "string" || "text" in cell) {
    const c = typeof cell === "string" ? { text: cell } : cell;
    const sub = "sub" in c ? c.sub : undefined;
    const top = sub ? y + 3.5 : y + (h - size * 0.72) / 2 - 0.5;
    doc.text(tx, top, String(c.text ?? ""), { size, bold: ("bold" in c && c.bold) || col.bold, color: ("color" in c && c.color) || C.ink, align, max });
    if (sub) doc.text(tx, top + size + 2.5, sub, { size: size - 1.3, color: C.muted, align, max });
  }
}

/** Horizontal bars: label, bar, value. */
function hbars(ctx: Ctx, rows: { label: string; value: number; text: string; color?: RGB }[], labelW = 150) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const barW = CW - labelW - 80;
  for (const r of rows) {
    ensure(ctx, 16);
    ctx.doc.text(L, ctx.y + 2, r.label, { size: 8.5, color: C.ink, max: labelW - 8 });
    ctx.doc.round(L + labelW, ctx.y + 1, barW, 9, 4.5, C.faint);
    if (r.value > 0) ctx.doc.round(L + labelW, ctx.y + 1, Math.max(4, (r.value / max) * barW), 9, 4.5, r.color ?? C.leaf);
    ctx.doc.text(R, ctx.y + 2, r.text, { size: 8.5, bold: true, color: C.ink, align: "right", max: 74 });
    ctx.y += 15;
  }
  ctx.y += 6;
}

/** Vertical bars by week, month or year: collected (solid) and work done (light). */
function chart(ctx: Ctx, bars: { label: string; a: number; b: number }[], height: number, showB: boolean, aLabel: string, bLabel: string, fmt: (n: number) => string) {
  const { doc } = ctx;
  const list = bars.slice(-26);
  if (!list.length) return;
  ensure(ctx, height + 46);
  const top = ctx.y + 14;
  const axisW = 40;
  const x0 = L + axisW;
  const w = CW - axisW;
  const max = Math.max(1, ...list.map((b) => Math.max(b.a, showB ? b.b : 0)));
  const step = niceStep(max / 3);
  const ceil = Math.max(step * Math.ceil(max / step), step);
  // Legend.
  doc.round(L, ctx.y, 9, 7, 2, C.money);
  doc.text(L + 13, ctx.y - 0.5, aLabel, { size: 7.5, color: C.muted });
  if (showB) {
    const lx = L + 22 + textWidth(aLabel, 7.5);
    doc.round(lx, ctx.y, 9, 7, 2, C.greenSoft, C.leaf, 0.6);
    doc.text(lx + 13, ctx.y - 0.5, bLabel, { size: 7.5, color: C.muted });
  }
  for (let v = 0; v <= ceil + 0.001; v += step) {
    const y = top + height - (v / ceil) * height;
    doc.line(x0, y, R, y, v === 0 ? C.muted : C.rule, v === 0 ? 0.7 : 0.4, v === 0 ? undefined : [2, 2]);
    doc.text(x0 - 5, y - 3, fmt(v), { size: 6.5, color: C.subtle, align: "right" });
  }
  const slot = w / list.length;
  const bw = Math.min(26, slot * (showB ? 0.36 : 0.6));
  const every = Math.ceil(list.length / 13);
  list.forEach((b, i) => {
    const cx = x0 + slot * i + slot / 2;
    const ha = (b.a / ceil) * height;
    const hb = (b.b / ceil) * height;
    if (showB) {
      if (hb > 0) doc.round(cx + 1, top + height - hb, bw, hb, Math.min(2.5, hb / 2), C.greenSoft, C.leaf, 0.6);
      if (ha > 0) doc.round(cx - bw - 1, top + height - ha, bw, ha, Math.min(2.5, ha / 2), C.money);
    } else if (ha > 0) doc.round(cx - bw / 2, top + height - ha, bw, ha, Math.min(2.5, ha / 2), C.money);
    if (list.length <= 8 && b.a > 0) doc.text(showB ? cx - 1 - bw / 2 : cx, top + height - ha - 9, fmt(b.a), { size: 6.5, bold: true, color: C.money, align: "center" });
    if (i % every === 0) doc.text(cx, top + height + 4, b.label, { size: 6.5, color: C.muted, align: "center", max: slot * every - 2 });
  });
  ctx.y = top + height + 20;
}

function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

const usd = (n: number) => money(n);
function ago(days: number, tx: Model["tx"]) {
  if (days >= 730) return tx(`hace ${Math.floor(days / 365)} años`, `${Math.floor(days / 365)} y ago`);
  if (days >= 365) return tx("hace 1 año", "1 y ago");
  if (days >= 60) return tx(`hace ${Math.floor(days / 30)} meses`, `${Math.floor(days / 30)} mo ago`);
  return tx(`hace ${days} d`, `${days} d ago`);
}
function age(days: number, tx: Model["tx"]) {
  if (days >= 365) return tx(`${(days / 365).toFixed(1).replace(/\.0$/, "")} años`, `${(days / 365).toFixed(1).replace(/\.0$/, "")} y`);
  if (days >= 60) return tx(`${Math.floor(days / 30)} meses`, `${Math.floor(days / 30)} mo`);
  return `${days} d`;
}
const usd0 = (n: number) => money(Math.round(n));
const kfmt = (n: number) => (n >= 10000 ? `$${Math.round(n / 1000)}k` : n >= 1000 ? `$${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `$${Math.round(n)}`);

/* ------------------------------------------------------------------ cover */

function drawTitleBlock(ctx: Ctx, known: Partial<Record<SectionId, number>> | null) {
  const { doc, m } = ctx;
  const tx = m.tx;
  doc.text(L, 40, m.title.toUpperCase(), { size: 8.5, bold: true, color: C.green });
  doc.text(L, 54, m.business, { size: 22, bold: true, color: C.ink, max: CW });
  doc.text(L, 82, m.periodLabel, { size: 11, color: C.muted, max: CW * 0.62 });
  doc.text(R, 84, m.generated, { size: 7.5, color: C.subtle, align: "right" });
  grass(doc, L, 108, CW, 11, 3);
  const list = m.sections.map((id) => `${m.sectionTitle(id)}${known?.[id] ? ` ${known[id]}` : ""}`).join("  ·  ");
  doc.text(L, 116, `${tx("Contenido", "Contents")}: ${list}`, { size: 7.5, color: C.muted, max: CW });
  doc.text(L, 128, m.scope, { size: 7.5, color: C.subtle, max: CW });
  ctx.y = 150;
}

function drawCover(ctx: Ctx, known: Partial<Record<SectionId, number>> | null) {
  const { doc, m } = ctx;
  const tx = m.tx;
  const k = m.kpi;
  doc.text(L, 44, m.title.toUpperCase(), { size: 9, bold: true, color: C.green });
  doc.text(L, 60, m.business, { size: 28, bold: true, color: C.ink, max: CW });
  doc.text(L, 98, m.periodLabel, { size: 13, color: C.muted, max: CW });
  doc.text(L, 118, m.generated, { size: 8, color: C.subtle });
  grass(doc, L, 146, CW, 15, 11);

  // Headline tiles.
  const tiles = m.amounts
    ? [
        { label: tx("COBRADO", "COLLECTED"), value: usd0(k.collected), sub: tx(`${k.payments} ${k.payments === 1 ? "pago" : "pagos"}${k.tips ? ` · ${usd0(k.tips)} propinas` : ""}`, `${k.payments} ${k.payments === 1 ? "payment" : "payments"}${k.tips ? ` · ${usd0(k.tips)} tips` : ""}`), color: C.money },
        { label: tx("TE DEBEN", "OWED TO YOU"), value: usd0(k.owed), sub: k.owedPeople ? tx(`${k.owedPeople} ${k.owedPeople === 1 ? "cliente" : "clientes"} · hoy`, `${k.owedPeople} ${k.owedPeople === 1 ? "client" : "clients"} · today`) : tx("Nadie debe", "Nobody owes"), color: k.owed > 0 ? C.late : C.green },
        { label: tx("TRABAJOS HECHOS", "JOBS DONE"), value: String(k.jobsDone), sub: tx(`valen ${usd0(k.doneValue)}`, `worth ${usd0(k.doneValue)}`), color: C.green },
        { label: tx("CLIENTES ACTIVOS", "ACTIVE CLIENTS"), value: String(k.activeClients), sub: tx(`+ ${k.oneTimeClients} de una vez`, `+ ${k.oneTimeClients} one-time`), color: C.ink },
      ]
    : [
        { label: tx("TRABAJOS HECHOS", "JOBS DONE"), value: String(k.jobsDone), sub: tx(`${k.cuts} cortes · ${k.extras} extras`, `${k.cuts} cuts · ${k.extras} extras`), color: C.green },
        { label: tx("HORAS", "HOURS"), value: fmtHours(k.minutes / 60), sub: tx(`${k.workDays} días trabajados`, `${k.workDays} days worked`), color: C.ink },
        { label: tx("CLIENTES ACTIVOS", "ACTIVE CLIENTS"), value: String(k.activeClients), sub: tx(`+ ${k.oneTimeClients} de una vez`, `+ ${k.oneTimeClients} one-time`), color: C.ink },
        { label: tx("PRÓXIMOS PATIOS", "UPCOMING YARDS"), value: String(m.agenda.total), sub: tx("en la ruta", "on the route"), color: C.green },
      ];
  const gap = 10;
  const tw = (CW - gap * 3) / 4;
  const ty = 172;
  tiles.forEach((t, i) => {
    const x = L + i * (tw + gap);
    doc.round(x, ty, tw, 80, 9, C.faint, C.rule, 0.6);
    doc.rect(x + 10, ty, 22, 2.5, t.color);
    doc.text(x + 10, ty + 12, t.label, { size: 7, bold: true, color: C.muted, max: tw - 18 });
    doc.text(x + 10, ty + 28, t.value, { size: 24, bold: true, color: t.color, max: tw - 18 });
    doc.text(x + 10, ty + 61, t.sub, { size: 7.5, color: C.muted, max: tw - 18 });
  });

  // The one sentence.
  ctx.y = ty + 102;
  doc.text(L, ctx.y, tx("EN UNA FRASE", "IN ONE SENTENCE"), { size: 7.5, bold: true, color: C.green });
  ctx.y += 14;
  const lines = wrapText(m.headline, 13, CW - 18);
  doc.rect(L, ctx.y - 2, 3, lines.length * 18 + 2, C.leaf);
  for (const line of lines) {
    doc.text(L + 14, ctx.y, line, { size: 13, color: C.ink });
    ctx.y += 18;
  }
  ctx.y += 16;

  // Chart.
  if (m.series.bars.length > 1) {
    const unitWord = m.series.unit === "week" ? tx("por semana", "by week") : m.series.unit === "month" ? tx("por mes", "by month") : tx("por año", "by year");
    doc.text(L, ctx.y, m.amounts ? `${tx("Cobrado y trabajo hecho", "Collected and work done")} ${unitWord}` : `${tx("Trabajo hecho", "Work done")} ${unitWord}`, { size: 10.5, bold: true, color: C.ink });
    ctx.y += 18;
    if (m.amounts) chart(ctx, m.series.bars, 130, true, tx("Cobrado", "Collected"), tx("Trabajo hecho", "Work done"), kfmt);
    else chart(ctx, m.series.bars.map((b) => ({ ...b, a: b.b, b: 0 })), 130, false, tx("Valor del trabajo", "Work value"), "", kfmt);
  }

  // Three quick facts, when there is room.
  const facts: { label: string; value: string; sub: string; color: RGB }[] = [];
  const best = m.trabajos.byClient[0];
  if (best) facts.push({ label: tx("CLIENTE CON MÁS TRABAJO", "CLIENT WITH THE MOST WORK"), value: best.name, sub: m.amounts ? tx(`${usd0(best.value)} en ${best.jobs} ${best.jobs === 1 ? "trabajo" : "trabajos"}`, `${usd0(best.value)} over ${best.jobs} ${best.jobs === 1 ? "job" : "jobs"}`) : tx(`${best.jobs} trabajos`, `${best.jobs} jobs`), color: C.green });
  if (k.minutes > 0) facts.push({ label: m.amounts ? tx("CADA HORA DEJÓ", "EACH HOUR BROUGHT") : tx("HORAS TRABAJADAS", "HOURS WORKED"), value: m.amounts ? usd0(m.horas.perHour) : fmtHours(k.minutes / 60), sub: tx(`${fmtHours(k.minutes / 60)} horas en ${k.workDays} días`, `${fmtHours(k.minutes / 60)} hours over ${k.workDays} days`), color: C.money });
  const old = m.cobros.buckets.filter((b) => b.key === "b61" || b.key === "b91");
  const oldAmt = old.reduce((a, b) => a + b.amount, 0);
  if (m.amounts && m.cobros.rows.length) {
    const oldPeople = m.cobros.rows.filter((r) => r.b61 + r.b91 > 0.004).length;
    facts.push({ label: tx("DEUDA DE MÁS DE 60 DÍAS", "DEBT OVER 60 DAYS"), value: usd0(oldAmt), sub: tx(`${oldPeople} ${oldPeople === 1 ? "cliente" : "clientes"} · cóbrala primero`, `${oldPeople} ${oldPeople === 1 ? "client" : "clients"} · collect it first`), color: oldAmt > 0 ? C.late : C.green });
  } else if (m.agenda.total) facts.push({ label: tx("PRÓXIMOS PATIOS", "UPCOMING YARDS"), value: String(m.agenda.total), sub: tx("en la hoja de ruta", "on the route sheet"), color: C.green });
  if (facts.length && ctx.y + 62 < 600) {
    const fw = (CW - 10 * (facts.length - 1)) / facts.length;
    facts.forEach((f, i) => {
      const x = L + i * (fw + 10);
      doc.round(x, ctx.y, fw, 50, 8, null, C.rule, 0.7);
      leaf(doc, x + 10, ctx.y + 9, 8, f.color);
      doc.text(x + 23, ctx.y + 9, f.label, { size: 6.8, bold: true, color: C.muted, max: fw - 32 });
      doc.text(x + 10, ctx.y + 21, f.value, { size: 13, bold: true, color: f.color, max: fw - 20 });
      doc.text(x + 10, ctx.y + 37, f.sub, { size: 7.5, color: C.muted, max: fw - 20 });
    });
    ctx.y += 62;
  }

  // Contents and color key at the foot of the cover.
  const items = m.sections.filter((id) => id !== "resumen");
  const footTop = Math.max(ctx.y + 8, 600);
  let y = footTop;
  if (items.length) {
    doc.text(L, y, tx("EN ESTE INFORME", "IN THIS REPORT"), { size: 7.5, bold: true, color: C.green });
    y += 14;
    const colW = CW / 2 - 10;
    const perCol = Math.ceil(items.length / 2);
    items.forEach((id, i) => {
      const cx = L + (i >= perCol ? colW + 20 : 0);
      const cy = y + (i % perCol) * 15;
      leaf(doc, cx, cy + 1, 7, C.leaf);
      const name = m.sectionTitle(id);
      doc.text(cx + 12, cy, name, { size: 9, color: C.ink });
      const page = known?.[id];
      const pageText = page ? tx(`pág. ${page}`, `p. ${page}`) : "";
      const nw = textWidth(name, 9);
      doc.line(cx + 16 + nw, cy + 7, cx + colW - 34, cy + 7, C.rule, 0.6, [1, 2]);
      doc.text(cx + colW, cy, pageText, { size: 8.5, bold: true, color: C.muted, align: "right" });
    });
    y += perCol * 15 + 12;
  }
  colorKey(doc, L, Math.min(y, 726), tx);
  doc.text(L, Math.min(y, 726) + 18, m.scope, { size: 7.5, color: C.subtle, max: CW });
  newPage(ctx);
}

function colorKey(doc: Doc, x: number, y: number, tx: Model["tx"]) {
  doc.text(x, y + 3, tx("Colores:", "Colors:"), { size: 7.5, bold: true, color: C.muted });
  let at = x + 42;
  const items: [string, RGB, RGB][] = [
    [tx("Hecho / al día", "Done / current"), C.green, C.greenSoft],
    [tx("Dinero cobrado", "Money in"), C.money, C.moneySoft],
    [tx("Pendiente / ojo", "Pending / watch"), C.pending, C.pendingSoft],
    [tx("Atrasado / debe", "Late / owes"), C.late, C.lateSoft],
    [tx("Saldo inicial", "Opening balance"), C.soil, C.soilSoft],
  ];
  for (const [label, fg, bg] of items) at += chip(doc, at, y, label, fg, bg) + 6;
}

/* ------------------------------------------------------------------ sections */

function drawCobros(ctx: Ctx) {
  const { doc, m } = ctx;
  const tx = m.tx;
  const c = m.cobros;
  if (!c.rows.length) return;
  const total = m.kpi.owed;
  const colors: Record<string, RGB> = { b0: C.a0, b31: C.a31, b61: C.a61, b91: C.a91, opening: C.aOpen };
  ensure(ctx, 70);
  doc.text(L, ctx.y, tx("Cuánto tiempo lleva la deuda", "How old the debt is"), { size: 9, bold: true, color: C.muted });
  ctx.y += 14;
  let at = L;
  doc.round(L, ctx.y, CW, 16, 8, C.faint);
  const parts = c.buckets.filter((b) => b.amount > 0);
  parts.forEach((b) => {
    const w = (b.amount / total) * CW;
    doc.rect(at, ctx.y, w, 16, colors[b.key]!);
    if (w > 34) doc.text(at + w / 2, ctx.y + 4.5, `${Math.round((b.amount / total) * 100)}%`, { size: 7, bold: true, color: C.white, align: "center" });
    at += w;
  });
  ctx.y += 24;
  let lx = L;
  for (const b of c.buckets) {
    const label = `${b.label}: ${usd0(b.amount)} (${b.people})`;
    const w = textWidth(label, 7.5) + 18;
    if (lx + w > R) {
      lx = L;
      ctx.y += 13;
    }
    doc.circle(lx + 4, ctx.y + 3.5, 3.5, colors[b.key]!);
    doc.text(lx + 11, ctx.y, label, { size: 7.5, color: b.amount > 0 ? C.ink : C.subtle });
    lx += w + 8;
  }
  ctx.y += 22;
  const tierChip = (t: string): Cell => {
    const serious = /serio|serious/i.test(t);
    const wait = /espera|wait/i.test(t);
    return { chip: t, fg: serious ? C.late : wait ? C.pending : C.green, bg: serious ? C.lateSoft : wait ? C.pendingSoft : C.greenSoft };
  };
  table(
    ctx,
    [
      { label: tx("Cliente", "Client"), w: 150, bold: true },
      { label: tx("Teléfono", "Phone"), w: 82 },
      { label: tx("Debe", "Owes"), w: 58, align: "right" },
      { label: tx("Antigüedad", "Age"), w: 112 },
      { label: tx("Estado", "Status"), w: 62 },
      { label: tx("Último pago", "Last paid"), w: 64, align: "right" },
    ],
    c.rows.map((r) => [
      r.name,
      { text: r.phone || "—", color: r.phone ? C.ink : C.subtle },
      { text: usd(r.balance), bold: true, color: C.late },
      {
        stack: [
          { v: r.b0, color: C.a0 },
          { v: r.b31, color: C.a31 },
          { v: r.b61, color: C.a61 },
          { v: r.b91, color: C.a91 },
          { v: r.opening, color: C.aOpen },
        ],
        total: r.balance,
        text: r.oldestDays != null ? age(r.oldestDays, tx) : tx("inicial", "opening"),
      },
      tierChip(r.tier),
      r.sincePay != null ? ago(r.sincePay, tx) : "—",
    ]),
    { totals: [tx(`${c.rows.length} clientes`, `${c.rows.length} clients`), "", { text: usd(total), bold: true, color: C.late }, "", "", ""] },
  );
  note(ctx, tx("La barra muestra de qué edad es lo que debe cada cliente: verde es reciente, rojo pasa de 90 días, café es saldo de antes de empezar a anotar.", "The bar shows how old each client's debt is: green is recent, red is over 90 days, brown is the balance from before records started."));
  if (c.credits.length) {
    subhead(ctx, tx("A su favor (pagaron por adelantado)", "In their favor (paid ahead)"));
    table(ctx, [{ label: tx("Cliente", "Client"), w: 300, bold: true }, { label: tx("A su favor", "Credit"), w: 100, align: "right" }], c.credits.map((r) => [r.name, { text: usd(r.credit), color: C.money, bold: true }]));
  }
}

function drawPagos(ctx: Ctx) {
  const { m } = ctx;
  const tx = m.tx;
  const k = m.kpi;
  const p = m.pagos;
  stats(ctx, [
    { label: tx("COBRADO", "COLLECTED"), value: usd0(k.collected), color: C.money },
    { label: tx("PAGOS", "PAYMENTS"), value: String(k.payments) },
    { label: tx("PROMEDIO", "AVERAGE"), value: k.payments ? usd0(k.collected / k.payments) : "—" },
    { label: tx("PROPINAS", "TIPS"), value: usd0(k.tips), color: C.green },
    { label: tx("PERDONADO", "FORGIVEN"), value: usd0(k.forgiven), color: k.forgiven ? C.pending : C.ink },
  ]);
  if (p.byMethod.length) {
    subhead(ctx, tx("Por medio de pago", "By payment method"));
    hbars(ctx, p.byMethod.map((x) => ({ label: `${x.label} (${x.n})`, value: x.amount, text: usd0(x.amount), color: C.money })));
  }
  if (p.rows.length <= PDF_ROWS) {
    if (!p.rows.length) return;
    subhead(ctx, tx("Cada pago", "Every payment"));
    table(
      ctx,
      [
        { label: tx("Fecha", "Date"), w: 70 },
        { label: tx("Cliente", "Client"), w: 140, bold: true },
        { label: tx("Monto", "Amount"), w: 60, align: "right" },
        { label: tx("Tipo", "Type"), w: 66 },
        { label: tx("Medio", "Method"), w: 62 },
        { label: tx("Propina", "Tip"), w: 46, align: "right" },
        { label: tx("Nota", "Note"), w: 84 },
      ],
      p.rows.map((r) => [
        dayShort(r.date, m.locale),
        r.name,
        { text: usd(r.amount), bold: true, color: C.money },
        /perdon|forgiv/i.test(r.kind) ? { chip: r.kind, fg: C.pending, bg: C.pendingSoft } : /adelant|advance/i.test(r.kind) ? { chip: r.kind, fg: C.money, bg: C.moneySoft } : { chip: r.kind, fg: C.green, bg: C.greenSoft },
        r.method,
        r.tip ? usd(r.tip) : "",
        { text: r.note, color: C.muted },
      ]),
      { totals: [tx(`${p.rows.length} filas`, `${p.rows.length} rows`), "", { text: usd(k.collected), bold: true, color: C.money }, "", "", usd(k.tips), ""] },
    );
    return;
  }
  spanTable(ctx);
  subhead(ctx, tx("Quién más pagó", "Who paid the most"));
  note(ctx, tx(`Son ${p.rows.length} pagos: aquí van resumidos. La lista completa, fila por fila, está en la hoja de cálculo (pestaña Pagos).`, `There are ${p.rows.length} payments: summed up here. The full list, row by row, is in the worksheet (Payments tab).`));
  table(
    ctx,
    [{ label: tx("Cliente", "Client"), w: 200, bold: true }, { label: tx("Pagos", "Payments"), w: 60, align: "right" }, { label: tx("Total", "Total"), w: 80, align: "right" }, { label: tx("Parte del total", "Share"), w: 188 }],
    p.byClient.slice(0, 15).map((r) => [r.name, String(r.n), { text: usd0(r.amount), bold: true, color: C.money }, { bar: k.collected ? r.amount / k.collected : 0, color: C.money, text: `${Math.round(k.collected ? (r.amount / k.collected) * 100 : 0)}%` }]),
  );
}

/** Week by week for short spans, month by month for longer ones. */
function spanTable(ctx: Ctx) {
  const { m } = ctx;
  const tx = m.tx;
  if (m.series.unit !== "week") {
    subhead(ctx, tx("Mes por mes", "Month by month"));
    monthTable(ctx);
    return;
  }
  subhead(ctx, tx("Semana por semana", "Week by week"));
  const bars = m.series.bars;
  const maxC = Math.max(1, ...bars.map((x) => x.a));
  table(
    ctx,
    [
      { label: tx("Semana del", "Week of"), w: 110, bold: true },
      { label: tx("Trabajos", "Jobs"), w: 60, align: "right" },
      { label: tx("Valor", "Value"), w: 76, align: "right" },
      { label: tx("Cobrado", "Collected"), w: 210 },
      { label: tx("Pagos", "Payments"), w: 72, align: "right" },
    ],
    bars.map((x) => [x.label, String(x.n), usd0(x.b), { bar: x.a / maxC, color: C.money, text: usd0(x.a) }, String(x.p)]),
    {
      totals: [
        tx("Total", "Total"),
        String(bars.reduce((a, x) => a + x.n, 0)),
        usd0(bars.reduce((a, x) => a + x.b, 0)),
        { text: usd0(bars.reduce((a, x) => a + x.a, 0)), color: C.money, bold: true },
        String(bars.reduce((a, x) => a + x.p, 0)),
      ],
    },
  );
}

function monthTable(ctx: Ctx) {
  const { m } = ctx;
  const tx = m.tx;
  const ms = m.months;
  const maxC = Math.max(1, ...ms.map((x) => x.collected));
  table(
    ctx,
    [
      { label: tx("Mes", "Month"), w: 92, bold: true },
      { label: tx("Trabajos", "Jobs"), w: 54, align: "right" },
      { label: tx("Valor", "Value"), w: 64, align: "right" },
      { label: tx("Cobrado", "Collected"), w: 150 },
      { label: tx("Propinas", "Tips"), w: 56, align: "right" },
      { label: tx("Perdonado", "Forgiven"), w: 60, align: "right" },
    ],
    ms.map((x) => [x.label, String(x.jobs), usd0(x.value), { bar: x.collected / maxC, color: C.money, text: usd0(x.collected) }, x.tips ? usd0(x.tips) : "", x.forgiven ? usd0(x.forgiven) : ""]),
    {
      totals: [
        tx("Total", "Total"),
        String(ms.reduce((a, x) => a + x.jobs, 0)),
        usd0(ms.reduce((a, x) => a + x.value, 0)),
        { text: usd0(ms.reduce((a, x) => a + x.collected, 0)), color: C.money, bold: true },
        usd0(ms.reduce((a, x) => a + x.tips, 0)),
        usd0(ms.reduce((a, x) => a + x.forgiven, 0)),
      ],
    },
  );
}

function kindChip(kind: string): Cell {
  if (/extra/i.test(kind)) return { chip: kind, fg: C.money, bg: C.moneySoft };
  if (/vez|one/i.test(kind)) return { chip: kind, fg: C.soil, bg: C.soilSoft };
  return { chip: kind, fg: C.green, bg: C.greenSoft };
}

function drawTrabajos(ctx: Ctx) {
  const { m } = ctx;
  const tx = m.tx;
  const k = m.kpi;
  const t = m.trabajos;
  stats(ctx, [
    { label: tx("TRABAJOS", "JOBS"), value: String(k.jobsDone), color: C.green },
    { label: tx("VALOR", "VALUE"), value: m.amounts ? usd0(k.doneValue) : "" },
    { label: tx("CORTES", "CUTS"), value: String(k.cuts) },
    { label: tx("EXTRAS", "EXTRAS"), value: String(k.extras) },
    { label: tx("DE UNA VEZ", "ONE-TIME"), value: String(k.once) },
  ]);
  if (!t.rows.length) return;
  if (t.rows.length <= PDF_ROWS) {
    table(
      ctx,
      [
        { label: tx("Fecha", "Date"), w: 74 },
        { label: tx("Cliente", "Client"), w: 160, bold: true },
        { label: tx("Tipo", "Kind"), w: 62 },
        { label: tx("Trabajo", "Job"), w: 170 },
        ...(m.amounts ? [{ label: tx("Monto", "Amount"), w: 62, align: "right" as const }] : []),
      ],
      t.rows.map((r) => [dayShort(r.date, m.locale), r.name, kindChip(r.kind), { text: r.job, color: C.muted }, ...(m.amounts ? [usd(r.amount)] : [])]),
      m.amounts ? { totals: [tx(`${t.rows.length} trabajos`, `${t.rows.length} jobs`), "", "", "", usd(k.doneValue)] } : {},
    );
    return;
  }
  if (m.amounts && (!m.sections.includes("pagos") || m.pagos.rows.length <= PDF_ROWS)) spanTable(ctx);
  subhead(ctx, tx("Por cliente", "By client"));
  note(
    ctx,
    t.byClient.length <= 60
      ? tx(`Son ${t.rows.length} trabajos: aquí van sumados por cliente. Cada trabajo, fila por fila, está en la hoja de cálculo (pestaña Trabajos).`, `There are ${t.rows.length} jobs: summed up by client here. Every job, row by row, is in the worksheet (Jobs tab).`)
      : tx(`Son ${t.rows.length} trabajos: aquí van los 40 clientes con más trabajo. Cada trabajo, fila por fila, está en la hoja de cálculo (pestaña Trabajos).`, `There are ${t.rows.length} jobs: here are the 40 clients with the most work. Every job, row by row, is in the worksheet (Jobs tab).`),
  );
  const maxV = Math.max(1, ...t.byClient.map((r) => (m.amounts ? r.value : r.jobs)));
  table(
    ctx,
    [{ label: tx("Cliente", "Client"), w: 200, bold: true }, { label: tx("Trabajos", "Jobs"), w: 60, align: "right" }, ...(m.amounts ? [{ label: tx("Valor", "Value"), w: 80, align: "right" as const }] : []), { label: "", w: 188 }],
    t.byClient.slice(0, t.byClient.length <= 60 ? 60 : 40).map((r) => [r.name, String(r.jobs), ...(m.amounts ? [usd0(r.value)] : []), { bar: (m.amounts ? r.value : r.jobs) / maxV, color: C.leaf }]),
  );
}

function drawAgenda(ctx: Ctx) {
  const { doc, m } = ctx;
  const tx = m.tx;
  const a = m.agenda;
  if (a.vacation) note(ctx, a.vacation);
  const cols: Col[] = [
    { label: "", w: 18, align: "center" },
    { label: "#", w: 22, align: "center" },
    { label: tx("Cliente y dirección", "Client and address"), w: 154, bold: true },
    { label: tx("Teléfono", "Phone"), w: 72 },
    { label: tx("Hora", "Time"), w: 38 },
    { label: tx("Trabajo", "Job"), w: 104 },
    ...(m.amounts ? [{ label: tx("Precio", "Price"), w: 42, align: "right" as const }, { label: tx("Cobrado", "Paid"), w: 78 }] : []),
  ];
  const row = (it: (typeof a.days)[number]["items"][number], i: number): Cell[] => [
    { check: true },
    { text: String(i + 1), color: C.muted },
    { text: it.name, bold: true, sub: it.address || " " },
    { text: it.phone || "—", color: it.phone ? C.ink : C.subtle },
    it.time ? clock(it.time, m.locale) : "",
    { text: it.job, sub: it.cue || undefined },
    ...(m.amounts ? [usd(it.amount), { check: true as const, label: it.owes > 0 ? tx(`debe ${usd0(it.owes)}`, `owes ${usd0(it.owes)}`) : undefined }] : []),
  ];
  if (a.late.length) {
    ensure(ctx, 80);
    doc.round(L, ctx.y, CW, 22, 6, C.lateSoft);
    doc.text(L + 10, ctx.y + 7, tx(`Atrasados · ${a.late.length}`, `Overdue · ${a.late.length}`), { size: 10, bold: true, color: C.late });
    ctx.y += 28;
    table(ctx, cols, a.late.map((it, i) => row({ ...it, job: `${dayShort(it.date, m.locale)} · ${it.job}` }, i)), { rowH: 27 });
  }
  if (!a.days.length) return;
  for (const d of a.days) {
    ensure(ctx, 22 + 18 + 27 * Math.min(3, d.items.length) + 30);
    doc.round(L, ctx.y, CW, 22, 6, C.greenSoft);
    leaf(doc, L + 8, ctx.y + 6, 10, C.leaf);
    doc.text(L + 23, ctx.y + 6.5, d.label, { size: 10.5, bold: true, color: C.green });
    const right = `${d.items.length} ${d.items.length === 1 ? tx("patio", "yard") : tx("patios", "yards")}${m.amounts ? ` · ${usd0(d.items.reduce((s, it) => s + it.amount, 0))}` : ""}`;
    doc.text(R - 10, ctx.y + 7, right, { size: 9, bold: true, color: C.green, align: "right" });
    ctx.y += 28;
    const sectionName = ctx.section;
    ctx.section = `${sectionName} · ${d.label}`;
    table(ctx, cols, d.items.map(row), { rowH: 27 });
    ctx.section = sectionName;
    ensure(ctx, 20);
    doc.text(L, ctx.y, tx("Notas del día:", "Day notes:"), { size: 7.5, color: C.subtle });
    doc.line(L + 58, ctx.y + 8, R, ctx.y + 8, C.rule, 0.6, [2, 2]);
    ctx.y += 22;
  }
}

function clock(hhmm: string, locale: Model["locale"]) {
  const mm = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!mm) return hhmm;
  const h = Number(mm[1]);
  const suffix = h >= 12 ? (locale === "en" ? "pm" : "p.m.") : locale === "en" ? "am" : "a.m.";
  return `${h % 12 || 12}${mm[2] === "00" ? "" : `:${mm[2]}`} ${suffix}`;
}

function drawClientes(ctx: Ctx) {
  const { m } = ctx;
  const tx = m.tx;
  const rows = m.clientRows;
  if (!rows.length) return;
  const groupChip = (g: string): Cell => (/archiv/i.test(g) ? { chip: g, fg: C.muted, bg: C.faint } : /vez|one/i.test(g) ? { chip: g, fg: C.soil, bg: C.soilSoft } : { chip: g, fg: C.green, bg: C.greenSoft });
  table(
    ctx,
    [
      { label: tx("Cliente y dirección", "Client and address"), w: 178, bold: true },
      { label: tx("Teléfono", "Phone"), w: 78 },
      { label: tx("Día y frecuencia", "Day and frequency"), w: 104 },
      ...(m.amounts ? [{ label: tx("Precio", "Price"), w: 44, align: "right" as const }] : []),
      { label: tx("Próximo", "Next"), w: 56 },
      ...(m.amounts ? [{ label: tx("Debe", "Owes"), w: 46, align: "right" as const }] : []),
      { label: tx("Estado", "Status"), w: 62 },
    ],
    rows.map((r) => {
      const sub = [r.address, r.notes ? `${tx("Nota", "Note")}: ${r.notes.replace(/\n/g, " · ")}` : ""].filter(Boolean).join("\n");
      return [
        { text: r.name, bold: true, sub: sub.split("\n")[0] || " " },
        { text: r.phone || "—", color: r.phone ? C.ink : C.subtle },
        { text: r.day || r.every, sub: r.day ? r.every : undefined },
        ...(m.amounts ? [usd(r.price)] : []),
        r.next ? dayShort(r.next, m.locale) : "—",
        ...(m.amounts ? [r.balance > 0.004 ? { text: usd0(r.balance), bold: true, color: C.late } : { text: "—", color: C.subtle }] : []),
        groupChip(r.group),
      ] as Cell[];
    }),
    { rowH: 27 },
  );
  // Notes go on a third line: drawn as a short list after the table, so the table stays even.
  const withNotes = rows.filter((r) => r.notes);
  if (withNotes.length) {
    subhead(ctx, tx("Notas de clientes", "Client notes"));
    for (const r of withNotes) {
      ensure(ctx, 26);
      ctx.doc.text(L, ctx.y, r.name, { size: 8.5, bold: true, color: C.ink, max: 150 });
      const lines = wrapText(r.notes.replace(/\n/g, " · "), 8.5, CW - 160).slice(0, 4);
      lines.forEach((line, i) => ctx.doc.text(L + 160, ctx.y + i * 11.5, line, { size: 8.5, color: C.muted }));
      ctx.y += Math.max(1, lines.length) * 11.5 + 5;
    }
  }
}

function drawPrecios(ctx: Ctx) {
  const { doc, m } = ctx;
  const tx = m.tx;
  const p = m.precios;
  stats(ctx, [
    { label: tx("CORTE TÍPICO", "TYPICAL CUT"), value: usd(p.typical), color: C.green },
    { label: tx("PROMEDIO", "AVERAGE"), value: usd(p.average) },
    { label: tx("MÁS BAJO", "LOWEST"), value: usd(p.low) },
    { label: tx("MÁS ALTO", "HIGHEST"), value: usd(p.high) },
    { label: tx("FIJOS AL MES", "REGULARS A MONTH"), value: usd0(p.monthlyTotal), color: C.money },
  ]);
  if (p.bands.length) {
    subhead(ctx, tx("Cuántos patios hay en cada precio", "How many yards at each price"));
    hbars(ctx, p.bands.map((b) => ({ label: b.label, value: b.n, text: `${b.n}`, color: C.leaf })), 110);
  }
  if (!p.rows.length) return;
  const max = Math.max(1, ...p.rows.map((r) => r.price));
  table(
    ctx,
    [
      { label: tx("Cliente", "Client"), w: 160, bold: true },
      { label: tx("Frecuencia", "Frequency"), w: 104 },
      { label: tx("Precio", "Price"), w: 140 },
      { label: tx("Visitas/mes", "Visits/mo"), w: 56, align: "right" },
      { label: tx("Al mes", "A month"), w: 68, align: "right" },
    ],
    p.rows.map((r) => {
      const low = r.price < p.typical * 0.8 && !/vez|one/i.test(r.group);
      return [
        r.name,
        { text: r.every, color: C.muted },
        { bar: r.price / max, color: low ? C.a31 : C.leaf, text: usd(r.price) },
        r.visits ? String(r.visits).replace(/\.0+$/, "") : "—",
        r.monthly ? usd0(r.monthly) : "—",
      ];
    }),
  );
  doc.round(L, ctx.y, 9, 7, 2, C.a31);
  doc.text(L + 13, ctx.y - 0.5, tx("Barra amarilla: paga 20% o más por debajo del corte típico.", "Yellow bar: pays 20% or more below the typical cut."), { size: 7.5, color: C.muted });
  ctx.y += 14;
}

function drawHoras(ctx: Ctx) {
  const { m } = ctx;
  const tx = m.tx;
  const h = m.horas;
  const hours = m.kpi.minutes / 60;
  stats(ctx, [
    { label: tx("HORAS", "HOURS"), value: fmtHours(hours), color: C.green },
    { label: tx("DÍAS", "DAYS"), value: String(m.kpi.workDays) },
    { label: tx("HORAS POR DÍA", "HOURS A DAY"), value: fmtHours(h.avgDay) },
    { label: tx("$ POR HORA (TRABAJO)", "$ AN HOUR (WORK)"), value: m.amounts ? usd(h.perHour) : "", color: C.money },
    { label: tx("$ POR HORA (COBRADO)", "$ AN HOUR (COLLECTED)"), value: m.amounts ? usd(h.perHourCollected) : "", color: C.money },
  ]);
  const rows = h.rows.filter((r) => r.hours > 0 || r.stopped);
  if (!rows.length) return;
  if (rows.length <= 120) {
    table(
      ctx,
      [
        { label: tx("Fecha", "Date"), w: 78 },
        { label: tx("Entrada", "In"), w: 52 },
        { label: tx("Salida", "Out"), w: 52 },
        { label: tx("Horas", "Hours"), w: 46, align: "right" },
        { label: tx("Trabajos", "Jobs"), w: 50, align: "right" },
        ...(m.amounts ? [{ label: tx("Valor", "Value"), w: 56, align: "right" as const }, { label: tx("$ por hora", "$ an hour"), w: 58, align: "right" as const }] : []),
        { label: tx("Nota", "Note"), w: 136 },
      ],
      rows.map((r) => [
        dayShort(r.date, m.locale),
        r.clockIn ? clock(r.clockIn, m.locale) : "—",
        r.clockOut ? clock(r.clockOut, m.locale) : "—",
        { text: fmtHours(r.hours), bold: true },
        String(r.jobs),
        ...(m.amounts ? [usd0(r.value), r.hours ? { text: usd0(r.value / r.hours), color: C.money } : "—"] : []),
        r.stopped ? { chip: r.stopped, fg: C.pending, bg: C.pendingSoft } : "",
      ]),
      { totals: [tx("Total", "Total"), "", "", fmtHours(hours), String(rows.reduce((a, r) => a + r.jobs, 0)), ...(m.amounts ? [usd0(rows.reduce((a, r) => a + r.value, 0)), usd0(h.perHour)] : []), ""] },
    );
    return;
  }
  // Long spans: month by month.
  const by = new Map<string, { days: number; hours: number; value: number; jobs: number }>();
  for (const r of rows) {
    const k = r.date.slice(0, 7);
    const x = by.get(k) ?? { days: 0, hours: 0, value: 0, jobs: 0 };
    if (r.hours > 0) x.days += 1;
    x.hours += r.hours;
    x.value += r.value;
    x.jobs += r.jobs;
    by.set(k, x);
  }
  const keys = [...by.keys()].sort();
  const maxH = Math.max(1, ...keys.map((k) => by.get(k)!.hours));
  table(
    ctx,
    [
      { label: tx("Mes", "Month"), w: 100, bold: true },
      { label: tx("Días", "Days"), w: 50, align: "right" },
      { label: tx("Horas", "Hours"), w: 150 },
      { label: tx("Trabajos", "Jobs"), w: 60, align: "right" },
      ...(m.amounts ? [{ label: tx("Valor", "Value"), w: 70, align: "right" as const }, { label: tx("$ por hora", "$ an hour"), w: 70, align: "right" as const }] : []),
    ],
    keys.map((k) => {
      const x = by.get(k)!;
      return [cap(dayLong(`${k}-01`, m.locale).replace(/^1 /, "")), String(x.days), { bar: x.hours / maxH, color: C.leaf, text: fmtHours(x.hours) }, String(x.jobs), ...(m.amounts ? [usd0(x.value), x.hours ? { text: usd0(x.value / x.hours), color: C.money } : "—"] : [])];
    }),
  );
  note(ctx, tx("Cada día, con su hora de entrada y salida, está en la hoja de cálculo (pestaña Horas).", "Every day, with its clock-in and clock-out, is in the worksheet (Hours tab)."));
}

function drawPropinas(ctx: Ctx) {
  const { m } = ctx;
  const tx = m.tx;
  const p = m.propinas;
  stats(ctx, [
    { label: tx("PROPINAS", "TIPS"), value: usd0(m.kpi.tips), color: C.green },
    { label: tx("CUÁNTAS", "HOW MANY"), value: String(p.rows.length) },
    { label: tx("PROMEDIO", "AVERAGE"), value: usd(p.avg) },
    { label: tx("CLIENTES", "CLIENTS"), value: String(p.byClient.length) },
  ]);
  if (!p.rows.length) return;
  subhead(ctx, tx("Quién deja propina", "Who tips"));
  hbars(ctx, p.byClient.slice(0, 12).map((x) => ({ label: `${x.name} (${x.n})`, value: x.tip, text: usd0(x.tip), color: C.leaf })));
  if (p.rows.length <= 150) {
    table(
      ctx,
      [{ label: tx("Fecha", "Date"), w: 90 }, { label: tx("Cliente", "Client"), w: 220, bold: true }, { label: tx("Propina", "Tip"), w: 80, align: "right" }, { label: tx("Medio", "Method"), w: 110 }],
      p.rows.map((r) => [dayShort(r.date, m.locale), r.name, { text: usd(r.tip), bold: true, color: C.green }, r.method || "—"]),
      { totals: [tx("Total", "Total"), "", usd(m.kpi.tips), ""] },
    );
  } else note(ctx, tx("Cada propina está en la hoja de cálculo (pestaña Propinas).", "Every tip is in the worksheet (Tips tab)."));
}

function drawPospuestos(ctx: Ctx) {
  const { m } = ctx;
  const tx = m.tx;
  const p = m.pospuestos;
  if (p.byReason.length) {
    subhead(ctx, tx("Por qué se movieron", "Why they moved"));
    hbars(ctx, p.byReason.slice(0, 8).map((r) => ({ label: r.reason, value: r.n, text: String(r.n), color: C.a31 })));
  }
  if (p.rows.length) {
    const rows = p.rows.slice(-LONG_ROWS);
    table(
      ctx,
      [{ label: tx("Era el", "Was on"), w: 80 }, { label: tx("Pasó al", "Moved to"), w: 80 }, { label: tx("Cliente", "Client"), w: 160, bold: true }, { label: tx("Trabajo", "Job"), w: 110 }, { label: tx("Motivo", "Reason"), w: 98 }],
      rows.map((r) => [dayShort(r.from, m.locale), { text: dayShort(r.to, m.locale), bold: true }, r.name, { text: r.job, color: C.muted }, { chip: r.reason, fg: C.pending, bg: C.pendingSoft }]),
    );
    if (p.rows.length > rows.length) note(ctx, tx(`Aquí van los últimos ${rows.length} de ${p.rows.length}. Todos están en la hoja de cálculo.`, `These are the last ${rows.length} of ${p.rows.length}. All of them are in the worksheet.`));
  }
  if (p.offDays.length) {
    subhead(ctx, tx("Días libres y paradas", "Days off and early stops"));
    table(ctx, [{ label: tx("Fecha", "Date"), w: 110 }, { label: tx("Motivo", "Reason"), w: 418 }], p.offDays.slice(-120).map((d) => [dayShort(d.date, m.locale), d.reason]));
  }
}

function drawNotas(ctx: Ctx) {
  const { doc, m } = ctx;
  const tx = m.tx;
  const n = m.notas;
  if (n.day.length) {
    subhead(ctx, tx("Notas del día", "Day notes"));
    for (const d of n.day) {
      ensure(ctx, 28);
      doc.text(L, ctx.y, dayShort(d.date, m.locale), { size: 8.5, bold: true, color: C.green });
      const before = ctx.y;
      para(ctx, d.text, 9, C.ink, false, CW - 80, L + 80, 1.35);
      if (ctx.y === before) ctx.y += 12;
      ctx.y += 4;
    }
  }
  if (n.pages.length) {
    subhead(ctx, tx("Fichero", "Notebook"));
    for (const p of n.pages) {
      ensure(ctx, 40);
      leaf(doc, L, ctx.y + 1, 9, p.pinned ? C.a31 : C.leaf);
      let x = L + 14 + doc.text(L + 14, ctx.y, p.title, { size: 10, bold: true, color: C.ink, max: 300 }) + 8;
      if (p.folder) x += chip(doc, x, ctx.y - 1.5, p.folder, C.green, C.greenSoft) + 6;
      if (p.due) chip(doc, x, ctx.y - 1.5, tx(`para el ${dayLong(p.due, m.locale)}`, `due ${dayLong(p.due, m.locale)}`), C.pending, C.pendingSoft);
      ctx.y += 15;
      const lines = wrapText(p.text, 9, CW - 14);
      for (const line of lines.slice(0, 14)) {
        ensure(ctx, 12);
        doc.text(L + 14, ctx.y, line, { size: 9, color: C.muted });
        ctx.y += 12.2;
      }
      if (lines.length > 14) {
        doc.text(L + 14, ctx.y, tx("… sigue en la app.", "… continues in the app."), { size: 8, color: C.subtle });
        ctx.y += 12;
      }
      ctx.y += 8;
    }
  }
  // A lined page to write on (on this page when nothing else was written above).
  if (n.day.length || n.pages.length || ctx.y > 420) {
    newPage(ctx);
    ctx.section = "";
    leaf(doc, L, ctx.y + 1, 13, C.leaf);
    doc.text(L + 19, ctx.y, tx("Notas a mano", "Handwritten notes"), { size: 15, bold: true, color: C.ink });
    ctx.y += 30;
  } else ctx.y += 10;
  for (let y = ctx.y; y < 706; y += 24) doc.line(L, y, R, y, C.rule, 0.6);
  grass(doc, L, 738, CW, 14, 21);
  ctx.y = 740;
}

function drawAsesor(ctx: Ctx) {
  const { doc, m } = ctx;
  const tx = m.tx;
  const a = m.asesor;
  if (!a) return;
  ensure(ctx, 150);
  // Grass dial: blades around a disc, lit up to the score.
  const cx = L + 62;
  const cy = ctx.y + 62;
  const n = 40;
  const lit = Math.round((a.score / 100) * n);
  const tone = a.tone === "good" ? C.green : a.tone === "warn" ? C.a31 : C.late;
  for (let i = 0; i < n; i += 1) {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    const on = i < lit;
    const r0 = 40;
    const len = on ? 18 : 11;
    const pts: [number, number][] = [];
    const wv = 2.6;
    const nx = Math.cos(ang);
    const ny = Math.sin(ang);
    const px = -ny;
    const py = nx;
    pts.push([cx + nx * r0 + px * wv, cy + ny * r0 + py * wv]);
    pts.push([cx + nx * (r0 + len * 0.6) + px * wv * 0.6 + px * 1.5, cy + ny * (r0 + len * 0.6) + py * wv * 0.6 + py * 1.5]);
    pts.push([cx + nx * (r0 + len) + px * 2.2, cy + ny * (r0 + len) + py * 2.2]);
    pts.push([cx + nx * (r0 + len * 0.6) - px * wv * 0.5 + px * 1.5, cy + ny * (r0 + len * 0.6) - py * wv * 0.5 + py * 1.5]);
    pts.push([cx + nx * r0 - px * wv, cy + ny * r0 - py * wv]);
    doc.poly(pts, on ? tone : C.rule);
  }
  doc.circle(cx, cy, 36, C.faint, C.rule);
  doc.text(cx, cy - 16, String(a.score), { size: 24, bold: true, color: tone, align: "center" });
  doc.text(cx, cy + 6, "/100", { size: 7.5, color: C.muted, align: "center" });
  doc.text(cx, cy + 16, a.word, { size: 8, bold: true, color: tone, align: "center" });
  const tx0 = L + 140;
  let ty = ctx.y + 18;
  for (const line of wrapText(a.title, 14, R - tx0, true)) {
    doc.text(tx0, ty, line, { size: 14, bold: true, color: C.ink });
    ty += 18;
  }
  ty += 2;
  for (const line of wrapText(a.sub, 10, R - tx0)) {
    doc.text(tx0, ty, line, { size: 10, color: C.muted });
    ty += 13.5;
  }
  ctx.y = Math.max(cy + 70, ty + 10);
  if (a.moves.length) {
    subhead(ctx, tx("Tus mejores pasos", "Your best moves"));
    a.moves.forEach((mv, i) => {
      const lines = wrapText(mv.line, 9, CW - 150);
      const h = 24 + lines.length * 12;
      ensure(ctx, h + 8);
      doc.round(L, ctx.y, CW, h, 8, C.faint, C.rule, 0.5);
      doc.circle(L + 16, ctx.y + 16, 9, C.green);
      doc.text(L + 16, ctx.y + 12, String(i + 1), { size: 10, bold: true, color: C.white, align: "center" });
      doc.text(L + 32, ctx.y + 9, mv.title, { size: 10.5, bold: true, color: C.ink, max: CW - 170 });
      lines.forEach((line, li) => doc.text(L + 32, ctx.y + 24 + li * 12, line, { size: 9, color: C.muted }));
      doc.text(R - 10, ctx.y + 9, mv.impact, { size: 10.5, bold: true, color: C.money, align: "right", max: 130 });
      ctx.y += h + 8;
    });
  }
  if (a.checks.length) {
    subhead(ctx, tx("Cinco revisiones", "Five checks"));
    table(
      ctx,
      [{ label: tx("Revisión", "Check"), w: 110, bold: true }, { label: tx("Cómo va", "How it is"), w: 70 }, { label: tx("En palabras", "In plain words"), w: 348 }],
      a.checks.map((c) => [
        c.label,
        c.status === "pass" ? { chip: tx("Bien", "Good"), fg: C.green, bg: C.greenSoft } : c.status === "warn" ? { chip: tx("Ojo", "Watch"), fg: C.pending, bg: C.pendingSoft } : { chip: tx("Mal", "Weak"), fg: C.late, bg: C.lateSoft },
        { text: c.line, color: C.ink },
      ]),
      { rowH: 20 },
    );
  }
  note(ctx, tx("El asesor lee el negocio de hoy (últimos 12 meses), no solo el periodo elegido.", "The advisor reads the business as of today (last 12 months), not only the chosen period."));
}
