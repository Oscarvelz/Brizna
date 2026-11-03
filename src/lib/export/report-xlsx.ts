import type { Model } from "./model";
import type { SectionId } from "./options";

/**
 * The worksheet: a real .xlsx (Excel, Google Sheets, LibreOffice, Numbers). Data to sort,
 * filter and sum: dates are dates, money is currency, every tab has a frozen header,
 * a filter and a totals row that follows the filter (SUBTOTAL).
 */

const GREEN = "1F6A3A";
const GREEN_SOFT = "DDEFE1";
const INK = "1A261C";
const MUTED = "56625A";
const RULE = "D5DCD1";
const FAINT = "F4F7F0";
const MONEY = "0F5C6B";
const LATE = "B42318";

interface Style {
  fill?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  size?: number;
  align?: "left" | "center" | "right";
  border?: boolean;
  wrap?: boolean;
  fmt?: "date" | "money" | "int" | "num1" | "pct";
  top?: boolean;
}

interface XCell {
  v?: string | number | null;
  f?: string;
  s?: Style;
}

interface Sheet {
  name: string;
  rows: (XCell | null)[][];
  widths: number[];
  merges?: string[];
  freeze?: number;
  filter?: string;
  heights?: Record<number, number>;
  tab?: string;
  landscape?: boolean;
}

const FMT: Record<NonNullable<Style["fmt"]>, number> = { date: 165, money: 164, int: 1, num1: 166, pct: 9 };

function colName(index: number): string {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const digit = (current - 1) % 26;
    name = String.fromCharCode(65 + digit) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function xml(value: unknown): string {
  const amp = String.fromCharCode(38);
  return String(value ?? "")
    .split("&").join(`${amp}amp;`)
    .split("<").join(`${amp}lt;`)
    .split(">").join(`${amp}gt;`)
    .split('"').join(`${amp}quot;`)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

/** ISO date → spreadsheet day number (1900 system). */
function serial(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - Date.UTC(1899, 11, 30)) / 86400000);
}

class Styles {
  fonts = [`<font><sz val="10"/><color rgb="FF${INK}"/><name val="Calibri"/><family val="2"/></font>`];
  fills = [`<fill><patternFill patternType="none"/></fill>`, `<fill><patternFill patternType="gray125"/></fill>`];
  borders = [`<border><left/><right/><top/><bottom/><diagonal/></border>`];
  xfs = [`<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`];
  private seen = new Map<string, number>();
  constructor(private dateFmt: string) {}

  private index(list: string[], item: string): number {
    const at = list.indexOf(item);
    if (at >= 0) return at;
    list.push(item);
    return list.length - 1;
  }

  id(style: Style | undefined): number {
    if (!style) return 0;
    const key = JSON.stringify(style);
    const known = this.seen.get(key);
    if (known != null) return known;
    const font = this.index(
      this.fonts,
      `<font>${style.bold ? "<b/>" : ""}${style.italic ? "<i/>" : ""}<sz val="${style.size ?? 10}"/><color rgb="FF${style.color ?? INK}"/><name val="Calibri"/><family val="2"/></font>`,
    );
    const fill = style.fill ? this.index(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${style.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const side = (name: string, color = RULE, weight = "thin") => `<${name} style="${weight}"><color rgb="FF${color}"/></${name}>`;
    const border = style.border
      ? this.index(this.borders, `<border>${side("left")}${side("right")}${style.top ? side("top", INK, "medium") : side("top")}${side("bottom")}<diagonal/></border>`)
      : style.top
        ? this.index(this.borders, `<border><left/><right/>${side("top", INK, "medium")}<bottom/><diagonal/></border>`)
        : 0;
    const numFmt = style.fmt ? FMT[style.fmt] : 0;
    const align = `<alignment${style.align ? ` horizontal="${style.align}"` : ""} vertical="center"${style.wrap ? ` wrapText="1"` : ""}/>`;
    this.xfs.push(
      `<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${numFmt ? ` applyNumberFormat="1"` : ""}>${align}</xf>`,
    );
    const id = this.xfs.length - 1;
    this.seen.set(key, id);
    return id;
  }

  xml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="${xml(this.dateFmt)}"/><numFmt numFmtId="166" formatCode="0.0"/></numFmts>
<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts>
<fills count="${this.fills.length}">${this.fills.join("")}</fills>
<borders count="${this.borders.length}">${this.borders.join("")}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  }
}

function sheetXml(sheet: Sheet, styles: Styles): string {
  const body = sheet.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, column) => {
          if (!cell) return "";
          const ref = `${colName(column)}${rowIndex + 1}`;
          const s = styles.id(cell.s);
          if (cell.f) {
            const cached = typeof cell.v === "number" ? `<v>${cell.v}</v>` : "";
            return `<c r="${ref}" s="${s}"><f>${xml(cell.f)}</f>${cached}</c>`;
          }
          if (typeof cell.v === "number" && Number.isFinite(cell.v)) return `<c r="${ref}" s="${s}"><v>${cell.v}</v></c>`;
          if (cell.v == null || cell.v === "") return `<c r="${ref}" s="${s}"/>`;
          return `<c r="${ref}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${xml(cell.v)}</t></is></c>`;
        })
        .join("");
      const height = sheet.heights?.[rowIndex + 1];
      return `<row r="${rowIndex + 1}"${height ? ` ht="${height}" customHeight="1"` : ""}>${cells}</row>`;
    })
    .join("");
  const freeze = sheet.freeze
    ? `<pane ySplit="${sheet.freeze}" topLeftCell="A${sheet.freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${sheet.freeze + 1}" sqref="A${sheet.freeze + 1}"/>`
    : "";
  const cols = sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const merges = sheet.merges?.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>` : "";
  const filter = sheet.filter ? `<autoFilter ref="${sheet.filter}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr>${sheet.tab ? `<tabColor rgb="FF${sheet.tab}"/>` : ""}<pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" showGridLines="0">${freeze}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="16"/>
