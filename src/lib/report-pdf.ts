export type ReportWeek = { label: string; collected: number };
export type ReportClient = { name: string; phone: string; balance: number; price: number };
export type ReportPack = {
  business: string;
  today: string;
  weekCollected: number;
  owingPeople: number;
  owingTotal: number;
  weeks: ReportWeek[];
  owing: ReportClient[];
};

const WIN: Record<string, number> = {
  "¡": 0xa1, "¢": 0xa2, "£": 0xa3, "¤": 0xa4, "¥": 0xa5, "¦": 0xa6, "§": 0xa7, "¨": 0xa8,
  "©": 0xa9, "ª": 0xaa, "«": 0xab, "¬": 0xac, "®": 0xae, "¯": 0xaf, "°": 0xb0, "±": 0xb1,
  "²": 0xb2, "³": 0xb3, "´": 0xb4, "µ": 0xb5, "¶": 0xb6, "·": 0xb7, "¸": 0xb8, "¹": 0xb9,
  "º": 0xba, "»": 0xbb, "¼": 0xbc, "½": 0xbd, "¾": 0xbe, "¿": 0xbf, "À": 0xc0, "Á": 0xc1,
  "Â": 0xc2, "Ã": 0xc3, "Ä": 0xc4, "Å": 0xc5, "Æ": 0xc6, "Ç": 0xc7, "È": 0xc8, "É": 0xc9,
  "Ê": 0xca, "Ë": 0xcb, "Ì": 0xcc, "Í": 0xcd, "Î": 0xce, "Ï": 0xcf, "Ñ": 0xd1, "Ò": 0xd2,
  "Ó": 0xd3, "Ô": 0xd4, "Õ": 0xd5, "Ö": 0xd6, "×": 0xd7, "Ø": 0xd8, "Ù": 0xd9, "Ú": 0xda,
  "Û": 0xdb, "Ü": 0xdc, "Ý": 0xdd, "ß": 0xdf, "à": 0xe0, "á": 0xe1, "â": 0xe2, "ã": 0xe3,
  "ä": 0xe4, "å": 0xe5, "æ": 0xe6, "ç": 0xe7, "è": 0xe8, "é": 0xe9, "ê": 0xea, "ë": 0xeb,
  "ì": 0xec, "í": 0xed, "î": 0xee, "ï": 0xef, "ñ": 0xf1, "ò": 0xf2, "ó": 0xf3, "ô": 0xf4,
  "õ": 0xf5, "ö": 0xf6, "÷": 0xf7, "ø": 0xf8, "ù": 0xf9, "ú": 0xfa, "û": 0xfb, "ü": 0xfc,
  "ý": 0xfd, "ÿ": 0xff,
};

function pdfText(value: string) {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 32;
    if (ch === "\\") out += "\\\\";
    else if (ch === "(") out += "\\(";
    else if (ch === ")") out += "\\)";
    else if (code >= 32 && code <= 126) out += ch;
    else if (WIN[ch] != null) out += `\\${WIN[ch]!.toString(8).padStart(3, "0")}`;
    else out += " ";
  }
  return `(${out})`;
}

