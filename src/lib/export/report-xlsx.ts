import type { Model } from "./model";
import type { SectionId } from "./options";

/**
 * The worksheet (1.5.10): a real .xlsx with a finished report's look, hand-built OOXML in a
 * stored zip (no library: works offline and inside the Android app). Every tab wears the
 * Brizna title band (the sprout mark, the name, the tab's title, the period and when it was
 * made) over a thin sky-and-lawn rule, one plain line on what the tab holds and a link back
 * to the Summary. Data tabs are real Excel Tables with Brizna's own table style: filters,
 * banded rows, a Total row that follows the filter (SUBTOTAL) and a frozen header. Dates are
 * dates, money is currency, derived figures are live formulas, and quiet conditional formats
 * point at what matters (data bars, colour scales, status dots, late and overdue in red).
 * The Summary is a dashboard: big figures, the one sentence, native charts and a linked index.
 * Print: landscape tabs one page wide, header row repeated, "Brizna · Tab · Página n de N".
 */

/* ------------------------------------------------------------------ palette (the PDF's) */

const INK = "1A261C";
const MUTED = "56625A";
const SUBTLE = "8A948C";
const RULE = "DCE2D8";
const HAIR = "E8EDE4";
const CREAM = "F4F7F0";
const BAND = "F7F9F4";
const NIGHT = "173F2A";
const NIGHT_INK = "A9C4B2";
const BONE = "F3EFE4";
const SKY = "9FD3E6";
const LAWN = "8DBE76";
const ACCENT = "1F6A3A";
const ACCENT_SOFT = "E3F0E5";
const GREEN = "3E8E55";
const GREEN_BAR = "C9E2C4";
const MONEY = "0F5C6B";
const MONEY_BAR = "C6E2E7";
const LATE = "B42318";
const LATE_SOFT = "FBE4DF";
const LATE_BAR = "F2C6BE";
const PENDING = "8A5A12";
const SOIL = "6B4E31";
const SKY_TAB = "4A8FB0";
const A0 = "4C9A5F";
const A31 = "D8A21E";
const A61 = "D9731B";
const A91 = "B42318";
const AOPEN = "A08E74";
const WHITE = "FFFFFF";
const FONT = "Calibri";

/** The sprout mark (cream sprout on a sky-to-lawn tile) as a small PNG for the title band. */
const MARK_PNG = "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";

/* ------------------------------------------------------------------ cell model */

type Fmt = "date" | "money" | "int" | "num1" | "pct" | "days" | "rows" | "dot" | "month" | "hours";
const FMT_ID: Record<Fmt, number> = { money: 164, date: 165, num1: 166, pct: 167, int: 168, days: 169, rows: 170, dot: 171, month: 172, hours: 173 };

function fmtCodes(tx: Model["tx"]): Record<Fmt, string> {
  return {
    money: `"$"#,##0.00;-"$"#,##0.00;"–"`,
    date: tx("d mmm yyyy", "mmm d, yyyy"),
    num1: "0.0",
    pct: "0%",
    int: "#,##0",
    days: tx(`[=1]0" día";#,##0" días"`, `[=1]0" day";#,##0" days"`),
    rows: tx(`[=1]0" fila";#,##0" filas"`, `[=1]0" row";#,##0" rows"`),
    dot: `"●  "@`,
    month: tx("mmm yyyy", "mmm yyyy"),
    hours: tx(`0.0" h"`, `0.0" h"`),
  };
}

type Side = { style: "thin" | "medium" | "thick" | "hair"; color: string };
interface Style {
  fill?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  size?: number;
  align?: "left" | "center" | "right";
  valign?: "top" | "center" | "bottom";
  indent?: number;
  wrap?: boolean;
  fmt?: Fmt;
  top?: Side;
  bottom?: Side;
  left?: Side;
  right?: Side;
}
interface XCell {
  v?: string | number | null;
  f?: string;
  s?: Style;
}

interface Dxf {
  color?: string;
  bold?: boolean;
  fill?: string;
  top?: Side;
}

type CF =
  | { kind: "expr"; sqref: string; formula: string; dxf: Dxf }
  | { kind: "less0"; sqref: string; dxf: Dxf }
  | { kind: "greater0"; sqref: string; dxf: Dxf }
  | { kind: "equal"; sqref: string; text: string; dxf: Dxf }
  | { kind: "scale"; sqref: string; colors: [string, string, string] }
  | { kind: "bar"; sqref: string; color: string };

interface ChartSeries {
  name: string;
  ref: string;
  values: (number | null)[];
  color: string;
  kind: "bar" | "line";
  points?: string[];
}
interface Chart {
  from: [number, number, number?, number?];
  to: [number, number, number?, number?];
  dir: "col" | "bar";
  catRef: string;
  cats: string[];
  catNums?: number[];
  catFmt?: string;
  series: ChartSeries[];
  legend: boolean;
  labels?: boolean;
  hideValueAxis?: boolean;
  axisFmt: string;
  labelFmt?: string;
  gap?: number;
  reverse?: boolean;
}

interface Table {
  name: string;
  header: number;
  first: number;
  last: number;
  totals: boolean;
  cols: { name: string; total?: string; label?: string }[];
  col0: number;
}

class Grid {
  rows = new Map<number, Map<number, XCell>>();
  heights = new Map<number, number>();
  merges: string[] = [];
  set(r: number, c: number, cell: XCell) {
    let row = this.rows.get(r);
    if (!row) this.rows.set(r, (row = new Map()));
    row.set(c, cell);
  }
  /** Merge r1..r2 × c1..c2: the value sits top-left, every cell wears the style. */
  merge(r1: number, c1: number, r2: number, c2: number, cell: XCell) {
    for (let r = r1; r <= r2; r += 1) for (let c = c1; c <= c2; c += 1) this.set(r, c, r === r1 && c === c1 ? cell : { s: cell.s });
    if (r1 !== r2 || c1 !== c2) this.merges.push(`${colName(c1)}${r1}:${colName(c2)}${r2}`);
  }
  fill(r: number, c1: number, c2: number, s: Style) {
    for (let c = c1; c <= c2; c += 1) if (!this.rows.get(r)?.get(c)) this.set(r, c, { s });
  }
  height(r: number, h: number) {
    this.heights.set(r, h);
  }
}

interface Sheet {
  name: string;
  grid: Grid;
  widths: number[];
  tab: string;
  freeze?: { row: number; col: number };
  tables: Table[];
  cfs: CF[];
  links: { ref: string; target: string; tip: string }[];
  charts: Chart[];
  printTitle?: number;
  landscape: boolean;
  breaks?: number[];
}

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
function serial(iso: string | null | undefined): number | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  return Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - Date.UTC(1899, 11, 30)) / 86400000);
}

const quoted = (name: string) => `'${name.replace(/'/g, "''")}'`;
const absRange = (sheet: string, c: number, r1: number, r2: number) => `${quoted(sheet)}!$${colName(c)}$${r1}:$${colName(c)}$${r2}`;

/* ------------------------------------------------------------------ styles */

class Styles {
  fonts = [`<font><sz val="10"/><color rgb="FF${INK}"/><name val="${FONT}"/><family val="2"/><scheme val="none"/></font>`];
  fills = [`<fill><patternFill patternType="none"/></fill>`, `<fill><patternFill patternType="gray125"/></fill>`];
  borders = [`<border><left/><right/><top/><bottom/><diagonal/></border>`];
  xfs = [`<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`];
  dxfs: string[] = [];
  private seen = new Map<string, number>();
  private seenDxf = new Map<string, number>();
  constructor(private codes: Record<Fmt, string>) {}

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
      `<font>${style.bold ? "<b/>" : ""}${style.italic ? "<i/>" : ""}${style.underline ? "<u/>" : ""}<sz val="${style.size ?? 10}"/><color rgb="FF${style.color ?? INK}"/><name val="${FONT}"/><family val="2"/><scheme val="none"/></font>`,
    );
    const fill = style.fill ? this.index(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${style.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const side = (name: string, s?: Side) => (s ? `<${name} style="${s.style}"><color rgb="FF${s.color}"/></${name}>` : `<${name}/>`);
    const hasBorder = style.top || style.bottom || style.left || style.right;
    const border = hasBorder ? this.index(this.borders, `<border>${side("left", style.left)}${side("right", style.right)}${side("top", style.top)}${side("bottom", style.bottom)}<diagonal/></border>`) : 0;
    const numFmt = style.fmt ? FMT_ID[style.fmt] : 0;
    const align = `<alignment${style.align ? ` horizontal="${style.align}"` : ""} vertical="${style.valign ?? "center"}"${style.wrap ? ` wrapText="1"` : ""}${style.indent ? ` indent="${style.indent}"` : ""}/>`;
    this.xfs.push(`<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${numFmt ? ` applyNumberFormat="1"` : ""}>${align}</xf>`);
    const id = this.xfs.length - 1;
    this.seen.set(key, id);
    return id;
  }

  dxf(d: Dxf): number {
    const key = JSON.stringify(d);
    const known = this.seenDxf.get(key);
    if (known != null) return known;
    const font = d.color || d.bold ? `<font>${d.bold ? "<b/>" : ""}${d.color ? `<color rgb="FF${d.color}"/>` : ""}</font>` : "";
    const fill = d.fill ? `<fill><patternFill patternType="solid"><fgColor rgb="FF${d.fill}"/><bgColor rgb="FF${d.fill}"/></patternFill></fill>` : "";
    const border = d.top ? `<border><top style="${d.top.style}"><color rgb="FF${d.top.color}"/></top></border>` : "";
    this.dxfs.push(`<dxf>${font}${fill}${border}</dxf>`);
    const id = this.dxfs.length - 1;
    this.seenDxf.set(key, id);
    return id;
  }

  xml(): string {
    // Brizna's table style: what Excel paints on rows added later inside a table.
    const whole = this.dxf({ color: INK });
    const head = this.dxf({ color: ACCENT, bold: true, fill: ACCENT_SOFT });
    const stripe = this.dxf({ fill: BAND });
    const total = this.dxf({ bold: true, top: { style: "thin", color: ACCENT } });
    const numFmts = (Object.keys(FMT_ID) as Fmt[]).map((k) => `<numFmt numFmtId="${FMT_ID[k]}" formatCode="${xml(this.codes[k])}"/>`);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="${numFmts.length}">${numFmts.join("")}</numFmts>
<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts>
<fills count="${this.fills.length}">${this.fills.join("")}</fills>
<borders count="${this.borders.length}">${this.borders.join("")}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="${this.dxfs.length}">${this.dxfs.join("")}</dxfs>
<tableStyles count="1" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"><tableStyle name="Brizna" pivot="0" count="4"><tableStyleElement type="wholeTable" dxfId="${whole}"/><tableStyleElement type="headerRow" dxfId="${head}"/><tableStyleElement type="totalRow" dxfId="${total}"/><tableStyleElement type="secondRowStripe" dxfId="${stripe}"/></tableStyle></tableStyles>
</styleSheet>`;
  }
}

class Strings {
  list: string[] = [];
  private map = new Map<string, number>();
  count = 0;
  id(text: string) {
    this.count += 1;
    const known = this.map.get(text);
    if (known != null) return known;
    this.list.push(text);
    this.map.set(text, this.list.length - 1);
    return this.list.length - 1;
  }
  xml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.count}" uniqueCount="${this.list.length}">${this.list.map((t) => `<si><t xml:space="preserve">${xml(t)}</t></si>`).join("")}</sst>`;
  }
}