<cols>${cols}</cols>
<sheetData>${body}</sheetData>
${filter}${merges}
<printOptions horizontalCentered="1"/>
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
<pageSetup orientation="${sheet.landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>
${sheet.freeze ? `<headerFooter><oddFooter>&amp;L${xml(sheet.name)}&amp;R&amp;P / &amp;N</oddFooter></headerFooter>` : ""}
</worksheet>`;
}

/* ------------------------------------------------------------------ table tabs */

type ColType = "text" | "date" | "money" | "int" | "num1" | "check";
interface Col {
  h: string;
  w: number;
  type: ColType;
  total?: "sum" | "count";
  money?: boolean;
  bold?: boolean;
  wrap?: boolean;
  color?: string;
}
type Val = string | number | null | { f: string; v?: number };

function cellFor(col: Col, value: Val, zebra: boolean): XCell {
  const base: Style = { border: true, fill: zebra ? FAINT : undefined, bold: col.bold, color: col.color, wrap: col.wrap };
  if (value && typeof value === "object") {
    return { f: value.f, v: value.v, s: { ...base, fmt: col.type === "money" ? "money" : col.type === "num1" ? "num1" : undefined, align: "right" } };
  }
  if (col.type === "date") {
    const n = typeof value === "string" ? serial(value) : null;
    return { v: n, s: { ...base, fmt: "date", align: "left" } };
  }
  if (col.type === "money") return { v: typeof value === "number" ? Math.round(value * 100) / 100 : null, s: { ...base, fmt: "money" } };
  if (col.type === "int" && typeof value === "string" && value) return { v: value, s: { ...base, align: "right", color: MUTED } as Style };
  if (col.type === "int") return { v: typeof value === "number" ? value : null, s: { ...base, fmt: "int" } };
  if (col.type === "num1") return { v: typeof value === "number" ? Math.round(value * 100) / 100 : null, s: { ...base, fmt: "num1" } };
  if (col.type === "check") return { v: "☐", s: { ...base, align: "center", size: 12, color: MUTED } };
  return { v: value == null ? "" : String(value), s: base };
}

function tableSheet(name: string, title: string, sub: string, cols0: Col[], rows: Val[][], amounts: boolean, tab = GREEN): Sheet {
  const keep = cols0.map((c, i) => [c, i] as const).filter(([c]) => amounts || !c.money);
  const cols = keep.map(([c]) => c);
  const data = rows.map((r) => keep.map(([, i]) => r[i] ?? null));
  const last = colName(cols.length - 1);
  const head = 3;
  const out: (XCell | null)[][] = [];
  out.push([{ v: title, s: { bold: true, size: 15, color: GREEN } }]);
  out.push([{ v: sub, s: { italic: true, size: 9.5, color: MUTED } }]);
  out.push(cols.map((c) => ({ v: c.h, s: { bold: true, color: "FFFFFF", fill: GREEN, border: true, wrap: true, align: c.type === "money" || c.type === "int" || c.type === "num1" ? "right" : c.type === "check" ? "center" : "left" } as Style })));
  data.forEach((r, ri) => out.push(cols.map((c, ci) => cellFor(c, r[ci] ?? null, ri % 2 === 1))));
  if (!data.length) out.push([{ v: "—", s: { italic: true, color: MUTED } }]);
  const firstData = head + 1;
  const lastData = head + data.length;
  if (data.length && cols.some((c) => c.total)) {
    out.push(
      cols.map((c, ci) => {
        const col = colName(ci);
        if (ci === 0) return { v: `Total`, s: { bold: true, top: true, fill: GREEN_SOFT } };
        if (!c.total) return { v: "", s: { top: true, fill: GREEN_SOFT } };
        const fn = c.total === "count" ? 103 : 109;
        const cached = c.total === "count" ? data.filter((r) => r[ci] != null && r[ci] !== "").length : Math.round(data.reduce((a, r) => a + (typeof r[ci] === "number" ? (r[ci] as number) : typeof r[ci] === "object" && r[ci] ? ((r[ci] as { v?: number }).v ?? 0) : 0), 0) * 100) / 100;
        return { f: `SUBTOTAL(${fn},${col}${firstData}:${col}${lastData})`, v: cached, s: { bold: true, top: true, fill: GREEN_SOFT, fmt: c.type === "money" ? "money" : c.type === "num1" ? "num1" : "int", color: c.type === "money" ? MONEY : INK } };
      }),
    );
  }
  return {
    name,
    rows: out,
    widths: cols.map((c) => c.w),
    merges: [`A1:${last}1`, `A2:${last}2`],
    freeze: head,
    filter: data.length ? `A${head}:${last}${lastData}` : undefined,
    heights: { 1: 24, 2: 30, 3: 30 },
    tab,
    landscape: cols.length > 6,
  };
}

/* ------------------------------------------------------------------ workbook */

export function tabNames(m: Model): { id: SectionId | "meses" | "libres"; name: string }[] {
  const tx = m.tx;
  const out: { id: SectionId | "meses" | "libres"; name: string }[] = [{ id: "resumen", name: tx("Resumen", "Summary") }];
  const has = (id: SectionId) => m.sections.includes(id);
  if (m.amounts && (has("resumen") || has("pagos") || has("trabajos") || has("propinas"))) out.push({ id: "meses", name: tx("Por mes", "By month") });
  const names: Partial<Record<SectionId, string>> = {
    cobros: tx("Te deben", "Owed"),
    pagos: tx("Pagos", "Payments"),
    trabajos: tx("Trabajos", "Jobs"),
    agenda: tx("Agenda", "Route"),
    clientes: tx("Clientes", "Clients"),
    precios: tx("Precios", "Prices"),
    horas: tx("Horas", "Hours"),
    propinas: tx("Propinas", "Tips"),
    pospuestos: tx("Pospuestos", "Postponed"),
    notas: tx("Notas", "Notes"),
    asesor: tx("Asesor", "Advisor"),
  };
  for (const id of m.sections) {
    if (id === "resumen" || !names[id]) continue;
    out.push({ id, name: names[id]! });
    if (id === "pospuestos" && m.pospuestos.offDays.length) out.push({ id: "libres", name: tx("Días libres", "Days off") });
  }
  return out;
}

export function reportXlsxBytes(m: Model): Uint8Array {
  const tx = m.tx;
  const a = m.amounts;
  const sub = (id: SectionId) => m.takeaway[id] ?? "";
  const tabs = tabNames(m);
  const sheets: Sheet[] = [];
  const rowsCount: Record<string, number> = {};
  for (const t of tabs) {
    let sheet: Sheet | null = null;
    if (t.id === "meses") {
      sheet = tableSheet(
        t.name,
        tx("Mes por mes", "Month by month"),
        tx(`Trabajo hecho, cobrado, propinas y perdonado de cada mes · ${m.periodLabel}`, `Work done, collected, tips and forgiven each month · ${m.periodLabel}`),
        [
          { h: tx("Mes", "Month"), w: 16, type: "text", bold: true },
          { h: tx("Desde", "From"), w: 12, type: "date" },
          { h: tx("Trabajos", "Jobs"), w: 10, type: "int", total: "sum" },
          { h: tx("Valor del trabajo", "Work value"), w: 15, type: "money", total: "sum", money: true },
          { h: tx("Cobrado", "Collected"), w: 14, type: "money", total: "sum", money: true, color: MONEY },
          { h: tx("Pagos", "Payments"), w: 9, type: "int", total: "sum" },
          { h: tx("Propinas", "Tips"), w: 12, type: "money", total: "sum", money: true },
          { h: tx("Perdonado", "Forgiven"), w: 12, type: "money", total: "sum", money: true },
        ],
        m.months.map((x) => [x.label, `${x.key}-01`, x.jobs, x.value, x.collected, x.payments, x.tips, x.forgiven]),
        a,
        MONEY,
      );
      rowsCount[t.name] = m.months.length;
    } else if (t.id === "cobros") {
      sheet = tableSheet(
        t.name,
        tx("Te deben", "Owed to you"),
        sub("cobros"),
        [
          { h: tx("Cliente", "Client"), w: 26, type: "text", bold: true },
          { h: tx("Teléfono", "Phone"), w: 15, type: "text" },
          { h: tx("Debe", "Owes"), w: 12, type: "money", total: "sum", money: true, color: LATE, bold: true },
          { h: tx("0–30 días", "0–30 days"), w: 11, type: "money", total: "sum", money: true },
          { h: tx("31–60 días", "31–60 days"), w: 11, type: "money", total: "sum", money: true },
          { h: tx("61–90 días", "61–90 days"), w: 11, type: "money", total: "sum", money: true },
          { h: tx("Más de 90", "Over 90"), w: 11, type: "money", total: "sum", money: true },
          { h: tx("Saldo inicial", "Opening balance"), w: 12, type: "money", total: "sum", money: true },
          { h: tx("Días de la deuda más vieja", "Days of oldest debt"), w: 13, type: "int" },
          { h: tx("Estado", "Status"), w: 12, type: "text" },
          { h: tx("Días desde el último pago", "Days since last payment"), w: 13, type: "int" },
          { h: tx("Trabajos sin pagar", "Unpaid jobs"), w: 11, type: "int", total: "sum" },
        ],
        m.cobros.rows.map((r) => [r.name, r.phone, r.balance, r.b0, r.b31, r.b61, r.b91, r.opening, r.oldestDays, r.tier, r.sincePay ?? tx("Sin pagos", "No payments"), r.unpaidJobs]),
        a,
        LATE,
      );
      rowsCount[t.name] = m.cobros.rows.length;
    } else if (t.id === "pagos") {
      sheet = tableSheet(
        t.name,
        tx("Pagos recibidos", "Payments received"),
        sub("pagos"),
        [
          { h: tx("Fecha", "Date"), w: 12, type: "date" },
          { h: tx("Cliente", "Client"), w: 26, type: "text", bold: true },
          { h: tx("Monto", "Amount"), w: 12, type: "money", total: "sum", money: true, color: MONEY },
          { h: tx("Tipo", "Type"), w: 12, type: "text" },
          { h: tx("Medio", "Method"), w: 12, type: "text" },
          { h: tx("Propina", "Tip"), w: 10, type: "money", total: "sum", money: true },
          { h: tx("Nota", "Note"), w: 34, type: "text" },
        ],
        m.pagos.rows.map((r) => [r.date, r.name, r.amount, r.kind, r.method, r.tip || null, r.note]),
        a,
        MONEY,
      );
      rowsCount[t.name] = m.pagos.rows.length;
    } else if (t.id === "trabajos") {
      sheet = tableSheet(
        t.name,
        tx("Trabajos hechos", "Work done"),
        sub("trabajos"),
        [
          { h: tx("Fecha", "Date"), w: 12, type: "date" },
          { h: tx("Cliente", "Client"), w: 26, type: "text", bold: true },
          { h: tx("Tipo", "Kind"), w: 11, type: "text" },
          { h: tx("Trabajo", "Job"), w: 30, type: "text" },
          { h: tx("Monto", "Amount"), w: 12, type: "money", total: "sum", money: true },
        ],
        m.trabajos.rows.map((r) => [r.date, r.name, r.kind, r.job, r.amount]),
        a,
      );
      rowsCount[t.name] = m.trabajos.rows.length;
    } else if (t.id === "agenda") {
      const items = [...m.agenda.late, ...m.agenda.days.flatMap((d) => d.items)];
      sheet = tableSheet(
        t.name,
        tx("Agenda próxima", "Upcoming route"),
        sub("agenda"),
        [
          { h: tx("Hecho", "Done"), w: 7, type: "check" },
          { h: tx("Fecha", "Date"), w: 12, type: "date", bold: true },
          { h: "#", w: 5, type: "int" },
          { h: tx("Cliente", "Client"), w: 24, type: "text", bold: true },
          { h: tx("Dirección", "Address"), w: 32, type: "text" },
          { h: tx("Teléfono", "Phone"), w: 15, type: "text" },
          { h: tx("Hora", "Time"), w: 8, type: "text" },
          { h: tx("Trabajo", "Job"), w: 24, type: "text" },
          { h: tx("Precio", "Price"), w: 10, type: "money", total: "sum", money: true },
          { h: tx("Debe", "Owes"), w: 10, type: "money", money: true, color: LATE },
          { h: tx("Atrasado", "Overdue"), w: 9, type: "text" },
          { h: tx("Nota", "Note"), w: 30, type: "text" },
        ],
        items.map((it) => {
          const dayIndex = m.agenda.days.find((d) => d.date === it.date)?.items.indexOf(it) ?? -1;
          return [null, it.date, dayIndex >= 0 ? dayIndex + 1 : null, it.name, it.address, it.phone, it.time, it.job, it.amount, it.owes || null, it.late ? tx("Sí", "Yes") : "", it.cue];
        }),
        a,
      );
      rowsCount[t.name] = items.length;
    } else if (t.id === "clientes") {
      sheet = tableSheet(
        t.name,
        tx("Clientes", "Clients"),
        sub("clientes"),
        [
          { h: tx("Cliente", "Client"), w: 26, type: "text", bold: true },
          { h: tx("Estado", "Status"), w: 11, type: "text" },
          { h: tx("Teléfono", "Phone"), w: 15, type: "text" },
          { h: tx("Dirección", "Address"), w: 32, type: "text" },
          { h: tx("Día", "Day"), w: 12, type: "text" },
          { h: tx("Frecuencia", "Frequency"), w: 16, type: "text" },
          { h: tx("Precio", "Price"), w: 10, type: "money", money: true },
          { h: tx("Próximo corte", "Next cut"), w: 12, type: "date" },
          { h: tx("Último corte", "Last cut"), w: 12, type: "date" },
          { h: tx("Debe", "Owes"), w: 10, type: "money", total: "sum", money: true, color: LATE },
          { h: tx("A su favor", "Credit"), w: 10, type: "money", total: "sum", money: true },
          { h: tx("Cliente desde", "Client since"), w: 12, type: "date" },
          { h: tx("Notas", "Notes"), w: 40, type: "text" },
        ],
        m.clientRows.map((r) => [r.name, r.group, r.phone, r.address, r.day, r.every, r.price, r.next || null, r.last || null, r.balance > 0 ? r.balance : null, r.credit > 0 ? r.credit : null, r.since || null, r.notes.replace(/\n/g, " · ")]),
        a,
      );
      rowsCount[t.name] = m.clientRows.length;
    } else if (t.id === "precios") {
      const start = 4;
      sheet = tableSheet(
        t.name,
        tx("Precios", "Prices"),
        sub("precios"),
        [
          { h: tx("Cliente", "Client"), w: 26, type: "text", bold: true },
          { h: tx("Estado", "Status"), w: 11, type: "text" },
          { h: tx("Frecuencia", "Frequency"), w: 16, type: "text" },
          { h: tx("Precio", "Price"), w: 11, type: "money", money: true },
          { h: tx("Visitas al mes", "Visits a month"), w: 11, type: "num1" },
          { h: tx("Al mes", "A month"), w: 12, type: "money", total: "sum", money: true, color: MONEY },
        ],
        m.precios.rows.map((r, i) => [r.name, r.group, r.every, r.price, r.visits || null, r.visits ? { f: `D${start + i}*E${start + i}`, v: r.monthly } : null]),
        a,
      );
      rowsCount[t.name] = m.precios.rows.length;
    } else if (t.id === "horas") {
      const start = 4;
      const rows = m.horas.rows.filter((r) => r.hours > 0 || r.stopped);
      sheet = tableSheet(
        t.name,
        tx("Horas y $ por hora", "Hours and $ per hour"),
        sub("horas"),
        [
          { h: tx("Fecha", "Date"), w: 12, type: "date" },
          { h: tx("Entrada", "In"), w: 9, type: "text" },
          { h: tx("Salida", "Out"), w: 9, type: "text" },
          { h: tx("Horas", "Hours"), w: 9, type: "num1", total: "sum", bold: true },
          { h: tx("Trabajos", "Jobs"), w: 9, type: "int", total: "sum" },
          { h: tx("Valor del trabajo", "Work value"), w: 14, type: "money", total: "sum", money: true },
          { h: tx("$ por hora", "$ an hour"), w: 11, type: "money", money: true, color: MONEY },
          { h: tx("Cobrado ese día", "Collected that day"), w: 14, type: "money", total: "sum", money: true },
          { h: tx("Nota", "Note"), w: 28, type: "text" },
        ],
        rows.map((r, i) => {
          const row = start + i;
          return [r.date, r.clockIn, r.clockOut, r.hours, r.jobs, r.value, r.hours > 0 ? { f: `IF(D${row}>0,F${row}/D${row},"")`, v: Math.round((r.value / r.hours) * 100) / 100 } : null, r.collected, r.stopped];
        }),
        a,
      );
      rowsCount[t.name] = rows.length;
    } else if (t.id === "propinas") {
      sheet = tableSheet(
        t.name,
        tx("Propinas", "Tips"),
        sub("propinas"),
        [
          { h: tx("Fecha", "Date"), w: 12, type: "date" },
          { h: tx("Cliente", "Client"), w: 28, type: "text", bold: true },
          { h: tx("Propina", "Tip"), w: 12, type: "money", total: "sum", money: true, color: GREEN },
          { h: tx("Medio", "Method"), w: 14, type: "text" },
        ],
        m.propinas.rows.map((r) => [r.date, r.name, r.tip, r.method]),
        a,
      );
      rowsCount[t.name] = m.propinas.rows.length;
    } else if (t.id === "pospuestos") {
      sheet = tableSheet(
        t.name,
        tx("Pospuestos y motivos", "Postponed and why"),
        sub("pospuestos"),
        [
          { h: tx("Era el", "Was on"), w: 12, type: "date" },
          { h: tx("Pasó al", "Moved to"), w: 12, type: "date", bold: true },
          { h: tx("Días", "Days"), w: 7, type: "int" },
          { h: tx("Cliente", "Client"), w: 26, type: "text", bold: true },
          { h: tx("Trabajo", "Job"), w: 24, type: "text" },
          { h: tx("Motivo", "Reason"), w: 22, type: "text" },
        ],
        m.pospuestos.rows.map((r, i) => [r.from, r.to, { f: `B${4 + i}-A${4 + i}`, v: (serial(r.to) ?? 0) - (serial(r.from) ?? 0) }, r.name, r.job, r.reason]),
        a,
      );
      rowsCount[t.name] = m.pospuestos.rows.length;
    } else if (t.id === "libres") {
      sheet = tableSheet(t.name, tx("Días libres y paradas", "Days off and early stops"), tx("Días sin trabajo y días que paraste temprano, con su motivo.", "Days without work and days you stopped early, with the reason."), [
        { h: tx("Fecha", "Date"), w: 12, type: "date" },
        { h: tx("Motivo", "Reason"), w: 50, type: "text" },
      ], m.pospuestos.offDays.map((d) => [d.date, d.reason]), a);
      rowsCount[t.name] = m.pospuestos.offDays.length;
    } else if (t.id === "notas") {
      const rows: Val[][] = [
        ...m.notas.day.map((d) => [tx("Nota del día", "Day note"), d.date, "", "", null, d.text] as Val[]),
        ...m.notas.pages.map((p) => [p.pinned ? tx("Fichero · fijada", "Notebook · pinned") : tx("Fichero", "Notebook"), null, p.title, p.folder, p.due || null, p.text] as Val[]),
      ];
      sheet = tableSheet(t.name, tx("Notas", "Notes"), sub("notas"), [
        { h: tx("Tipo", "Type"), w: 16, type: "text" },
        { h: tx("Fecha", "Date"), w: 12, type: "date" },
        { h: tx("Título", "Title"), w: 24, type: "text", bold: true },
        { h: tx("Carpeta", "Folder"), w: 14, type: "text" },
        { h: tx("Para el", "Due"), w: 12, type: "date" },
        { h: tx("Texto", "Text"), w: 70, type: "text", wrap: true },
      ], rows, a);
      rowsCount[t.name] = rows.length;
    } else if (t.id === "asesor" && m.asesor) {
      const s = m.asesor;
      const rows: Val[][] = [
        [tx("Nota del negocio", "Business score"), `${s.score}/100 · ${s.word}`, `${s.title} ${s.sub}`, ""],
        ...s.moves.map((mv, i) => [tx(`Paso ${i + 1}`, `Move ${i + 1}`), mv.title, mv.line, mv.impact] as Val[]),
        ...s.checks.map((c) => [tx("Revisión", "Check"), `${c.label} · ${c.status === "pass" ? tx("Bien", "Good") : c.status === "warn" ? tx("Ojo", "Watch") : tx("Mal", "Weak")}`, c.line, ""] as Val[]),
      ];
      sheet = tableSheet(t.name, tx("Asesor", "Advisor"), tx("El negocio de hoy, en palabras simples (últimos 12 meses).", "The business today, in plain words (last 12 months)."), [
        { h: tx("Qué", "What"), w: 18, type: "text", bold: true },
        { h: tx("Título", "Title"), w: 36, type: "text", bold: true, wrap: true },
        { h: tx("En palabras", "In plain words"), w: 70, type: "text", wrap: true },
        { h: tx("Impacto", "Impact"), w: 20, type: "text", color: MONEY },
      ], rows, true);
      rowsCount[t.name] = rows.length;
    }
    if (sheet) sheets.push(sheet);
  }
  sheets.unshift(summarySheet(m, tabs.map((t) => t.name), rowsCount));
  return packWorkbook(sheets, tx("d mmm yyyy", "mmm d, yyyy"));
}

function summarySheet(m: Model, tabs: string[], counts: Record<string, number>): Sheet {
  const tx = m.tx;
  const k = m.kpi;
  const rows: (XCell | null)[][] = [];
  const heights: Record<number, number> = { 1: 30, 2: 18, 3: 16 };
  rows.push([{ v: m.business, s: { bold: true, size: 20, color: GREEN } }]);
  rows.push([{ v: `${m.title} · ${m.periodLabel}`, s: { bold: true, size: 11, color: INK } }]);
  rows.push([{ v: `${m.generated} · ${m.scope}`, s: { italic: true, size: 9, color: MUTED } }]);
  rows.push([]);
  const sectionTitle = (text: string) => {
    rows.push([{ v: text, s: { bold: true, size: 12, color: GREEN } }]);
    heights[rows.length] = 22;
  };
  sectionTitle(tx("Las cifras", "The figures"));
  const head = (a: string, b: string) => rows.push([{ v: a, s: { bold: true, color: "FFFFFF", fill: GREEN, border: true } }, { v: b, s: { bold: true, color: "FFFFFF", fill: GREEN, border: true, align: "right" } }]);
  head(tx("Cifra", "Figure"), tx("Valor", "Value"));
  const fig = (label: string, v: number, fmt: Style["fmt"], color = INK, i = 0) =>
    rows.push([{ v: label, s: { border: true, fill: i % 2 ? FAINT : undefined } }, { v, s: { border: true, bold: true, size: 12, fmt, color, fill: i % 2 ? FAINT : undefined } }]);
  const figs: [string, number, Style["fmt"], string?][] = [];
  if (m.amounts) {
    figs.push([tx("Cobrado", "Collected"), k.collected, "money", MONEY]);
    figs.push([tx("Te deben (hoy)", "Owed to you (today)"), k.owed, "money", LATE]);
    figs.push([tx("Clientes que deben", "Clients who owe"), k.owedPeople, "int"]);
  }
  figs.push([tx("Trabajos hechos", "Jobs done"), k.jobsDone, "int", GREEN]);
  if (m.amounts) figs.push([tx("Valor del trabajo hecho", "Value of work done"), k.doneValue, "money"]);
  figs.push([tx("Cortes", "Cuts"), k.cuts, "int"]);
  figs.push([tx("Extras", "Extras"), k.extras, "int"]);
  figs.push([tx("Trabajos de una vez", "One-time jobs"), k.once, "int"]);
  figs.push([tx("Clientes activos", "Active clients"), k.activeClients, "int"]);
  figs.push([tx("Clientes de una vez", "One-time clients"), k.oneTimeClients, "int"]);
  if (m.amounts) {
    figs.push([tx("Propinas", "Tips"), k.tips, "money"]);
    figs.push([tx("Perdonado", "Forgiven"), k.forgiven, "money"]);
    figs.push([tx("A favor de clientes (adelantos)", "Client credit (paid ahead)"), k.credit, "money"]);
  }
  figs.push([tx("Horas trabajadas", "Hours worked"), Math.round((k.minutes / 60) * 10) / 10, "num1"]);
  if (m.amounts && m.horas.perHour) figs.push([tx("$ por hora (trabajo hecho)", "$ an hour (work done)"), m.horas.perHour, "money", MONEY]);
  figs.forEach(([label, v, fmt, color], i) => fig(label, v, fmt, color, i));
  rows.push([]);
  sectionTitle(tx("En pocas palabras", "In a few words"));
  for (const id of m.sections) {
    const text = m.takeaway[id];
    if (!text) continue;
    rows.push([{ v: m.sectionTitle(id), s: { bold: true, color: INK, border: true } }, { v: text, s: { wrap: true, border: true } }]);
    heights[rows.length] = text.length > 110 ? 44 : 30;
  }
  rows.push([]);
  sectionTitle(tx("Qué hay en cada pestaña", "What each tab holds"));
  rows.push([
    { v: tx("Pestaña", "Tab"), s: { bold: true, color: "FFFFFF", fill: GREEN, border: true } },
    { v: tx("Qué tiene", "What it holds"), s: { bold: true, color: "FFFFFF", fill: GREEN, border: true } },
    { v: tx("Filas", "Rows"), s: { bold: true, color: "FFFFFF", fill: GREEN, border: true, align: "right" } },
  ]);
  const guide: Record<string, string> = {
    [tx("Resumen", "Summary")]: tx("Esta hoja: las cifras, una frase por sección y esta guía.", "This sheet: the figures, one sentence per section and this guide."),
    [tx("Por mes", "By month")]: tx("Trabajo, cobrado, propinas y perdonado de cada mes. Ideal para el contador.", "Work, collected, tips and forgiven each month. Handy for the accountant."),
    [tx("Te deben", "Owed")]: tx("Quién debe, cuánto y desde cuándo (por edad de la deuda).", "Who owes, how much and since when (by age of the debt)."),
    [tx("Pagos", "Payments")]: tx("Cada pago con fecha, medio y propina.", "Every payment with date, method and tip."),
    [tx("Trabajos", "Jobs")]: tx("Cada trabajo hecho con su monto.", "Every job done with its amount."),
    [tx("Agenda", "Route")]: tx("Los próximos patios, con casilla para marcar.", "The next yards, with a box to tick."),
    [tx("Clientes", "Clients")]: tx("El directorio: contacto, día, frecuencia, precio y saldo.", "The directory: contact, day, frequency, price and balance."),
    [tx("Precios", "Prices")]: tx("Lo que paga cada patio y cuánto deja al mes.", "What each yard pays and what it brings a month."),
    [tx("Horas", "Hours")]: tx("Entrada, salida, horas y $ por hora de cada día.", "Clock in, out, hours and $ an hour each day."),
    [tx("Propinas", "Tips")]: tx("Cada propina y quién la dejó.", "Every tip and who left it."),
    [tx("Pospuestos", "Postponed")]: tx("Trabajos movidos: de qué día a qué día y por qué.", "Moved jobs: from which day to which, and why."),
    [tx("Días libres", "Days off")]: tx("Días sin trabajo y paradas tempranas.", "Days without work and early stops."),
    [tx("Notas", "Notes")]: tx("Notas del día y del fichero.", "Day notes and notebook notes."),
    [tx("Asesor", "Advisor")]: tx("La nota del negocio, los mejores pasos y las revisiones.", "The business score, the best moves and the checks."),
  };
  tabs.forEach((name, i) => {
    rows.push([
      { v: name, s: { bold: true, border: true, fill: i % 2 ? FAINT : undefined } },
      { v: guide[name] ?? "", s: { border: true, wrap: true, fill: i % 2 ? FAINT : undefined } },
      { v: i === 0 ? null : (counts[name] ?? 0), s: { border: true, fmt: "int", fill: i % 2 ? FAINT : undefined } },
    ]);
  });
  rows.push([]);
  rows.push([{ v: tx("Consejo: cada pestaña tiene filtros en la fila de títulos y una fila de totales que suma solo lo que dejes visible.", "Tip: every tab has filters on the title row and a totals row that adds up only what you leave visible."), s: { italic: true, size: 9, color: MUTED } }]);
  return { name: tx("Resumen", "Summary"), rows, widths: [34, 70, 10], merges: ["A1:C1", "A2:C2", "A3:C3"], heights, tab: GREEN };
}

function packWorkbook(sheets: Sheet[], dateFmt: string): Uint8Array {
  const styles = new Styles(dateFmt);
  const encoder = new TextEncoder();
  const used = new Set<string>();
  for (const s of sheets) {
    let name = s.name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Hoja";
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${name.slice(0, 28)} ${n++}`;
    used.add(name.toLowerCase());
    s.name = name;
  }
  const sheetFiles = sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: encoder.encode(sheetXml(sheet, styles)) }));
  const overrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${overrides}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Brizna</dc:title><dc:creator>Brizna</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`;
  const filters = sheets
    .map((sheet, index) => {
      if (!sheet.filter) return "";
      const [from, to] = sheet.filter.split(":");
      const abs = (ref: string) => ref.replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2");
      return `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">'${xml(sheet.name.replace(/'/g, "''"))}'!${abs(from ?? "A1")}:${abs(to ?? "A1")}</definedName>`;
    })
    .join("");
  const printTitles = sheets
    .map((sheet, index) => (sheet.freeze ? `<definedName name="_xlnm.Print_Titles" localSheetId="${index}">'${xml(sheet.name.replace(/'/g, "''"))}'!$${sheet.freeze}:$${sheet.freeze}</definedName>` : ""))
    .join("");
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView activeTab="0"/></bookViews>
<sheets>${sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>
${filters || printTitles ? `<definedNames>${filters}${printTitles}</definedNames>` : ""}
<calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  return storeZip([
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rels) },
    { name: "docProps/core.xml", data: encoder.encode(core) },
    { name: "xl/workbook.xml", data: encoder.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) },
    { name: "xl/styles.xml", data: encoder.encode(styles.xml()) },
    ...sheetFiles,
  ]);
}

/* ------------------------------------------------------------------ zip (stored) */

let CRC_TABLE: Uint32Array | null = null;
function crc32(data: Uint8Array) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function storeZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const head = new Uint8Array(30 + name.length);
    const view = new DataView(head.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0x5821, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    head.set(name, 30);
    local.push(head, file.data);
    const dir = new Uint8Array(46 + name.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(14, 0x5821, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, file.data.length, true);
    dv.setUint32(24, file.data.length, true);
    dv.setUint16(28, name.length, true);
    dv.setUint32(42, offset, true);
    dir.set(name, 46);
    central.push(dir);
    offset += head.length + file.data.length;
  }
  const centralLength = central.reduce((s, p) => s + p.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralLength, true);
  ev.setUint32(16, offset, true);
  const parts = [...local, ...central, end];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

