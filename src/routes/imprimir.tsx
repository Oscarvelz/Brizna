import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { methodLabel } from "@/components/method-field";
import { Button } from "@/components/ui/button";
import { formatDay, money } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { exportScope, getSettings, listClients, listJobs } from "@/lib/server/lawn";

function readIso(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export const Route = createFileRoute("/imprimir")({
  validateSearch: (search: Record<string, unknown>): { from?: string; to?: string } => {
    const from = readIso(search.from);
    const to = readIso(search.to);
    return {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    };
  },
  component: ImprimirPage,
});

function jobStatusLabel(status: string, tx: (es: string, en: string) => string): string {
  if (status === "done") return tx("Hecho", "Done");
  if (status === "pending") return tx("Pendiente", "Pending");
  if (status === "skipped") return tx("Pasado", "Moved");
  return status;
}

function payKindLabel(kind: string, tx: (es: string, en: string) => string): string {
  if (kind === "waived") return tx("Perdonado", "Forgiven");
  if (kind === "prepaid") return tx("Adelanto", "Advance");
  if (kind === "paid") return tx("Pagado", "Paid");
  return kind;
}

function rangeTitle(from: string, to: string, tx: (es: string, en: string) => string): string {
  if (from === "1970-01-01" && to.startsWith("2999")) return tx("Todo el historial", "Full history");
  return `${formatDay(from, "d MMM yyyy")} – ${formatDay(to, "d MMM yyyy")}`;
}

function sumMoney(values: Array<string | number>): number {
  return values.reduce<number>((sum, value) => {
    const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function ImprimirPage() {
  const { from, to } = Route.useSearch();
  const scoped = Boolean(from && to);
  if (scoped && from && to) return <ScopedPrint from={from} to={to} />;
  return <RosterPrint />;
}

function ScopedPrint({ from, to }: { from: string; to: string }) {
  const tx = useTx();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const sheet = useQuery({
    queryKey: ["export", from, to],
    queryFn: () => exportScope({ data: { from, to } }),
  });
  const jobs = sheet.data?.jobs ?? [];
  const payments = sheet.data?.payments ?? [];

  return (
    <AppShell
      title={tx("Imprimir", "Print")}
      action={
        <Button size="sm" className="print:hidden" onClick={() => window.print()}>
          <Printer className="size-4" />
          {tx("Imprimir", "Print")}
        </Button>
      }
    >
      <p className="mb-4 text-sm text-muted print:hidden">
        {tx(
          `${rangeTitle(from, to, tx)}. En el teléfono usa Compartir → Imprimir. Salen todas las páginas que hagan falta.`,
          `${rangeTitle(from, to, tx)}. On the phone use Share → Print. As many pages as needed will come out.`,
        )}
      </p>
      <article className="rounded-xl bg-surface p-4 shadow-card print:shadow-none">
        <h2 className="font-display text-xl font-semibold">
          {settings.data?.businessName ?? "Oscar's Lawn Service"}
        </h2>
        <p className="text-sm text-muted">{rangeTitle(from, to, tx)}</p>
      </article>

      <article className="mt-6 rounded-xl bg-surface p-4 shadow-card print:break-before-page print:shadow-none">
        <h2 className="font-display text-xl font-semibold">{tx("Trabajos", "Jobs")}</h2>
        <p className="text-sm text-muted">
          {jobs.length} · {money(sumMoney(jobs.map((j) => j.amount)))}
        </p>
        <div className="mt-3 w-full overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[28rem] text-left text-sm print:min-w-0 print:text-xs">
            <thead className="print:table-header-group">
              <tr className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <th className="py-2 pr-2">{tx("Fecha", "Date")}</th>
                <th className="py-2 pr-2">{tx("Cliente", "Client")}</th>
                <th className="py-2 pr-2">{tx("Trabajo", "Job")}</th>
                <th className="py-2 pr-2">{tx("Estado", "Status")}</th>
                <th className="py-2 text-right">{tx("Monto", "Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j, i) => (
                <tr key={`${j.date}-${j.name}-${i}`} className="border-b border-border/60 break-inside-avoid">
                  <td className="py-1.5 pr-2">{formatDay(j.date, "d MMM yyyy")}</td>
                  <td className="py-1.5 pr-2 font-semibold">{j.name}</td>
                  <td className="py-1.5 pr-2">{j.title ?? tx("Corte", "Cut")}</td>
                  <td className="py-1.5 pr-2">{jobStatusLabel(j.status, tx)}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(Number(j.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="mt-6 rounded-xl bg-surface p-4 shadow-card print:break-before-page print:shadow-none">
        <h2 className="font-display text-xl font-semibold">{tx("Cobros", "Payments")}</h2>
        <p className="text-sm text-muted">
          {payments.length} · {money(sumMoney(payments.map((p) => p.amount)))}
        </p>
        <div className="mt-3 w-full overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[28rem] text-left text-sm print:min-w-0 print:text-xs">
            <thead className="print:table-header-group">
              <tr className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <th className="py-2 pr-2">{tx("Fecha", "Date")}</th>
                <th className="py-2 pr-2">{tx("Cliente", "Client")}</th>
                <th className="py-2 pr-2">{tx("Tipo", "Type")}</th>
                <th className="py-2 pr-2">{tx("Medio", "Method")}</th>
                <th className="py-2 text-right">{tx("Monto", "Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={`${p.date}-${p.name}-${i}`} className="border-b border-border/60 break-inside-avoid">
                  <td className="py-1.5 pr-2">{formatDay(p.date, "d MMM yyyy")}</td>
                  <td className="py-1.5 pr-2 font-semibold">{p.name}</td>
                  <td className="py-1.5 pr-2">{payKindLabel(p.kind, tx)}</td>
                  <td className="py-1.5 pr-2">{methodLabel(p.method) ?? "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(Number(p.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </AppShell>
  );
}

function RosterPrint() {
  const tx = useTx();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const clients = useQuery({
    queryKey: ["clients", { filter: "active", sort: "name" }],
    queryFn: () => listClients({ data: { filter: "active", sort: "name", q: "" } }),
  });
  const jobs = useQuery({
    queryKey: ["jobs", { filter: "pending", range: "ahead" }],
    queryFn: () => listJobs({ data: { filter: "all", range: "ahead", q: "" } }),
  });
  const pending = (jobs.data ?? []).filter((j) => j.status === "pending");

  return (
    <AppShell
      title={tx("Imprimir", "Print")}
      action={
        <Button size="sm" className="print:hidden" onClick={() => window.print()}>
          <Printer className="size-4" />
          {tx("Imprimir", "Print")}
        </Button>
      }
    >
      <p className="mb-4 text-sm text-muted print:hidden">
        {tx(
          "Hojas listas para imprimir o guardar como PDF: clientes y citas pendientes. En el teléfono usa Compartir → Imprimir.",
          "Sheets ready to print or save as PDF: clients and pending appointments. On the phone use Share → Print.",
        )}
      </p>
      <article className="rounded-xl bg-surface p-4 shadow-card print:shadow-none">
        <h2 className="font-display text-xl font-semibold">
          {settings.data?.businessName ?? "Oscar's Lawn Service"}
        </h2>
        <p className="text-sm text-muted">{tx(`Clientes activos · ${clients.data?.length ?? 0}`, `Active clients · ${clients.data?.length ?? 0}`)}</p>
        <div className="mt-3 w-full overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[28rem] text-left text-sm print:min-w-0">
            <thead className="print:table-header-group">
              <tr className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <th className="py-2 pr-2">{tx("Nombre", "Name")}</th>
                <th className="py-2 pr-2">{tx("Teléfono", "Phone")}</th>
                <th className="py-2 pr-2">{tx("Dirección", "Address")}</th>
                <th className="py-2 text-right">{tx("Deuda", "Balance")}</th>
              </tr>
            </thead>
            <tbody>
              {(clients.data ?? []).map((c) => (
                <tr key={c.id} className="border-b border-border/60 break-inside-avoid">
                  <td className="py-2 pr-2 font-semibold">{c.name}</td>
                  <td className="py-2 pr-2">{c.phone ?? "—"}</td>
                  <td className="py-2 pr-2">{c.address ?? "—"}</td>
                  <td className="py-2 text-right tabular-nums">{money(c.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="mt-6 rounded-xl bg-surface p-4 shadow-card print:break-before-page print:shadow-none">
        <h2 className="font-display text-xl font-semibold">{tx("Citas pendientes", "Pending appointments")}</h2>
        <p className="text-sm text-muted">
          {tx(`${pending.length} trabajos · próximos 90 días`, `${pending.length} jobs · next 90 days`)}
        </p>
        <div className="mt-3 w-full overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[28rem] text-left text-sm print:min-w-0">
            <thead className="print:table-header-group">
              <tr className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <th className="py-2 pr-2">{tx("Fecha", "Date")}</th>
                <th className="py-2 pr-2">{tx("Cliente", "Client")}</th>
                <th className="py-2 pr-2">{tx("Trabajo", "Job")}</th>
                <th className="py-2 text-right">{tx("Monto", "Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((j) => (
                <tr key={j.id} className="border-b border-border/60 break-inside-avoid">
                  <td className="py-2 pr-2">{formatDay(j.scheduledDate, "EEE d MMM")}</td>
                  <td className="py-2 pr-2 font-semibold">{j.clientName}</td>
                  <td className="py-2 pr-2">{j.title ?? tx("Corte", "Cut")}</td>
                  <td className="py-2 text-right tabular-nums">{money(j.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </AppShell>
  );
}