/* ------------------------------------------------------------------ worksheet xml */

const X14 = "http://schemas.microsoft.com/office/spreadsheetml/2009/9/main";

function guid(n: number, salt: number) {
  const h = (x: number, len: number) => (x >>> 0).toString(16).toUpperCase().padStart(len, "0").slice(-len);
  return `{6B2D1E4A-${h(salt, 4)}-4B7A-8C2E-${h(n, 12)}}`;
}

function sheetXml(sheet: Sheet, index: number, styles: Styles, strings: Strings, footerWord: string, rels: { drawing?: string; tables: string[] }): string {
  const rowIds = [...new Set([...sheet.grid.rows.keys(), ...sheet.grid.heights.keys()])].sort((a, b) => a - b);
  const body = rowIds
    .map((r) => {
      const row = sheet.grid.rows.get(r);
      const cells = row
        ? [...row.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([c, cell]) => {
              const ref = `${colName(c)}${r}`;
              const s = styles.id(cell.s);
              const sa = s ? ` s="${s}"` : "";
              if (cell.f) {
                const cached = typeof cell.v === "number" && Number.isFinite(cell.v) ? `<v>${cell.v}</v>` : "";
                const str = typeof cell.v === "string" ? ` t="str"` : "";
                return `<c r="${ref}"${sa}${str}><f>${xml(cell.f)}</f>${str ? `<v>${xml(cell.v)}</v>` : cached}</c>`;
              }
              if (typeof cell.v === "number" && Number.isFinite(cell.v)) return `<c r="${ref}"${sa}><v>${cell.v}</v></c>`;
              if (cell.v == null || cell.v === "") return `<c r="${ref}"${sa}/>`;
              return `<c r="${ref}"${sa} t="s"><v>${strings.id(String(cell.v))}</v></c>`;
            })
            .join("")
        : "";
      const height = sheet.grid.heights.get(r);
      return `<row r="${r}"${height ? ` ht="${height}" customHeight="1"` : ""}>${cells}</row>`;
    })
    .join("");
  const lastCol = sheet.widths.length - 1;
  const lastRow = rowIds.length ? rowIds[rowIds.length - 1]! : 1;
  const fz = sheet.freeze;
  let pane = "";
  if (fz && (fz.row > 0 || fz.col > 0)) {
    const tl = `${colName(fz.col)}${fz.row + 1}`;
    const active = fz.row && fz.col ? "bottomRight" : fz.row ? "bottomLeft" : "topRight";
    pane = `<pane${fz.col ? ` xSplit="${fz.col}"` : ""}${fz.row ? ` ySplit="${fz.row}"` : ""} topLeftCell="${tl}" activePane="${active}" state="frozen"/><selection pane="${active}" activeCell="${tl}" sqref="${tl}"/>`;
  }
  const cols = sheet.widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join("");
  const merges = sheet.grid.merges.length ? `<mergeCells count="${sheet.grid.merges.length}">${sheet.grid.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>` : "";
  let priority = 1;
  const x14: string[] = [];
  const cf = sheet.cfs
    .map((rule, n) => {
      const p = priority++;
      if (rule.kind === "scale") {
        const [lo, mid, hi] = rule.colors;
        return `<conditionalFormatting sqref="${rule.sqref}"><cfRule type="colorScale" priority="${p}"><colorScale><cfvo type="min"/><cfvo type="percentile" val="50"/><cfvo type="max"/><color rgb="FF${lo}"/><color rgb="FF${mid}"/><color rgb="FF${hi}"/></colorScale></cfRule></conditionalFormatting>`;
      }
      if (rule.kind === "bar") {
        const id = guid(n + 1, index + 1);
        x14.push(`<x14:conditionalFormatting xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><x14:cfRule type="dataBar" id="${id}"><x14:dataBar minLength="0" maxLength="100" gradient="0" negativeBarColorSameAsPositive="0" axisPosition="automatic"><x14:cfvo type="autoMin"/><x14:cfvo type="autoMax"/><x14:negativeFillColor rgb="FF${LATE_SOFT}"/><x14:axisColor rgb="FF${SUBTLE}"/></x14:dataBar></x14:cfRule><xm:sqref>${rule.sqref}</xm:sqref></x14:conditionalFormatting>`);
        return `<conditionalFormatting sqref="${rule.sqref}"><cfRule type="dataBar" priority="${p}"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FF${rule.color}"/></dataBar><extLst><ext uri="{B025F937-C7B1-47D3-B67F-A62EFF666E3E}" xmlns:x14="${X14}"><x14:id>${id}</x14:id></ext></extLst></cfRule></conditionalFormatting>`;
      }
      const dxf = styles.dxf(rule.dxf);
      if (rule.kind === "less0") return `<conditionalFormatting sqref="${rule.sqref}"><cfRule type="cellIs" dxfId="${dxf}" priority="${p}" operator="lessThan"><formula>0</formula></cfRule></conditionalFormatting>`;
      if (rule.kind === "greater0") return `<conditionalFormatting sqref="${rule.sqref}"><cfRule type="cellIs" dxfId="${dxf}" priority="${p}" operator="greaterThan"><formula>0</formula></cfRule></conditionalFormatting>`;
      if (rule.kind === "equal") return `<conditionalFormatting sqref="${rule.sqref}"><cfRule type="cellIs" dxfId="${dxf}" priority="${p}" operator="equal"><formula>${xml(`"${rule.text.replace(/"/g, '""')}"`)}</formula></cfRule></conditionalFormatting>`;
      return `<conditionalFormatting sqref="${rule.sqref}"><cfRule type="expression" dxfId="${dxf}" priority="${p}"><formula>${xml(rule.formula)}</formula></cfRule></conditionalFormatting>`;
    })
    .join("");
  const links = sheet.links.length
    ? `<hyperlinks>${sheet.links.map((l) => `<hyperlink ref="${l.ref}" location="${xml(`${quoted(l.target)}!A1`)}" tooltip="${xml(l.tip)}" display="${xml(l.tip)}"/>`).join("")}</hyperlinks>`
    : "";
  const foot = (text: string) => text.replace(/&/g, "&&");
  const footer = `&C&"${FONT},Regular"&8&K${SUBTLE}Brizna · ${foot(sheet.name)} · ${footerWord}`;
  const ext = x14.length ? `<extLst><ext uri="{78C0D931-6437-407d-A8EE-F0AAD7539E65}" xmlns:x14="${X14}"><x14:conditionalFormattings>${x14.join("")}</x14:conditionalFormattings></ext></extLst>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><tabColor rgb="FF${sheet.tab}"/><pageSetUpPr fitToPage="1"/></sheetPr>
<dimension ref="A1:${colName(lastCol)}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="100"${index === 0 ? ` tabSelected="1"` : ""}>${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18" customHeight="1"/>
<cols>${cols}</cols>
<sheetData>${body}</sheetData>
${merges}${cf}${links}
<printOptions horizontalCentered="1"/>
<pageMargins left="0.4" right="0.4" top="0.55" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="1" orientation="${sheet.landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddFooter>${xml(footer)}</oddFooter></headerFooter>
${sheet.breaks?.length ? `<rowBreaks count="${sheet.breaks.length}" manualBreakCount="${sheet.breaks.length}">${sheet.breaks.map((b) => `<brk id="${b}" max="16383" man="1"/>`).join("")}</rowBreaks>` : ""}
${rels.drawing ? `<drawing r:id="${rels.drawing}"/>` : ""}${rels.tables.length ? `<tableParts count="${rels.tables.length}">${rels.tables.map((id) => `<tablePart r:id="${id}"/>`).join("")}</tableParts>` : ""}${ext}
</worksheet>`;
}