function money(n: number) {
  const v = Math.round(n * 100) / 100;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function wrap(text: string, size: number) {
  const width = 520 / (size * 0.5);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function buildReportPdf(pack: ReportPack): Uint8Array {
  const pages: string[] = [];
  const cover: string[] = [];
  cover.push("0.96 0.95 0.90 rg 0 0 612 792 re f");
  cover.push("0.16 0.36 0.22 rg 0 748 612 44 re f");
  cover.push("1 1 1 rg BT /F1 18 Tf 36 766 Td " + pdfText("Brizna") + " Tj ET");
  cover.push("0.16 0.28 0.18 rg BT /F1 16 Tf 36 710 Td " + pdfText(pack.business.slice(0, 48)) + " Tj ET");
  cover.push("0.35 0.32 0.28 rg BT /F1 11 Tf 36 690 Td " + pdfText(`Informe  ·  ${pack.today}`) + " Tj ET");
  const sentence = `Esta semana cobraste ${money(pack.weekCollected)}. ${pack.owingPeople} ${pack.owingPeople === 1 ? "persona debe" : "personas deben"} ${money(pack.owingTotal)}.`;
  let y = 656;
  for (const line of wrap(sentence, 12)) {
    cover.push(`0.2 0.18 0.14 rg BT /F1 12 Tf 36 ${y} Td ${pdfText(line)} Tj ET`);
    y -= 18;
  }
  y -= 8;
  cover.push("0.22 0.45 0.28 rg BT /F1 12 Tf 36 " + y + " Td " + pdfText("Cobrado por semana") + " Tj ET");
  y -= 28;
  const chartBottom = y - 140;
  const max = Math.max(1, ...pack.weeks.map((w) => w.collected));
  const slot = 520 / Math.max(1, pack.weeks.length);
  pack.weeks.forEach((week, i) => {
    const h = Math.max(2, Math.round((week.collected / max) * 120));
    const x = 40 + i * slot;
    cover.push(`0.22 0.48 0.30 rg ${x.toFixed(1)} ${chartBottom} 28 ${h} re f`);
    cover.push(`0.35 0.32 0.28 rg BT /F1 8 Tf ${x.toFixed(1)} ${chartBottom - 14} Td ${pdfText(week.label)} Tj ET`);
  });
  pages.push(cover.join("\n"));

  const rows = pack.owing.slice(0, 24);
  const table: string[] = [];
  table.push("0.96 0.95 0.90 rg 0 0 612 792 re f");
  table.push("0.16 0.36 0.22 rg 0 748 612 44 re f");
  table.push("1 1 1 rg BT /F1 16 Tf 36 766 Td " + pdfText("Quienes deben") + " Tj ET");
  let rowY = 710;
  table.push("0.25 0.22 0.18 rg BT /F1 10 Tf 36 " + rowY + " Td " + pdfText("Cliente") + " Tj ET");
  table.push("BT /F1 10 Tf 360 " + rowY + " Td " + pdfText("Precio") + " Tj ET");
  table.push("BT /F1 10 Tf 470 " + rowY + " Td " + pdfText("Debe") + " Tj ET");
  rowY -= 8;
  table.push("0.75 0.7 0.6 RG 36 " + rowY + " m 540 " + rowY + " l S");
  rowY -= 18;
  if (!rows.length) {
    table.push("0.35 0.32 0.28 rg BT /F1 12 Tf 36 " + rowY + " Td " + pdfText("Nadie debe ahora.") + " Tj ET");
  }
  rows.forEach((row, index) => {
    if (index % 2 === 0) table.push(`0.93 0.91 0.84 rg 32 ${rowY - 4} 548 18 re f`);
    table.push("0.15 0.14 0.12 rg BT /F1 11 Tf 36 " + rowY + " Td " + pdfText(row.name.slice(0, 32)) + " Tj ET");
    table.push("BT /F1 11 Tf 360 " + rowY + " Td " + pdfText(money(row.price)) + " Tj ET");
    table.push("BT /F1 11 Tf 470 " + rowY + " Td " + pdfText(money(row.balance)) + " Tj ET");
    rowY -= 20;
  });
  table.push("0.45 0.4 0.34 rg BT /F1 9 Tf 36 36 Td " + pdfText("Brizna  ·  " + pack.today) + " Tj ET");
  pages.push(table.join("\n"));

  const objects: string[] = [];
  const pageIds: number[] = [];
  let next = 3;
  const fontId = 3 + pages.length * 2;
  pages.forEach((content, index) => {
    const pageId = next;
    const streamId = next + 1;
    next += 2;
    pageIds.push(pageId);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${streamId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
    objects[streamId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    void index;
  });
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let id = 1; id <= fontId; id += 1) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${fontId + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let id = 1; id <= fontId; id += 1) body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}
