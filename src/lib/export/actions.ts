import { saveBinaryFile } from "@/lib/save-file";
import { printDoc } from "./print";
import { renderReport, reportPdfBytes } from "./report-pdf";
import { reportXlsxBytes } from "./report-xlsx";
import type { Model } from "./model";
import type { ExportOptions } from "./options";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function fileBase(m: Model, o: ExportOptions) {
  const span =
    o.period === "all"
      ? m.tx("todo", "all-time")
      : o.period === "month" || o.period === "lastMonth"
        ? m.from.slice(0, 7)
        : o.period === "year" || o.period === "lastYear"
          ? m.from.slice(0, 4)
          : `${m.from}_${m.to}`;
  return `Brizna_${slug(m.title)}_${span}`;
}

export async function downloadPdf(m: Model, o: ExportOptions) {
  return saveBinaryFile(`${fileBase(m, o)}.pdf`, reportPdfBytes(m), m.tx("Informe PDF", "PDF report"), ".pdf", "application/pdf");
}

export async function downloadSheet(m: Model, o: ExportOptions) {
  return saveBinaryFile(`${fileBase(m, o)}.xlsx`, reportXlsxBytes(m), m.tx("Hoja de cálculo", "Worksheet"), ".xlsx", XLSX_MIME);
}

export async function printReport(m: Model) {
  const { doc, title } = renderReport(m);
  await printDoc(doc, title);
}

export function canShareFiles(): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
    const probe = new File([new Uint8Array([37])], "a.pdf", { type: "application/pdf" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Shares one file with the phone's share sheet (WhatsApp, mail, Drive…). */
export async function shareFile(m: Model, o: ExportOptions, kind: "pdf" | "xlsx"): Promise<"shared" | "saved"> {
  const bytes = kind === "pdf" ? reportPdfBytes(m) : reportXlsxBytes(m);
  const name = `${fileBase(m, o)}.${kind}`;
  const type = kind === "pdf" ? "application/pdf" : XLSX_MIME;
  const raw = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(raw).set(bytes);
  const file = new File([raw], name, { type });
  if (canShareFiles() && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: `${m.business} · ${m.title}`, text: `${m.title} · ${m.periodLabel}` });
    return "shared";
  }
  await saveBinaryFile(name, bytes, kind === "pdf" ? "PDF" : m.tx("Hoja de cálculo", "Worksheet"), `.${kind}`, type);
  return "saved";
}