function tableXml(t: Table, id: number): string {
  const lastCol = t.col0 + t.cols.length - 1;
  const lastRow = t.totals ? t.last + 1 : t.last;
  const ref = `${colName(t.col0)}${t.header}:${colName(lastCol)}${lastRow}`;
  const cols = t.cols
    .map((c, i) => {
      if (c.label) return `<tableColumn id="${i + 1}" name="${xml(c.name)}" totalsRowLabel="${xml(c.label)}"/>`;
      if (c.total) return `<tableColumn id="${i + 1}" name="${xml(c.name)}" totalsRowFunction="custom"><totalsRowFormula>${xml(c.total)}</totalsRowFormula></tableColumn>`;
      return `<tableColumn id="${i + 1}" name="${xml(c.name)}"/>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${id}" name="${t.name}" displayName="${t.name}" ref="${ref}"${t.totals ? ` totalsRowCount="1"` : ` totalsRowShown="0"`}><autoFilter ref="${colName(t.col0)}${t.header}:${colName(lastCol)}${t.last}"/><tableColumns count="${t.cols.length}">${cols}</tableColumns><tableStyleInfo name="Brizna" showFirstColumn="0" showLastColumn="0" showRowStripes="0" showColumnStripes="0"/></table>`;
}

/* ------------------------------------------------------------------ drawings and charts */

const EMU = 9525;
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const C_NS = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function drawingXml(sheet: Sheet, chartRids: string[], logoRid: string): string {
  const anchors: string[] = [];
  let id = 2;
  // The sprout mark, in the gutter of the band, beside the wordmark.
  anchors.push(`<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>${9 * EMU}</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>${11 * EMU}</xdr:rowOff></xdr:from><xdr:ext cx="${25 * EMU}" cy="${25 * EMU}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id++}" name="Brizna" descr="Brizna"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${logoRid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${25 * EMU}" cy="${25 * EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`);
  sheet.charts.forEach((chart, i) => {
    const [c1, r1, co1 = 0, ro1 = 0] = chart.from;
    const [c2, r2, co2 = 0, ro2 = 0] = chart.to;
    anchors.push(`<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${c1}</xdr:col><xdr:colOff>${co1 * EMU}</xdr:colOff><xdr:row>${r1}</xdr:row><xdr:rowOff>${ro1 * EMU}</xdr:rowOff></xdr:from><xdr:to><xdr:col>${c2}</xdr:col><xdr:colOff>${co2 * EMU}</xdr:colOff><xdr:row>${r2}</xdr:row><xdr:rowOff>${ro2 * EMU}</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id++}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${C_NS}"><c:chart xmlns:c="${C_NS}" r:id="${chartRids[i]}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`);
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${A_NS}" xmlns:r="${R_NS}">${anchors.join("")}</xdr:wsDr>`;
}

const solid = (hex: string) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
const txPr = (size: number, color: string, bold = false) =>
  `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size * 100}" b="${bold ? 1 : 0}">${solid(color)}<a:latin typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:defRPr></a:pPr><a:endParaRPr lang="es-US"/></a:p></c:txPr>`;

function chartXml(chart: Chart, lang: string): string {
  const n = chart.cats.length;
  const strCache = (values: string[]) => `<c:strCache><c:ptCount val="${values.length}"/>${values.map((v, i) => `<c:pt idx="${i}"><c:v>${xml(v)}</c:v></c:pt>`).join("")}</c:strCache>`;
  const numCache = (values: (number | null)[], fmt: string) =>
    `<c:numCache><c:formatCode>${xml(fmt)}</c:formatCode><c:ptCount val="${values.length}"/>${values.map((v, i) => (v == null || !Number.isFinite(v) ? "" : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)).join("")}</c:numCache>`;
  const cat = chart.catNums
    ? `<c:cat><c:numRef><c:f>${xml(chart.catRef)}</c:f>${numCache(chart.catNums, chart.catFmt ?? "General")}</c:numRef></c:cat>`
    : `<c:cat><c:strRef><c:f>${xml(chart.catRef)}</c:f>${strCache(chart.cats)}</c:strRef></c:cat>`;
  const labels = (color: string) =>
    chart.labels
      ? `<c:dLbls><c:numFmt formatCode="${xml(chart.labelFmt ?? chart.axisFmt)}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr(9, color, true)}<c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`
      : "";
  const bars = chart.series.filter((s) => s.kind === "bar");
  const lines = chart.series.filter((s) => s.kind === "line");
  let idx = 0;
  const serHead = (s: ChartSeries) => {
    const i = idx++;
    return `<c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${xml(s.name)}</c:v></c:tx>`;
  };
  const barSer = bars
    .map((s) => {
      const points = (s.points ?? []).map((color, i) => `<c:dPt><c:idx val="${i}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr>${solid(color)}<a:ln><a:noFill/></a:ln></c:spPr></c:dPt>`).join("");
      return `<c:ser>${serHead(s)}<c:spPr>${solid(s.color)}<a:ln><a:noFill/></a:ln></c:spPr><c:invertIfNegative val="0"/>${points}${labels(INK)}${cat}<c:val><c:numRef><c:f>${xml(s.ref)}</c:f>${numCache(s.values, chart.axisFmt)}</c:numRef></c:val></c:ser>`;
    })
    .join("");
  const lineSer = lines
    .map(
      (s) =>
        `<c:ser>${serHead(s)}<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr>${solid(WHITE)}<a:ln w="19050"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill></a:ln></c:spPr></c:marker>${cat}<c:val><c:numRef><c:f>${xml(s.ref)}</c:f>${numCache(s.values, chart.axisFmt)}</c:numRef></c:val><c:smooth val="0"/></c:ser>`,
    )
    .join("");
  const ax = `<c:axId val="50010"/><c:axId val="50020"/>`;
  const barChart = bars.length ? `<c:barChart><c:barDir val="${chart.dir}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${barSer}<c:gapWidth val="${chart.gap ?? 70}"/>${ax}</c:barChart>` : "";
  const lineChart = lines.length ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${lineSer}<c:marker val="1"/>${ax}</c:lineChart>` : "";
  const noLine = `<a:ln><a:noFill/></a:ln>`;
  const catPos = chart.dir === "bar" ? "l" : "b";
  const valPos = chart.dir === "bar" ? "b" : "l";
  const catAx = `<c:catAx><c:axId val="50010"/><c:scaling><c:orientation val="${chart.reverse ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${catPos}"/><c:numFmt formatCode="${xml(chart.catFmt ?? "General")}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="${RULE}"/></a:solidFill></a:ln></c:spPr>${txPr(9, MUTED)}<c:crossAx val="50020"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>${n > 14 && chart.dir === "col" ? `<c:tickLblSkip val="2"/>` : ""}<c:noMultiLvlLbl val="0"/></c:catAx>`;
  const valAx = `<c:valAx><c:axId val="50020"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${chart.hideValueAxis ? 1 : 0}"/><c:axPos val="${valPos}"/>${chart.hideValueAxis ? "" : `<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="${HAIR}"/></a:solidFill><a:prstDash val="dash"/></a:ln></c:spPr></c:majorGridlines>`}<c:numFmt formatCode="${xml(chart.axisFmt)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr>${noLine}</c:spPr>${txPr(8, SUBTLE)}<c:crossAx val="50010"/><c:crosses val="${chart.reverse ? "max" : "autoZero"}"/><c:crossBetween val="between"/></c:valAx>`;
  const legend = chart.legend ? `<c:legend><c:legendPos val="t"/><c:overlay val="0"/>${txPr(9, MUTED)}</c:legend>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="${C_NS}" xmlns:a="${A_NS}" xmlns:r="${R_NS}"><c:date1904 val="0"/><c:lang val="${lang}"/><c:roundedCorners val="0"/><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/>${barChart}${lineChart}${catAx}${valAx}<c:spPr><a:noFill/>${noLine}</c:spPr></c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr>${solid(WHITE)}${noLine}</c:spPr>${txPr(9, MUTED)}<c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

/* ------------------------------------------------------------------ the title band */

const HEAD = 7; // header row of every table tab
const GUTTER = 5.2;

function band(sheet: Sheet, m: Model, title: string, summary = false) {
  const g = sheet.grid;
  const last = sheet.widths.length - 1;
  const night: Style = { fill: NIGHT };
  g.height(1, 30);
  g.height(2, 22);
  g.height(3, 2);
  g.height(4, 3);
  g.fill(1, 0, last, night);
  g.fill(2, 0, last, night);
  // The rule: a line of sky over a line of lawn.
  g.fill(3, 0, last, { fill: SKY });
  g.fill(4, 0, last, { fill: LAWN });
  g.set(1, 1, { v: "Brizna", s: { fill: NIGHT, color: BONE, bold: true, size: 17, valign: "bottom" } });
  const right = last - 1;
  if (summary) {
    g.set(1, right, { v: m.title.toUpperCase(), s: { fill: NIGHT, color: SKY, bold: true, size: 8.5, align: "right", valign: "bottom" } });
    g.set(2, 1, { v: `${m.business} · ${m.periodLabel}`, s: { fill: NIGHT, color: BONE, bold: true, size: 12 } });
    g.set(2, right, { v: `${m.generated} · ${m.scope}`, s: { fill: NIGHT, color: NIGHT_INK, size: 9, align: "right" } });
    return;
  }
  g.set(2, 1, { v: title, s: { fill: NIGHT, color: WHITE, bold: true, size: 12 } });
  g.set(2, right, { v: `${m.business}  ·  ${m.periodLabel}  ·  ${m.generated}`, s: { fill: NIGHT, color: NIGHT_INK, size: 9, align: "right" } });
}

function textWidth(widths: number[], from: number, to: number) {
  let w = 0;
  for (let c = from; c <= to; c += 1) w += widths[c] ?? 9;
  return w;
}

/** Rows a wrapped text needs at a given width (in Excel's character units). */
function linesFor(text: string, width: number, size = 10) {
  const per = Math.max(4, (width - 1.5) * (10 / size) * 1.2);
  let lines = 0;
  for (const para of text.split("\n")) {
    let line = 0;
    lines += 1;
    for (const word of para.split(/\s+/)) {
      const len = word.length + (line ? 1 : 0);
      if (line + len > per && line > 0) {
        lines += 1;
        line = word.length;
      } else line += len;
    }
  }
  return lines;
}

function description(sheet: Sheet, m: Model, summaryName: string, text: string) {
  const g = sheet.grid;
  const right = sheet.widths.length - 2;
  const back = m.tx("← Volver al Resumen", "← Back to Summary");
  // The way back sits on the light row, right-aligned; the description stops short of it.
  g.set(5, right, { v: back, s: { color: ACCENT, underline: true, bold: true, size: 9, align: "right" } });
  sheet.links.push({ ref: `${colName(right)}5`, target: summaryName, tip: m.tx("Volver al Resumen", "Back to Summary") });
  let last = right - 1;
  let room = sheet.widths[right] ?? 0;
  while (room < 21 && last > 2) room += sheet.widths[last--] ?? 0;
  const w = textWidth(sheet.widths, 1, last);
  const lines = linesFor(text, w, 9.5);
  g.height(5, Math.max(28, lines * 13 + 14));
  g.merge(5, 1, 5, last, { v: text, s: { italic: true, size: 9.5, color: MUTED, wrap: true, valign: "center" } });
  g.height(6, 6);
}

/* ------------------------------------------------------------------ table tabs */

type ColType = "text" | "date" | "month" | "money" | "int" | "num1" | "pill" | "check" | "hours";
interface Col {
  key: string;
  h: string;
  type: ColType;
  total?: "sum" | "count";
  /** A money column: dropped when the export hides amounts. */
  money?: boolean;
  bold?: boolean;
  color?: string;
  headColor?: string;
  /** Dropped when nobody has a value in it. */
  optional?: boolean;
  bar?: string;
  scale?: "high" | "low";
  pills?: Record<string, string>;
  flag?: boolean;
  owe?: boolean;
  max?: number;
  min?: number;
}
type Val = string | number | null | undefined | { f: string; v?: number | string | null };
type RowFn = (L: (key: string) => string, r: number) => Record<string, Val>;

const NUMERIC: ColType[] = ["money", "int", "num1", "hours"];
const fmtOf = (t: ColType): Fmt | undefined =>
  t === "pill" ? "dot" : t === "month" ? "month" : t === "money" ? "money" : t === "int" ? "int" : t === "num1" ? "num1" : t === "hours" ? "hours" : t === "date" ? "date" : undefined;

function shown(col: Col, value: Val): string {
  const v = value && typeof value === "object" ? value.v : value;
  if (v == null || v === "") return "";
  if (col.type === "date") return "00 mmm 0000";
  if (col.type === "month") return "mmm 0000";
  if (col.type === "check") return "☐";
  if (typeof v === "string") return col.type === "pill" ? `●  ${v}` : v;
  if (col.type === "money") return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (col.type === "num1") return v.toFixed(1);
  if (col.type === "hours") return `${v.toFixed(1)} h`;
  return Math.round(v).toLocaleString("en-US");
}

function stored(col: Col, value: Val): XCell["v"] {
  if (value && typeof value === "object") return typeof value.v === "number" && !Number.isFinite(value.v) ? null : value.v ?? null;
  if (col.type === "check") return "☐";
  if (value == null || value === "") return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  if (col.type === "date") return typeof value === "string" ? serial(value) : null;
  if (col.type === "month") return typeof value === "string" ? serial(`${value.slice(0, 7)}-01`) : null;
  if (col.type === "money" || col.type === "num1" || col.type === "hours") return typeof value === "number" ? Math.round(value * 100) / 100 : value;
  return value;
}

interface Built {
  sheet: Sheet;
  L: (key: string) => string;
  C: (key: string) => number;
  first: number;
  last: number;
  rows: number;
  totals: boolean;
}

let TABLE_SEQ = 0;

function tableSheet(opts: { name: string; title: string; sub: string; cols: Col[]; rows: RowFn[]; tab: string; m: Model; summaryName: string; extra?: number[]; freezeCol?: boolean; amounts?: boolean }): Built {
  const { m } = opts;
  const amounts = opts.amounts ?? m.amounts;
  const tx = m.tx;
  const kept = opts.cols.filter((c) => amounts || !c.money);
  // Drop optional columns nobody filled (a finished sheet carries no empty columns).
  const probeL = (cols: Col[]) => (key: string) => colName(1 + Math.max(0, cols.findIndex((c) => c.key === key)));
  const probe = opts.rows.map((fn, i) => fn(probeL(kept), HEAD + 1 + i));
  const cols = kept.filter((c) => !c.optional || probe.some((r) => { const v = r[c.key]; const x = v && typeof v === "object" ? v.v : v; return x != null && x !== "" && x !== 0; }));
  const C = (key: string) => 1 + cols.findIndex((c) => c.key === key);
  const L = (key: string) => colName(C(key));
  const data = opts.rows.map((fn, i) => fn(L, HEAD + 1 + i));
  const first = HEAD + 1;
  const last = HEAD + data.length;
  const totals = data.length > 0 && cols.some((c) => c.total);

  // Widths sized to what each column shows.
  const widths: number[] = [GUTTER];
  const wraps: number[] = [];
  cols.forEach((c) => {
    const k = c.bold ? 1.08 : 1;
    const content = Math.max(0, ...data.map((r) => shown(c, r[c.key]).length)) * k;
    const words = c.h.split(/\s+/);
    // A short title stays on one line; only long ones break, and then at about half.
    const head = c.h.length <= 18 ? c.h.length * 1.02 + 3.6 : Math.max(Math.max(...words.map((w) => w.length)) * 1.08, c.h.length / 2 + 1) + 4.2;
    const max = c.max ?? (c.type === "text" ? 46 : 18);
    const min = c.min ?? (c.type === "check" ? 7 : 8);
    const want = Math.max(head, content + 3.4, min);
    widths.push(Math.round(Math.min(max, want) * 10) / 10);
    wraps.push(want > max ? 1 : 0);
  });
  widths.push(...(opts.extra ?? []), 2.6);

  const sheet: Sheet = { name: opts.name, grid: new Grid(), widths, tab: opts.tab, freeze: { row: HEAD, col: opts.freezeCol ? 2 : 0 }, tables: [], cfs: [], links: [], charts: [], printTitle: HEAD, landscape: true };
  const g = sheet.grid;
  band(sheet, m, opts.title);
  description(sheet, m, opts.summaryName, opts.sub);

  // Header
  g.height(HEAD, 32);
  cols.forEach((c, i) => {
    const num = NUMERIC.includes(c.type);
    g.set(HEAD, i + 1, { v: c.h, s: { fill: ACCENT_SOFT, color: c.headColor ?? ACCENT, bold: true, size: 9.5, wrap: true, align: num ? "right" : c.type === "check" ? "center" : "left", indent: c.type === "check" ? 0 : 1, bottom: { style: "thin", color: LAWN } } });
  });

  // Rows
  const values: Record<string, XCell["v"]>[] = [];
  data.forEach((row, ri) => {
    const r = first + ri;
    let lines = 1;
    const vals: Record<string, XCell["v"]> = {};
    cols.forEach((c, ci) => {
      const raw = row[c.key];
      const v = stored(c, raw);
      vals[c.key] = v;
      const num = NUMERIC.includes(c.type);
      const s: Style = {
        fmt: fmtOf(c.type),
        align: num ? "right" : c.type === "check" ? "center" : "left",
        indent: c.type === "check" ? 0 : 1,
        bold: c.bold || c.type === "pill",
        color: c.color ?? (c.type === "pill" || c.type === "check" ? MUTED : undefined),
        size: c.type === "pill" ? 9.5 : c.type === "check" ? 12 : undefined,
      };
      if (typeof v === "string" && num) {
        s.color = MUTED;
        s.fmt = undefined;
        s.italic = true;
      }
      if (wraps[ci] && typeof v === "string") {
        s.wrap = true;
        lines = Math.max(lines, linesFor(v, widths[ci + 1]!, c.bold ? 10.8 : 10));
      }
      if (raw && typeof raw === "object") g.set(r, ci + 1, { f: raw.f, v, s });
      else g.set(r, ci + 1, { v, s });
    });
    values.push(vals);
    g.height(r, lines > 1 ? lines * 13 + 8 : 20);
  });
  if (!data.length) {
    g.height(first, 24);
    g.set(first, 1, { v: tx("No hay nada aquí en este periodo.", "Nothing here for this period."), s: { italic: true, color: MUTED, indent: 1 } });
  }

  // Totals (SUBTOTAL, so they follow the filter)
  const tcols: Table["cols"] = cols.map((c) => ({ name: c.h }));
  if (totals) {
    const r = last + 1;
    g.height(r, 24);
    cols.forEach((c, ci) => {
      const col = colName(ci + 1);
      const top: Side = { style: "thin", color: ACCENT };
      const base: Style = { bold: true, top, fill: CREAM, align: NUMERIC.includes(c.type) ? "right" : "left", indent: 1 };
      if (ci === 0) {
        g.set(r, 1, { v: "Total", s: { ...base, color: ACCENT } });
        tcols[0]!.label = "Total";
        return;
      }
      if (!c.total) {
        g.set(r, ci + 1, { s: base });
        return;
      }
      const fn = c.total === "count" ? 103 : 109;
      const nums = values.map((v) => v[c.key]).filter((n): n is number => typeof n === "number");
      const cached = c.total === "count" ? nums.length : Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
      const f = `SUBTOTAL(${fn},${col}${first}:${col}${last})`;
      tcols[ci]!.total = f;
      g.set(r, ci + 1, { f, v: cached, s: { ...base, fmt: c.type === "money" ? "money" : c.type === "num1" ? "num1" : c.type === "hours" ? "hours" : "int", color: c.color ?? INK } });
    });
  }

  if (data.length) {
    TABLE_SEQ += 1;
    const ascii = opts.name.normalize("NFD").replace(/[^A-Za-z0-9]/g, "");
    sheet.tables.push({ name: `Brizna${ascii}${TABLE_SEQ}`, header: HEAD, first, last, totals, cols: tcols, col0: 1 });
    // Quiet formatting, in priority order: dots and flags, owed, scales, bars, then the bands.
    cols.forEach((c, ci) => {
      const L1 = colName(ci + 1);
      const range = `${L1}${first}:${L1}${last}`;
      if (c.pills) for (const [text, fg] of Object.entries(c.pills)) sheet.cfs.push({ kind: "equal", sqref: range, text, dxf: { color: fg, bold: true } });
      if (c.flag) sheet.cfs.push({ kind: "expr", sqref: range, formula: `LEN(${L1}${first})>0`, dxf: { color: LATE, fill: LATE_SOFT, bold: true } });
      if (c.owe) sheet.cfs.push({ kind: "greater0", sqref: range, dxf: { color: LATE, bold: true } });
    });
    cols.forEach((c, ci) => {
      const range = `${colName(ci + 1)}${first}:${colName(ci + 1)}${last}`;
      if (c.type === "money") sheet.cfs.push({ kind: "less0", sqref: range, dxf: { color: LATE } });
      if (c.scale) sheet.cfs.push({ kind: "scale", sqref: range, colors: c.scale === "high" ? ["F6DED8", "FAF7EC", "D3E9D3"] : ["D3E9D3", "FAF7EC", "F6DED8"] });
      if (c.bar) sheet.cfs.push({ kind: "bar", sqref: range, color: c.bar });
    });
    sheet.cfs.push({ kind: "expr", sqref: `B${first}:${colName(cols.length)}${last}`, formula: `MOD(ROW()-${first},2)=1`, dxf: { fill: BAND } });
  }
  return { sheet, L, C, first, last, rows: data.length, totals };
}

function section(g: Grid, r: number, c1: number, c2: number, text: string) {
  g.height(r, 24);
  g.merge(r, c1, r, c2, { v: text.toUpperCase(), s: { bold: true, size: 9, color: ACCENT, valign: "bottom", bottom: { style: "thin", color: RULE } } });
}

/* ------------------------------------------------------------------ tab names */

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

/** Tab colours by group: money (teal), work (green), clients (lawn), notes and advice (sky). */
function tabColor(id: string) {
  if (id === "meses" || id === "cobros" || id === "pagos" || id === "propinas") return MONEY;
  if (id === "trabajos" || id === "agenda" || id === "horas" || id === "pospuestos" || id === "libres") return GREEN;
  if (id === "clientes" || id === "precios") return SOIL;
  return SKY_TAB;
}

/* ------------------------------------------------------------------ the workbook */

export function reportXlsxBytes(m: Model): Uint8Array {
  TABLE_SEQ = 0;
  const tx = m.tx;
  const sub = (id: SectionId) => m.takeaway[id] ?? "";
  const tabs = tabNames(m);
  const summaryName = tabs[0]!.name;
  const sheets: Sheet[] = [];
  const guide: { name: string; what: string; rows: number }[] = [];
  const built: Partial<Record<string, Built>> = {};
  const what: Record<string, string> = {
    meses: tx("Trabajo, cobrado, propinas y perdonado de cada mes, con su gráfica.", "Work, collected, tips and forgiven each month, with its chart."),
    cobros: tx("Quién debe, cuánto y desde cuándo, con la deuda por antigüedad.", "Who owes, how much and since when, with the debt by age."),
    pagos: tx("Cada pago con fecha, medio y propina.", "Every payment with date, method and tip."),
    trabajos: tx("Cada trabajo hecho con su monto.", "Every job done with its amount."),
    agenda: tx("Los próximos patios, con casilla para marcar.", "The next yards, with a box to tick."),
    clientes: tx("El directorio: contacto, día, frecuencia, precio y saldo.", "The directory: contact, day, frequency, price and balance."),
    precios: tx("Lo que paga cada patio y cuánto deja al mes.", "What each yard pays and what it brings a month."),
    horas: tx("Entrada, salida, horas y $ por hora de cada día.", "Clock in, out, hours and $ an hour each day."),
    propinas: tx("Cada propina y quién la dejó.", "Every tip and who left it."),
    pospuestos: tx("Trabajos movidos: de qué día a qué día y por qué.", "Moved jobs: from which day to which, and why."),
    libres: tx("Días sin trabajo y paradas tempranas.", "Days without work and early stops."),
    notas: tx("Notas del día y del fichero.", "Day notes and notebook notes."),
    asesor: tx("La nota del negocio, los mejores pasos y las revisiones.", "The business score, the best moves and the checks."),
  };
  const common = { m, summaryName };
  const groupPills = { [tx("Activo", "Active")]: GREEN, [tx("Una vez", "One-time")]: MONEY, [tx("Archivado", "Archived")]: SUBTLE };

  for (const t of tabs) {
    let b: Built | null = null;
    const tab = tabColor(t.id);
    if (t.id === "meses") {
      const months = m.months.slice().sort((a, b2) => a.key.localeCompare(b2.key));
      b = tableSheet({
        ...common,
        name: t.name,
        title: tx("Mes por mes", "Month by month"),
        sub: months.length > 1 ? tx(`Trabajo hecho, cobrado, propinas y perdonado de cada mes · ${m.periodLabel}. El mes más viejo arriba, para que la gráfica se lea de izquierda a derecha.`, `Work done, collected, tips and forgiven each month · ${m.periodLabel}. Oldest month first, so the chart reads left to right.`) : tx(`Trabajo hecho, cobrado, propinas y perdonado del mes · ${m.periodLabel}.`, `Work done, collected, tips and forgiven in the month · ${m.periodLabel}.`),
        cols: [
          { key: "month", h: tx("Mes", "Month"), type: "month", bold: true, min: 12 },
          { key: "jobs", h: tx("Trabajos", "Jobs"), type: "int", total: "sum" },
          { key: "value", h: tx("Valor del trabajo", "Work value"), type: "money", total: "sum", money: true },
          { key: "collected", h: tx("Cobrado", "Collected"), type: "money", total: "sum", money: true, color: MONEY, bold: true, bar: MONEY_BAR },
          { key: "payments", h: tx("Pagos", "Payments"), type: "int", total: "sum" },
          { key: "tips", h: tx("Propinas", "Tips"), type: "money", total: "sum", money: true },
          { key: "forgiven", h: tx("Perdonado", "Forgiven"), type: "money", total: "sum", money: true, optional: true },
        ],
        rows: months.map((x) => () => ({ month: x.key, jobs: x.jobs, value: x.value, collected: x.collected, payments: x.payments, tips: x.tips, forgiven: x.forgiven })),
        tab,
        extra: [3, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      });
      if (b.rows > 1) {
        const c0 = b.sheet.widths.length - 10;
        b.sheet.charts.push(monthChart(m, b, t.name, months, [c0, HEAD - 1], [c0 + 9, HEAD - 1 + 18]));
      }
    } else if (t.id === "cobros") {
      b = tableSheet({
        ...common,
        name: t.name,
        title: tx("Te deben", "Owed to you"),
        sub: sub("cobros"),
        cols: [
          { key: "name", h: tx("Cliente", "Client"), type: "text", bold: true },
          { key: "phone", h: tx("Teléfono", "Phone"), type: "text", optional: true },
          { key: "balance", h: tx("Debe", "Owes"), type: "money", total: "sum", money: true, color: LATE, bold: true, bar: LATE_BAR },
          { key: "b0", h: tx("0–30 días", "0–30 days"), type: "money", total: "sum", money: true, headColor: A0 },
          { key: "b31", h: tx("31–60 días", "31–60 days"), type: "money", total: "sum", money: true, headColor: "A87A0C" },
          { key: "b61", h: tx("61–90 días", "61–90 days"), type: "money", total: "sum", money: true, headColor: A61 },
          { key: "b91", h: tx("Más de 90", "Over 90"), type: "money", total: "sum", money: true, headColor: A91 },
          { key: "opening", h: tx("Saldo inicial", "Opening balance"), type: "money", total: "sum", money: true, headColor: SOIL },
          { key: "oldest", h: tx("Días de la deuda más vieja", "Days of oldest debt"), type: "int", scale: "low", min: 13 },
          { key: "tier", h: tx("Estado", "Status"), type: "pill", pills: { [tx("Serio", "Serious")]: LATE, [tx("En espera", "Waiting")]: PENDING, [tx("Reciente", "Recent")]: GREEN }, min: 13 },
          { key: "since", h: tx("Días desde el último pago", "Days since last payment"), type: "int", min: 13 },
          { key: "unpaid", h: tx("Trabajos sin pagar", "Unpaid jobs"), type: "int", total: "sum", min: 11 },
        ],
        rows: m.cobros.rows.map((r) => () => ({ name: r.name, phone: r.phone, balance: r.balance, b0: r.b0, b31: r.b31, b61: r.b61, b91: r.b91, opening: r.opening, oldest: r.oldestDays, tier: r.tier, since: r.sincePay ?? tx("Sin pagos", "No payments"), unpaid: r.unpaidJobs })),
        tab,
        freezeCol: true,
      });
      if (b.totals && m.amounts && m.kpi.owed > 0) agingBlock(m, b);
    } else if (t.id === "pagos") {
      b = tableSheet({
        ...common,
        name: t.name,
        title: tx("Pagos recibidos", "Payments received"),
        sub: sub("pagos"),
        cols: [
          { key: "date", h: tx("Fecha", "Date"), type: "date" },
          { key: "name", h: tx("Cliente", "Client"), type: "text", bold: true },
          { key: "amount", h: tx("Monto", "Amount"), type: "money", total: "sum", money: true, color: MONEY, bold: true, bar: MONEY_BAR },
          { key: "kind", h: tx("Tipo", "Type"), type: "pill", pills: { [tx("Pago", "Payment")]: GREEN, [tx("Adelanto", "Advance")]: MONEY, [tx("Perdonado", "Forgiven")]: PENDING }, min: 12 },
          { key: "method", h: tx("Medio", "Method"), type: "text" },
          { key: "tip", h: tx("Propina", "Tip"), type: "money", total: "sum", money: true, optional: true },
          { key: "note", h: tx("Nota", "Note"), type: "text", optional: true, max: 44 },
        ],
        rows: m.pagos.rows.map((r) => () => ({ date: r.date, name: r.name, amount: r.amount, kind: r.kind, method: r.method, tip: r.tip || null, note: r.note })),
        tab,
      });
    } else if (t.id === "trabajos") {
      b = tableSheet({
        ...common,
        name: t.name,
        title: tx("Trabajos hechos", "Work done"),
        sub: sub("trabajos"),
        cols: [
          { key: "date", h: tx("Fecha", "Date"), type: "date" },
          { key: "name", h: tx("Cliente", "Client"), type: "text", bold: true },
          { key: "kind", h: tx("Tipo", "Kind"), type: "pill", pills: { [tx("Corte", "Cut")]: GREEN, Extra: MONEY, [tx("Una vez", "One-time")]: SOIL }, min: 11 },
          { key: "job", h: tx("Trabajo", "Job"), type: "text" },
          { key: "amount", h: tx("Monto", "Amount"), type: "money", total: "sum", money: true, bar: GREEN_BAR },
        ],
        rows: m.trabajos.rows.map((r) => () => ({ date: r.date, name: r.name, kind: r.kind, job: r.job, amount: r.amount })),
        tab,
      });
    } else if (t.id === "agenda") {
      const items = [...m.agenda.late, ...m.agenda.days.flatMap((d) => d.items)];
      b = tableSheet({
        ...common,
        name: t.name,
        title: tx("Agenda próxima", "Upcoming route"),
        sub: sub("agenda"),
        cols: [
          { key: "done", h: tx("Hecho", "Done"), type: "check" },
          { key: "date", h: tx("Fecha", "Date"), type: "date", bold: true },
          { key: "n", h: "#", type: "int", min: 6 },
          { key: "name", h: tx("Cliente", "Client"), type: "text", bold: true },
          { key: "address", h: tx("Dirección", "Address"), type: "text", optional: true },
          { key: "phone", h: tx("Teléfono", "Phone"), type: "text", optional: true },
          { key: "time", h: tx("Hora", "Time"), type: "text", optional: true },
          { key: "job", h: tx("Trabajo", "Job"), type: "text" },
          { key: "price", h: tx("Precio", "Price"), type: "money", total: "sum", money: true },
          { key: "owes", h: tx("Debe", "Owes"), type: "money", money: true, owe: true, optional: true },
          { key: "late", h: tx("Atrasado", "Overdue"), type: "text", flag: true, optional: true, min: 10 },
          { key: "cue", h: tx("Nota", "Note"), type: "text", optional: true, max: 40 },
        ],
        rows: items.map((it) => () => {
          const dayIndex = m.agenda.days.find((d) => d.date === it.date)?.items.indexOf(it) ?? -1;
          return { done: null, date: it.date, n: dayIndex >= 0 ? dayIndex + 1 : null, name: it.name, address: it.address, phone: it.phone, time: it.time, job: it.job, price: it.amount, owes: it.owes || null, late: it.late ? tx("Sí", "Yes") : "", cue: it.cue };
        }),
        tab,
      });
    } else if (t.id === "clientes") {
      b = tableSheet({
        ...common,
        name: t.name,
        title: tx("Clientes", "Clients"),
        sub: sub("clientes"),
        cols: [
          { key: "name", h: tx("Cliente", "Client"), type: "text", bold: true },
          { key: "group", h: tx("Estado", "Status"), type: "pill", pills: groupPills, min: 12 },
          { key: "phone", h: tx("Teléfono", "Phone"), type: "text", optional: true },
          { key: "address", h: tx("Dirección", "Address"), type: "text", optional: true },
          { key: "day", h: tx("Día", "Day"), type: "text", optional: true },
          { key: "every", h: tx("Frecuencia", "Frequency"), type: "text" },
          { key: "price", h: tx("Precio", "Price"), type: "money", money: true },
          { key: "next", h: tx("Próximo corte", "Next cut"), type: "date", optional: true },
          { key: "last", h: tx("Último corte", "Last cut"), type: "date", optional: true },
          { key: "balance", h: tx("Debe", "Owes"), type: "money", total: "sum", money: true, owe: true },
          { key: "credit", h: tx("A su favor", "Credit"), type: "money", total: "sum", money: true, optional: true, color: MONEY },
          { key: "since", h: tx("Cliente desde", "Client since"), type: "date", optional: true },
          { key: "notes", h: tx("Notas", "Notes"), type: "text", optional: true, max: 44 },
        ],
        rows: m.clientRows.map((r) => () => ({ name: r.name, group: r.group, phone: r.phone, address: r.address, day: r.day, every: r.every, price: r.price, next: r.next || null, last: r.last || null, balance: r.balance > 0 ? r.balance : null, credit: r.credit > 0 ? r.credit : null, since: r.since || null, notes: r.notes.replace(/\n/g, " · ") })),
        tab,
        freezeCol: true,
      });
    } else if (t.id === "precios") {
      b = tableSheet({
        ...common,
        name: t.name,
        title: tx("Precios", "Prices"),
        sub: sub("precios"),
        cols: [
          { key: "name", h: tx("Cliente", "Client"), type: "text", bold: true },
          { key: "group", h: tx("Estado", "Status"), type: "pill", pills: groupPills, min: 12 },
          { key: "every", h: tx("Frecuencia", "Frequency"), type: "text" },
          { key: "price", h: tx("Precio", "Price"), type: "money", money: true, scale: "high", min: 11 },
          { key: "visits", h: tx("Visitas al mes", "Visits a month"), type: "num1", min: 11 },
          { key: "monthly", h: tx("Al mes", "A month"), type: "money", total: "sum", money: true, color: MONEY, bold: true, bar: MONEY_BAR, min: 13 },
        ],
        rows: m.precios.rows.map((r) => (L, row) => ({ name: r.name, group: r.group, every: r.every, price: r.price, visits: r.visits || null, monthly: r.visits ? { f: `${L("price")}${row}*${L("visits")}${row}`, v: r.monthly } : null })),
        tab,
        extra: [3, 22],
      });
      const p = m.precios;
      if (m.amounts && b.rows) {
        // What is usual, beside the table.
        const c = b.sheet.widths.length - 2;
        const g = b.sheet.grid;
        const facts: [string, number, Fmt][] = [
          [tx("Lo normal (mediana)", "Usual (median)"), p.typical, "money"],
          [tx("Promedio", "Average"), p.average, "money"],
          [tx("El más bajo", "Lowest"), p.low, "money"],
          [tx("El más alto", "Highest"), p.high, "money"],
          [tx("Muy por debajo de lo normal", "Well below the usual"), p.below, "int"],
        ];
        g.set(HEAD, c, { v: tx("Lo normal", "What is usual"), s: { fill: ACCENT_SOFT, color: ACCENT, bold: true, size: 9.5, indent: 1, bottom: { style: "thin", color: LAWN } } });
        facts.forEach(([label, v, fmt], i) => {
          g.set(HEAD + 1 + i * 2, c, { v: label, s: { size: 9, color: MUTED, indent: 1, valign: "bottom" } });
          g.set(HEAD + 2 + i * 2, c, { v, s: { bold: true, size: 12, indent: 1, fmt, align: "left", color: i === 4 && v > 0 ? LATE : INK, bottom: { style: "thin", color: HAIR } } });
        });
      }
    } else if (t.id === "horas") {
      const rows = m.horas.rows.filter((r) => r.hours > 0 || r.stopped);
      b = tableSheet({
        ...common,
        name: t.name,
        title: tx("Horas y $ por hora", "Hours and $ per hour"),
        sub: sub("horas"),
        cols: [
          { key: "date", h: tx("Fecha", "Date"), type: "date" },
          { key: "in", h: tx("Entrada", "In"), type: "text", min: 9 },
          { key: "out", h: tx("Salida", "Out"), type: "text", min: 9 },
          { key: "hours", h: tx("Horas", "Hours"), type: "hours", total: "sum", bold: true, bar: GREEN_BAR, min: 10 },
          { key: "jobs", h: tx("Trabajos", "Jobs"), type: "int", total: "sum" },
          { key: "value", h: tx("Valor del trabajo", "Work value"), type: "money", total: "sum", money: true },
          { key: "perHour", h: tx("$ por hora", "$ an hour"), type: "money", money: true, color: MONEY, bold: true, scale: "high" },
          { key: "collected", h: tx("Cobrado ese día", "Collected that day"), type: "money", total: "sum", money: true },
          { key: "stopped", h: tx("Nota", "Note"), type: "text", optional: true },
        ],
        rows: rows.map((r) => (L, row) => ({ date: r.date, in: r.clockIn, out: r.clockOut, hours: r.hours, jobs: r.jobs, value: r.value, perHour: r.hours > 0 ? { f: `IF(N(${L("hours")}${row})>0,${L("value")}${row}/${L("hours")}${row},"")`, v: Math.round((r.value / r.hours) * 100) / 100 } : null, collected: r.collected, stopped: r.stopped })),
        tab,
      });
    } else if (t.id === "propinas") {
      b = tableSheet({
        ...common,
        name: t.name,
        title: tx("Propinas", "Tips"),
        sub: sub("propinas"),
        cols: [
          { key: "date", h: tx("Fecha", "Date"), type: "date" },
          { key: "name", h: tx("Cliente", "Client"), type: "text", bold: true },
          { key: "tip", h: tx("Propina", "Tip"), type: "money", total: "sum", money: true, color: GREEN, bold: true, bar: GREEN_BAR, min: 12 },
          { key: "method", h: tx("Medio", "Method"), type: "text" },
        ],
        rows: m.propinas.rows.map((r) => () => ({ date: r.date, name: r.name, tip: r.tip, method: r.method })),
        tab,
      });
    } else if (t.id === "pospuestos") {
      b = tableSheet({
        ...common,
        name: t.name,
        title: tx("Pospuestos y motivos", "Postponed and why"),
        sub: sub("pospuestos"),
        cols: [
          { key: "from", h: tx("Era el", "Was on"), type: "date" },
          { key: "to", h: tx("Pasó al", "Moved to"), type: "date", bold: true },
          { key: "days", h: tx("Días", "Days"), type: "int", scale: "low", min: 8 },
          { key: "name", h: tx("Cliente", "Client"), type: "text", bold: true },
          { key: "job", h: tx("Trabajo", "Job"), type: "text" },
          { key: "reason", h: tx("Motivo", "Reason"), type: "text" },
        ],
        rows: m.pospuestos.rows.map((r) => (L, row) => ({ from: r.from, to: r.to, days: { f: `${L("to")}${row}-${L("from")}${row}`, v: (serial(r.to) ?? 0) - (serial(r.from) ?? 0) }, name: r.name, job: r.job, reason: r.reason })),
        tab,
      });
    } else if (t.id === "libres") {
      b = tableSheet({
        ...common,
        name: t.name,
        title: tx("Días libres y paradas", "Days off and early stops"),
        sub: tx("Días sin trabajo y días que paraste temprano, con su motivo.", "Days without work and days you stopped early, with the reason."),
        cols: [
          { key: "date", h: tx("Fecha", "Date"), type: "date" },
          { key: "reason", h: tx("Motivo", "Reason"), type: "text", min: 40 },
        ],
        rows: m.pospuestos.offDays.map((d) => () => ({ date: d.date, reason: d.reason })),
        tab,
        extra: [18],
      });
    } else if (t.id === "notas") {
      const day = tx("Nota del día", "Day note");
      const pinned = tx("Fichero · fijada", "Notebook · pinned");
      const book = tx("Fichero", "Notebook");
      b = tableSheet({
        ...common,
        name: t.name,
        title: tx("Notas", "Notes"),
        sub: sub("notas"),
        cols: [
          { key: "kind", h: tx("Tipo", "Type"), type: "pill", pills: { [day]: GREEN, [pinned]: PENDING, [book]: SKY_TAB }, min: 14 },
          { key: "date", h: tx("Fecha", "Date"), type: "date", optional: true },
          { key: "title", h: tx("Título", "Title"), type: "text", bold: true, optional: true, max: 30 },
          { key: "folder", h: tx("Carpeta", "Folder"), type: "text", optional: true },
          { key: "due", h: tx("Para el", "Due"), type: "date", optional: true },
          { key: "text", h: tx("Texto", "Text"), type: "text", max: 70, min: 40 },
        ],
        rows: [
          ...m.notas.day.map((d) => () => ({ kind: day, date: d.date, title: "", folder: "", due: null, text: d.text })),
          ...m.notas.pages.map((p) => () => ({ kind: p.pinned ? pinned : book, date: null, title: p.title, folder: p.folder, due: p.due || null, text: p.text })),
        ],
        tab,
      });
    } else if (t.id === "asesor" && m.asesor) {
      const s = m.asesor;
      const good = tx("Bien", "Good");
      const watch = tx("Ojo", "Watch");
      const weak = tx("Mal", "Weak");
      b = tableSheet({
        ...common,
        name: t.name,
        title: tx("Asesor", "Advisor"),
        sub: tx("El negocio de hoy, en palabras simples (últimos 12 meses).", "The business today, in plain words (last 12 months)."),
        cols: [
          { key: "what", h: tx("Qué", "What"), type: "text", bold: true, min: 16 },
          { key: "title", h: tx("Título", "Title"), type: "text", bold: true, max: 34 },
          { key: "status", h: tx("Estado", "Status"), type: "pill", pills: { [good]: GREEN, [watch]: PENDING, [weak]: LATE }, optional: true, min: 11 },
          { key: "line", h: tx("En palabras", "In plain words"), type: "text", max: 66, min: 40 },
          { key: "impact", h: tx("Impacto", "Impact"), type: "text", color: MONEY, bold: true, optional: true },
        ],
        rows: [
          () => ({ what: tx("Nota del negocio", "Business score"), title: `${s.score}/100 · ${s.word}`, status: s.tone === "good" ? good : s.tone === "warn" ? watch : weak, line: `${s.title} ${s.sub}`, impact: "" }),
          ...s.moves.map((mv, i) => () => ({ what: tx(`Paso ${i + 1}`, `Move ${i + 1}`), title: mv.title, status: "", line: mv.line, impact: mv.impact })),
          ...s.checks.map((c) => () => ({ what: tx("Revisión", "Check"), title: c.label, status: c.status === "pass" ? good : c.status === "warn" ? watch : weak, line: c.line, impact: "" })),
        ],
        tab,
        amounts: true,
      });
    }
    if (!b) continue;
    built[t.id] = b;
    sheets.push(b.sheet);
    guide.push({ name: t.name, what: what[t.id] ?? "", rows: b.rows });
  }
  const summary = summarySheet(m, summaryName, guide, built);
  return packWorkbook(m, [summary, ...sheets]);
}

/** The debt by age, under the Te deben table: live formulas on its Total row, with its chart. */
const AGING = new WeakMap<Sheet, { first: number; last: number; cats: string[]; values: number[] }>();

function agingBlock(m: Model, b: Built) {
  const tx = m.tx;
  const g = b.sheet.grid;
  const tr = b.last + 1;
  const r0 = tr + 3;
  const rows: [string, string, string, number][] = [
    ["b0", tx("0–30 días", "0–30 days"), A0, 0],
    ["b31", tx("31–60 días", "31–60 days"), A31, 0],
    ["b61", tx("61–90 días", "61–90 days"), A61, 0],
    ["b91", tx("Más de 90", "Over 90"), A91, 0],
    ["opening", tx("Saldo inicial", "Opening balance"), AOPEN, 0],
  ];
  const total = Math.max(0.01, m.kpi.owed);
  section(g, r0, 1, 4, tx("La deuda por antigüedad", "The debt by age"));
  const hs: Style = { fill: ACCENT_SOFT, color: ACCENT, bold: true, size: 9.5, indent: 1, bottom: { style: "thin", color: LAWN } };
  g.height(r0 + 1, 8);
  g.height(r0 + 2, 24);
  g.set(r0 + 2, 1, { v: tx("Antigüedad", "Age"), s: hs });
  g.set(r0 + 2, 2, { v: tx("Monto", "Amount"), s: { ...hs, align: "right" } });
  g.set(r0 + 2, 3, { v: tx("Clientes", "Clients"), s: { ...hs, align: "right" } });
  g.set(r0 + 2, 4, { v: tx("Del total", "Of the total"), s: { ...hs, align: "right" } });
  const first = r0 + 3;
  const values: number[] = [];
  rows.forEach(([key, label, color], i) => {
    const r = first + i;
    const L1 = b.L(key);
    const amount = Math.round(m.cobros.rows.reduce((s2, x) => s2 + ((x as unknown as Record<string, number>)[key] ?? 0), 0) * 100) / 100;
    const people = m.cobros.rows.filter((x) => ((x as unknown as Record<string, number>)[key] ?? 0) > 0.004).length;
    values.push(amount);
    const rule: Side = { style: "thin", color: HAIR };
    g.height(r, 21);
    g.set(r, 1, { v: label, s: { bold: true, color, indent: 1, bottom: rule } });
    g.set(r, 2, { f: `${L1}${tr}`, v: amount, s: { fmt: "money", align: "right", indent: 1, bold: true, bottom: rule } });
    g.set(r, 3, { f: `COUNTIF(${L1}${b.first}:${L1}${b.last},">0")`, v: people, s: { fmt: "int", align: "right", indent: 1, color: MUTED, bottom: rule } });
    g.set(r, 4, { f: `IF(N(${b.L("balance")}${tr})=0,"",${colName(2)}${r}/${b.L("balance")}${tr})`, v: amount / total, s: { fmt: "pct", align: "right", indent: 1, color: MUTED, bottom: rule } });
  });
  const last = first + rows.length - 1;
  AGING.set(b.sheet, { first, last, cats: rows.map((x) => x[1]), values });
  b.sheet.charts.push(agingChart(b.sheet.name, { first, last, cats: rows.map((x) => x[1]), values }, [6, r0 - 1], [11, r0 + 11]));
}

function agingChart(sheetName: string, block: { first: number; last: number; cats: string[]; values: number[] }, from: [number, number], to: [number, number]): Chart {
  return {
    from: [from[0], from[1], 0, 6],
    to: [to[0], to[1], 0, 0],
    dir: "col",
    catRef: absRange(sheetName, 1, block.first, block.last),
    cats: block.cats,
    series: [{ name: "$", kind: "bar", color: A0, points: [A0, A31, A61, A91, AOPEN], ref: absRange(sheetName, 2, block.first, block.last), values: block.values }],
    legend: false,
    labels: true,
    hideValueAxis: true,
    axisFmt: `"$"#,##0`,
    gap: 45,
  };
}

function monthChart(m: Model, b: Built, sheetName: string, months: Model["months"], from: [number, number], to: [number, number]): Chart {
  const tx = m.tx;
  return {
    from: [from[0], from[1], 0, 6],
    to: [to[0], to[1], 0, 0],
    dir: "col",
    catRef: absRange(sheetName, b.C("month"), b.first, b.last),
    cats: months.map((x) => x.label),
    catNums: months.map((x) => serial(`${x.key}-01`) ?? 0),
    catFmt: `mmm yy`,
    series: [
      { name: tx("Cobrado", "Collected"), kind: "bar", color: "5A9E62", ref: absRange(sheetName, b.C("collected"), b.first, b.last), values: months.map((x) => x.collected) },
      { name: tx("Valor del trabajo", "Work value"), kind: "line", color: MONEY, ref: absRange(sheetName, b.C("value"), b.first, b.last), values: months.map((x) => x.value) },
    ],
    legend: true,
    axisFmt: `"$"#,##0`,
    gap: 60,
  };
}

/* ------------------------------------------------------------------ summary dashboard */

// Summary grid: A gutter, B a slim lead column, four tile slots with gaps.
const SLOT = [1, 6, 10, 14];
const SLOT_END = [4, 8, 12, 16];
const SUM_LAST = 16; // column Q; R is the right gutter

function summarySheet(m: Model, name: string, tabs: { name: string; what: string; rows: number }[], built: Partial<Record<string, Built>>): Sheet {
  const tx = m.tx;
  const k = m.kpi;
  const widths = [5.2, 1.2, 9.2, 9.2, 9.2, 2.2, 9.6, 9.6, 9.6, 2.2, 9.6, 9.6, 9.6, 2.2, 9.6, 9.6, 9.6, 2.6];
  const sheet: Sheet = { name, grid: new Grid(), widths, tab: NIGHT, tables: [], cfs: [], links: [], charts: [], landscape: false };
  const g = sheet.grid;
  band(sheet, m, m.periodLabel, true);
  g.height(5, 16);
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
  const hours = Math.round((k.minutes / 60) * 10) / 10;

  // KPI tiles
  const tile = (slot: number, accent: string, label: string, value: number | string | null, fmt: Fmt | undefined, subText: string, color: string) => {
    const c = SLOT[slot]!;
    const e = SLOT_END[slot]!;
    const base: Style = { fill: CREAM, indent: 1 };
    g.merge(6, c, 6, e, { v: label.toUpperCase(), s: { ...base, bold: true, size: 8.5, color: MUTED, valign: "bottom", top: { style: "medium", color: accent } } });
    const v = value == null ? "—" : value;
    g.merge(7, c, 7, e, { v, s: { ...base, bold: true, size: 22, color, fmt: typeof v === "number" ? fmt : undefined, align: "left" } });
    g.merge(8, c, 8, e, { v: subText, s: { ...base, size: 9, color: MUTED, valign: "top" } });
  };
  g.height(6, 24);
  g.height(7, 34);
  g.height(8, 22);
  if (m.amounts) {
    tile(0, MONEY, tx("Cobrado", "Collected"), k.collected, "money", tx(`${k.payments} ${plural(k.payments, "pago", "pagos")}${k.tips ? ` · ${usd(k.tips)} propinas` : ""}`, `${k.payments} ${plural(k.payments, "payment", "payments")}${k.tips ? ` · ${usd(k.tips)} tips` : ""}`), MONEY);
    tile(1, LATE, tx("Te deben", "Owed to you"), k.owed, "money", k.owedPeople ? tx(`${k.owedPeople} ${plural(k.owedPeople, "cliente", "clientes")} · hoy`, `${k.owedPeople} ${plural(k.owedPeople, "client", "clients")} · today`) : tx("Nadie te debe", "Nobody owes you"), k.owed > 0 ? LATE : GREEN);
    tile(2, GREEN, tx("Trabajos hechos", "Jobs done"), k.jobsDone, "int", tx(`valen ${usd(k.doneValue)}`, `worth ${usd(k.doneValue)}`), ACCENT);
  } else {
    tile(0, GREEN, tx("Trabajos hechos", "Jobs done"), k.jobsDone, "int", tx(`${k.cuts} ${plural(k.cuts, "corte", "cortes")} · ${k.extras} ${plural(k.extras, "extra", "extras")}`, `${k.cuts} ${plural(k.cuts, "cut", "cuts")} · ${k.extras} ${plural(k.extras, "extra", "extras")}`), ACCENT);
    tile(1, SKY_TAB, tx("Horas trabajadas", "Hours worked"), hours, "hours", tx(`en ${k.workDays} ${plural(k.workDays, "día", "días")}`, `over ${k.workDays} ${plural(k.workDays, "day", "days")}`), INK);
    tile(2, LAWN, tx("Días trabajados", "Days worked"), k.workDays, "int", m.horas.avgDay ? tx(`unas ${m.horas.avgDay.toLocaleString("es-US")} h por día`, `about ${m.horas.avgDay} h a day`) : "", GREEN);
  }
  tile(3, NIGHT, tx("Clientes activos", "Active clients"), k.activeClients, "int", tx(`+ ${k.oneTimeClients} de una vez`, `+ ${k.oneTimeClients} one-time`), INK);

  // Secondary figures
  g.height(9, 14);
  const stat = (r: number, slot: number, label: string, value: number | string | null, fmt?: Fmt) => {
    const c = SLOT[slot]!;
    const e = SLOT_END[slot]!;
    g.merge(r, c, r, e, { v: label, s: { size: 9, color: MUTED, indent: 1, valign: "bottom" } });
    const v = value == null ? "—" : value;
    g.merge(r + 1, c, r + 1, e, { v, s: { bold: true, size: 13, color: INK, indent: 1, fmt: typeof v === "number" ? fmt : undefined, align: "left", valign: "top" } });
  };
  g.height(10, 17);
  g.height(11, 22);
  g.height(12, 6);
  g.height(13, 17);
  g.height(14, 22);
  stat(10, 0, tx("Cortes", "Cuts"), k.cuts, "int");
  stat(10, 1, tx("Extras", "Extras"), k.extras, "int");
  stat(10, 2, tx("Trabajos de una vez", "One-time jobs"), k.once, "int");
  if (m.amounts) {
    stat(10, 3, tx("Horas trabajadas", "Hours worked"), hours, "hours");
    stat(13, 0, tx("Propinas", "Tips"), k.tips, "money");
    stat(13, 1, tx("$ por hora", "$ an hour"), m.horas.perHour || null, "money");
    stat(13, 2, tx("Perdonado", "Forgiven"), k.forgiven, "money");
    stat(13, 3, tx("A favor de clientes", "Client credit"), k.credit, "money");
  } else {
    stat(10, 3, tx("Clientes de una vez", "One-time clients"), k.oneTimeClients, "int");
    g.heights.delete(12);
    g.heights.delete(13);
    g.heights.delete(14);
  }

  // In one sentence
  let r = m.amounts ? 16 : 13;
  g.height(r - 1, 10);
  section(g, r, 1, SUM_LAST, tx("En una frase", "In one sentence"));
  r += 1;
  g.height(r, 8);
  r += 1;
  const sentence = m.headline;
  const lines = linesFor(sentence, textWidth(widths, 2, SUM_LAST), 13);
  g.height(r, Math.max(30, lines * 18 + 10));
  g.set(r, 1, { s: { left: { style: "thick", color: LAWN } } });
  g.merge(r, 2, r, SUM_LAST, { v: sentence, s: { size: 13, color: INK, wrap: true } });
  r += 1;
  g.height(r, 14);
  r += 1;

  // Charts
  const month = built.meses;
  const monthsSorted = m.months.slice().sort((a, b) => a.key.localeCompare(b.key));
  if (month && month.rows > 1) {
    section(g, r, 1, SUM_LAST, tx("Mes por mes · cobrado y valor del trabajo", "Month by month · collected and work value"));
    sheet.charts.push(monthChart(m, month, month.sheet.name, monthsSorted, [1, r], [SUM_LAST + 1, r + 16]));
    for (let i = 1; i <= 16; i += 1) g.height(r + i, 18);
    r += 17;
    g.height(r, 14);
    r += 1;
  }
  const cobros = built.cobros;
  const small: { title: string; chart: (c1: number, c2: number, top: number) => Chart }[] = [];
  const block = cobros ? AGING.get(cobros.sheet) : undefined;
  if (cobros && block && m.amounts && m.kpi.owed > 0) {
    small.push({
      title: tx("Lo que te deben, por antigüedad", "What is owed, by age"),
      chart: (c1, c2, top) => agingChart(cobros.sheet.name, block, [c1, top], [c2, top + 14]),
    });
  }
  if (month && month.rows > 1) {
    small.push({
      title: tx("Trabajos hechos por mes", "Jobs done by month"),
      chart: (c1, c2, top) => ({
        from: [c1, top, 0, 6],
        to: [c2, top + 14, 0, 0],
        dir: "col",
        catRef: absRange(month.sheet.name, month.C("month"), month.first, month.last),
        cats: monthsSorted.map((x) => x.label),
        catNums: monthsSorted.map((x) => serial(`${x.key}-01`) ?? 0),
        catFmt: "mmm yy",
        series: [{ name: tx("Trabajos", "Jobs"), kind: "bar", color: LAWN, ref: absRange(month.sheet.name, month.C("jobs"), month.first, month.last), values: monthsSorted.map((x) => x.jobs) }],
        legend: false,
        labels: true,
        hideValueAxis: true,
        axisFmt: "#,##0",
        gap: 45,
      }),
    });
  }
  if (small.length) {
    sheet.breaks = [r - 1];
    const spans: [number, number][] = small.length === 2 ? [[1, 8], [10, SUM_LAST]] : [[1, SUM_LAST]];
    small.forEach((s, i) => {
      const [c1, c2] = spans[i]!;
      section(g, r, c1, c2, s.title);
      sheet.charts.push(s.chart(c1, c2 + 1, r));
    });
    for (let i = 1; i <= 14; i += 1) g.height(r + i, 18);
    r += 15;
    g.height(r, 14);
    r += 1;
  }

  // The figures, with what each one means
  const rule: Side = { style: "thin", color: HAIR };
  const kv = (label: string, value: number | string | null, fmt?: Fmt, note = "", color = INK) => {
    g.height(r, 21);
    const v = value == null ? "—" : value;
    g.merge(r, 1, r, 5, { v: label, s: { indent: 1, bottom: rule } });
    g.merge(r, 6, r, 8, { v, s: { bold: true, align: "right", indent: 1, fmt: typeof v === "number" ? fmt : undefined, bottom: rule, color: typeof v === "number" && v < 0 ? LATE : color } });
    g.set(r, 9, { s: { bottom: rule } });
    g.merge(r, 10, r, SUM_LAST, { v: note, s: { italic: true, size: 9, color: MUTED, indent: 1, bottom: rule } });
    r += 1;
  };
  if (m.amounts) {
    section(g, r, 1, SUM_LAST, tx("Dinero", "Money"));
    r += 1;
    kv(tx("Cobrado", "Collected"), k.collected, "money", tx(`${k.payments} ${plural(k.payments, "pago", "pagos")} en el periodo`, `${k.payments} ${plural(k.payments, "payment", "payments")} in the period`), MONEY);
    kv(tx("Te deben (hoy)", "Owed to you (today)"), k.owed, "money", k.owedPeople ? tx(`${k.owedPeople} ${plural(k.owedPeople, "cliente debe", "clientes deben")}`, `${k.owedPeople} ${plural(k.owedPeople, "client owes", "clients owe")}`) : "", k.owed > 0 ? LATE : INK);
    kv(tx("Valor del trabajo hecho", "Value of work done"), k.doneValue, "money", tx("Lo que vale lo que hiciste, cobrado o no", "What the work you did is worth, collected or not"));
    kv(tx("Propinas", "Tips"), k.tips, "money", k.tipCount ? tx(`${k.tipCount} ${plural(k.tipCount, "propina", "propinas")}`, `${k.tipCount} ${plural(k.tipCount, "tip", "tips")}`) : "");
    kv(tx("Perdonado", "Forgiven"), k.forgiven, "money", tx("Deudas que dejaste de cobrar", "Debts you let go"));
    kv(tx("A favor de clientes (adelantos)", "Client credit (paid ahead)"), k.credit, "money", tx("Pagado por adelantado, aún sin trabajo", "Paid ahead, work still to do"));
    if (m.horas.perHour) kv(tx("$ por hora (trabajo hecho)", "$ an hour (work done)"), m.horas.perHour, "money", tx("Valor del trabajo de los días con horas ÷ horas", "Work value on days with hours ÷ hours"), MONEY);
    g.height(r, 14);
    r += 1;
  }
  section(g, r, 1, SUM_LAST, tx("Trabajo y clientes", "Work and clients"));
  r += 1;
  kv(tx("Trabajos hechos", "Jobs done"), k.jobsDone, "int", tx(`${k.cuts} ${plural(k.cuts, "corte", "cortes")}, ${k.extras} ${plural(k.extras, "extra", "extras")} y ${k.once} de una vez`, `${k.cuts} ${plural(k.cuts, "cut", "cuts")}, ${k.extras} ${plural(k.extras, "extra", "extras")} and ${k.once} one-time`), ACCENT);
  kv(tx("Horas trabajadas", "Hours worked"), hours, "hours", k.workDays ? tx(`en ${k.workDays} ${plural(k.workDays, "día", "días")}`, `over ${k.workDays} ${plural(k.workDays, "day", "days")}`) : "");
  kv(tx("Clientes activos", "Active clients"), k.activeClients, "int");
  kv(tx("Clientes de una vez", "One-time clients"), k.oneTimeClients, "int");
  if (k.archivedClients) kv(tx("Clientes archivados", "Archived clients"), k.archivedClients, "int");
  if (k.pendingInPeriod) kv(tx("Trabajos atrasados", "Overdue jobs"), k.pendingInPeriod, "int", tx("Pendientes con fecha pasada", "Pending with a past date"), LATE);
  g.height(r, 14);
  r += 1;

  // One sentence per section
  const said = m.sections.filter((id) => id !== "resumen" && m.takeaway[id]);
  if (sheet.breaks) sheet.breaks.push(r - 1);
  if (said.length) {
    section(g, r, 1, SUM_LAST, tx("En pocas palabras", "In a few words"));
    r += 1;
    for (const id of said) {
      const text = m.takeaway[id]!;
      const h = Math.max(21, linesFor(text, textWidth(widths, 6, SUM_LAST), 9.5) * 13 + 8);
      g.height(r, h);
      g.merge(r, 1, r, 5, { v: m.sectionTitle(id), s: { bold: true, indent: 1, bottom: rule, valign: "top" } });
      g.merge(r, 6, r, SUM_LAST, { v: text, s: { size: 9.5, color: INK, indent: 1, wrap: true, bottom: rule, valign: "top" } });
      r += 1;
    }
    g.height(r, 14);
    r += 1;
  }

  // Table of contents
  section(g, r, 1, SUM_LAST, tx("En este libro", "In this workbook"));
  r += 1;
  for (const t of tabs) {
    g.height(r, Math.max(21, linesFor(t.what, textWidth(widths, 10, SUM_LAST), 9.5) * 13 + 8));
    g.merge(r, 1, r, 5, { v: t.name, s: { bold: true, color: ACCENT, underline: true, indent: 1, bottom: rule } });
    sheet.links.push({ ref: `${colName(1)}${r}`, target: t.name, tip: tx(`Abrir ${t.name}`, `Open ${t.name}`) });
    g.merge(r, 6, r, 8, { v: t.rows, s: { color: MUTED, align: "right", indent: 1, fmt: "rows", bottom: rule } });
    g.set(r, 9, { s: { bottom: rule } });
    g.merge(r, 10, r, SUM_LAST, { v: t.what, s: { size: 9.5, color: MUTED, indent: 1, wrap: true, bottom: rule } });
    r += 1;
  }
  g.height(r, 10);
  r += 1;
  const tip = tx(
    "Cada pestaña es una tabla de Excel de verdad: filtra u ordena desde su fila de títulos, y la fila Total suma solo lo que dejes visible. Lo que se calcula (Al mes, $ por hora, Días) son fórmulas vivas.",
    "Every tab is a real Excel table: filter or sort from its title row, and the Total row adds up only what you leave visible. What is worked out (A month, $ an hour, Days) are live formulas.",
  );
  g.height(r, Math.max(30, linesFor(tip, textWidth(widths, 1, SUM_LAST), 9) * 12 + 10));
  g.merge(r, 1, r, SUM_LAST, { v: tip, s: { italic: true, size: 9, color: SUBTLE, wrap: true, indent: 1 } });
  return sheet;
}

/* ------------------------------------------------------------------ package */

function base64Bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function packWorkbook(m: Model, sheets: Sheet[]): Uint8Array {
  const tx = m.tx;
  const styles = new Styles(fmtCodes(tx));
  const strings = new Strings();
  const encoder = new TextEncoder();
  const used = new Set<string>();
  for (const s of sheets) {
    let name = s.name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Hoja";
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${name.slice(0, 28)} ${n++}`;
    used.add(name.toLowerCase());
    s.name = name;
  }
  const files: { name: string; data: Uint8Array }[] = [];
  const overrides: string[] = [];
  const put = (name: string, text: string, type?: string) => {
    files.push({ name, data: encoder.encode(text) });
    if (type) overrides.push(`<Override PartName="/${name}" ContentType="${type}"/>`);
  };
  const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const relsXml = (items: { id: string; type: string; target: string }[]) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map((i) => `<Relationship Id="${i.id}" Type="${REL}/${i.type}" Target="${i.target}"/>`).join("")}</Relationships>`;

  const lang = m.locale === "en" ? "en-US" : "es-US";
  const footerWord = tx("Página &P de &N", "Page &P of &N");
  let chartNo = 0;
  let tableNo = 0;
  const sheetParts: { name: string; text: string }[] = [];
  sheets.forEach((sheet, index) => {
    const n = index + 1;
    const sheetRels: { id: string; type: string; target: string }[] = [];
    const drawingId = "rId1";
    sheetRels.push({ id: drawingId, type: "drawing", target: `../drawings/drawing${n}.xml` });
    const drawRels: { id: string; type: string; target: string }[] = [{ id: "rId1", type: "image", target: "../media/brizna.png" }];
    const chartRids = sheet.charts.map((chart) => {
      chartNo += 1;
      const rid = `rId${drawRels.length + 1}`;
      drawRels.push({ id: rid, type: "chart", target: `../charts/chart${chartNo}.xml` });
      put(`xl/charts/chart${chartNo}.xml`, chartXml(chart, lang), "application/vnd.openxmlformats-officedocument.drawingml.chart+xml");
      return rid;
    });
    put(`xl/drawings/drawing${n}.xml`, drawingXml(sheet, chartRids, "rId1"), "application/vnd.openxmlformats-officedocument.drawing+xml");
    put(`xl/drawings/_rels/drawing${n}.xml.rels`, relsXml(drawRels));
    const tableRids = sheet.tables.map((t) => {
      tableNo += 1;
      const rid = `rId${sheetRels.length + 1}`;
      sheetRels.push({ id: rid, type: "table", target: `../tables/table${tableNo}.xml` });
      put(`xl/tables/table${tableNo}.xml`, tableXml(t, tableNo), "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml");
      return rid;
    });
    sheetParts.push({ name: `xl/worksheets/sheet${n}.xml`, text: sheetXml(sheet, index, styles, strings, footerWord, { drawing: drawingId, tables: tableRids }) });
    overrides.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    put(`xl/worksheets/_rels/sheet${n}.xml.rels`, relsXml(sheetRels));
  });
  for (const p of sheetParts) files.push({ name: p.name, data: encoder.encode(p.text) });
  files.push({ name: "xl/media/brizna.png", data: base64Bytes(MARK_PNG) });

  const title = `${m.business} · ${m.title} · ${m.periodLabel}`;
  const now = new Date().toISOString().slice(0, 19) + "Z";
  put(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(title)}</dc:title><dc:subject>${xml(`${m.title}, ${m.periodLabel}`)}</dc:subject><dc:creator>${xml(m.business)}</dc:creator><cp:keywords>${xml(tx("Brizna; césped; cobros; trabajos", "Brizna; lawn; payments; jobs"))}</cp:keywords><dc:description>${xml(`${m.generated}. ${m.scope}.`)}</dc:description><dc:language>${lang}</dc:language><cp:lastModifiedBy>Brizna</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
    "application/vnd.openxmlformats-package.core-properties+xml",
  );
  put(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Brizna</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><Company>${xml(m.business)}</Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged></Properties>`,
    "application/vnd.openxmlformats-officedocument.extended-properties+xml",
  );
  const printTitles = sheets
    .map((sheet, index) => (sheet.printTitle ? `<definedName name="_xlnm.Print_Titles" localSheetId="${index}">${xml(quoted(sheet.name))}!$${sheet.printTitle}:$${sheet.printTitle}</definedName>` : ""))
    .join("");
  put(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}">
<workbookPr/>
<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000" tabRatio="850" activeTab="0"/></bookViews>
<sheets>${sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>
${printTitles ? `<definedNames>${printTitles}</definedNames>` : ""}
<calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  );
  put(
    "xl/_rels/workbook.xml.rels",
    relsXml([
      ...sheets.map((_, index) => ({ id: `rId${index + 1}`, type: "worksheet", target: `worksheets/sheet${index + 1}.xml` })),
      { id: `rId${sheets.length + 1}`, type: "styles", target: "styles.xml" },
      { id: `rId${sheets.length + 2}`, type: "sharedStrings", target: "sharedStrings.xml" },
    ]),
  );
  put("xl/styles.xml", styles.xml(), "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml");
  put("xl/sharedStrings.xml", strings.xml(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml");
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>${overrides.join("")}</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  return storeZip([
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rootRels) },
    ...files.sort((a, b) => rank(a.name) - rank(b.name)),
  ]);
}

function rank(name: string) {
  if (name.startsWith("docProps")) return 0;
  if (name === "xl/workbook.xml") return 1;
  if (name.startsWith("xl/_rels")) return 2;
  if (name.startsWith("xl/worksheets/sheet")) return 3;
  return 4;
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

