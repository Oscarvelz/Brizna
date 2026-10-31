import type { ReportPack } from "@/lib/report-pdf";

export type WorkRow = { date: string; name: string; status: string; amount: number };
export type PayRow = { date: string; name: string; amount: number; kind: string };
export type HourRow = { date: string; inn: string; out: string; hours: number };

export type WorkbookPack = ReportPack & {
  clients: { name: string; phone: string; price: number; balance: number }[];
  jobs: WorkRow[];
  payments: PayRow[];
  hours: HourRow[];
};

function xml(value: string) {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  return value.replace(/&/g, amp).replace(/</g, lt).replace(/>/g, gt).replace(/"/g, quot);
}

function cell(value: string | number, type: "String" | "Number" = typeof value === "number" ? "Number" : "String") {
  return `<Cell><Data ss:Type="${type}">${type === "Number" ? value : xml(String(value))}</Data></Cell>`;
}

function formula(expr: string, value: number) {
  return `<Cell ss:Formula="${xml(expr)}"><Data ss:Type="Number">${value}</Data></Cell>`;
}

function sheet(name: string, rows: string[][]) {
  const body = rows
    .map(
      (row) =>
        `<Row>${row
          .map((item) => (item.startsWith("<Cell") ? item : cell(item)))
          .join("")}</Row>`,
    )
    .join("");
  return `<Worksheet ss:Name="${xml(name)}"><Table>${body}</Table></Worksheet>`;
}

function sum(name: string, col: string, count: number, fallback: number) {
  if (count <= 0) return formula("0", fallback);
  return formula(`=SUM(${name}!${col}2:${col}${count + 1})`, fallback);
}

export function buildReportXls(pack: WorkbookPack) {
  const clients = pack.clients.map((row) => [cell(row.name), cell(row.phone), cell(row.price), cell(row.balance)]);
  const jobs = pack.jobs.map((row) => [cell(row.date), cell(row.name), cell(row.status), cell(row.amount)]);
  const pays = pack.payments.map((row) => [cell(row.date), cell(row.name), cell(row.amount), cell(row.kind)]);
  const hours = pack.hours.map((row) => [cell(row.date), cell(row.inn), cell(row.out), cell(row.hours)]);
  const collected = pack.payments.reduce((n, row) => n + row.amount, 0);
  const owing = pack.clients.reduce((n, row) => n + Math.max(0, row.balance), 0);
  const hourTotal = pack.hours.reduce((n, row) => n + row.hours, 0);
  const pending = pack.jobs.filter((row) => row.status === "Pendiente").length;
  const leeme = [
    [cell("Brizna"), cell(pack.business)],
    [cell("Fecha"), cell(pack.today)],
    [cell("Clientes"), cell("Nombre, teléfono, precio y saldo.")],
    [cell("Trabajos"), cell("Fecha, cliente, estado y monto.")],
    [cell("Pagos"), cell("Cada cobro. El resumen suma esta hoja.")],
    [cell("Horas"), cell("Horas confirmadas.")],
    [cell("Resumen"), cell("Las cifras son fórmulas. Si cambias un monto, el total cambia.")],
  ];
  const resumen = [
    [cell("Qué"), cell("Cifra")],
    [cell("Cobrado en la hoja"), sum("Pagos", "C", pays.length, collected)],
    [cell("Saldo por cobrar"), clients.length ? formula(`=SUMIF(Clientes!D2:D${clients.length + 1},">0")`, owing) : formula("0", 0)],
    [cell("Horas confirmadas"), sum("Horas", "D", hours.length, hourTotal)],
    [
      cell("Trabajos pendientes"),
      jobs.length
        ? formula(`=COUNTIF(Trabajos!C2:C${jobs.length + 1},"Pendiente")`, pending)
        : formula("0", 0),
    ],
    [
      cell("Promedio de cobro"),
      pays.length ? formula(`=AVERAGE(Pagos!C2:C${pays.length + 1})`, collected / pays.length) : formula("0", 0),
    ],
  ];
  const book = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheet("Leeme", leeme)}
${sheet("Clientes", [[cell("Nombre"), cell("Telefono"), cell("Precio"), cell("Saldo")], ...clients])}
${sheet("Trabajos", [[cell("Fecha"), cell("Cliente"), cell("Estado"), cell("Monto")], ...jobs])}
${sheet("Pagos", [[cell("Fecha"), cell("Cliente"), cell("Monto"), cell("Tipo")], ...pays])}
${sheet("Horas", [[cell("Fecha"), cell("Entrada"), cell("Salida"), cell("Horas")], ...hours])}
${sheet("Resumen", resumen)}
</Workbook>`;
  return book;
}
