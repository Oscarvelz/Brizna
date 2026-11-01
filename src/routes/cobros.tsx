import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ContactIcons } from "@/components/contact-icons";
import { DensityScope, DensityToggle, useDensity, useQuadCols } from "@/components/density-toggle";
import { Fold } from "@/components/fold";
import { Hint } from "@/components/hint";
import { ScrollTop } from "@/components/scroll-top";
import { methodLabel } from "@/components/method-field";
import { invalidateLawn } from "@/components/job-card";
import { ServicePause } from "@/components/service-pause";
import { PayDialog, type PayMode } from "@/components/pay-dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import {
  endOfWeekISO,
  isPaymentLate,
  lastDayOfMonthISO,
  monthParts,
  startOfWeekISO,
  todayISO,
} from "@/lib/dates";
import { formatDay, formatTime, money, payDueLabel } from "@/lib/format";
import { MeshName } from "@/components/mesh-name";
import { meshFrame, viewGrid } from "@/lib/density";
import { emphasize, useTx } from "@/lib/i18n";
import { listBalances, recordPayment, recordPaymentsBulk } from "@/lib/server/lawn";
import type { ClientRow, JobRow, PaymentRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const cobrosSearch = z.object({
  view: z
    .enum([
      "owing",
      "collectedWeek",
      "collectedMonth",
      "collectedYear",
      "abonos",
      "doneWeek",
      "doneMonth",
      "doneYear",
      "waived",
      "espera",
    ])
    .optional(),
});

export const Route = createFileRoute("/cobros")({
  validateSearch: (s) => cobrosSearch.parse(s),
  component: function CobrosRoute() {
    return (
      <DensityScope scope="cobros">
        <CobrosPage />
      </DensityScope>
    );
  },
});

type CobrosView = NonNullable<z.infer<typeof cobrosSearch>["view"]>;
type OwingSort = "amount" | "name" | "cut" | "late";

function CobrosPage() {
  const tx = useTx();
  const { view: viewParam } = Route.useSearch();
  const view: CobrosView = viewParam ?? "owing";
  const density = useDensity();
  const cols = useQuadCols();
  const dense = density === "dense";
  const media = density === "compact";
  const quad = density === "quad";
  const q = useQuery({ queryKey: ["balances"], queryFn: () => listBalances() });
  const data = q.data;
  const [paying, setPaying] = useState<{ client: ClientRow; mode: PayMode } | null>(null);
  const [sort, setSort] = useState<OwingSort>("amount");
  const [picked, setPicked] = useState<number[]>([]);
  const [askBulk, setAskBulk] = useState<"paid" | "waived" | null>(null);

  useEffect(() => {
    if (!viewParam) return;
    document.getElementById("lista")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [viewParam]);

  const today = todayISO();
  const weekStart = startOfWeekISO(today);
  const weekEnd = endOfWeekISO(today);
  const { year, month } = monthParts(today);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = lastDayOfMonthISO(year, month);

  const owing = useMemo(() => {
    const list = [...(data?.clients ?? [])];
    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      if (sort === "cut") {
        const av = a.lastCutDate ?? "";
        const bv = b.lastCutDate ?? "";
        return bv.localeCompare(av) || b.balance - a.balance;
      }
      if (sort === "late") {
        const al = isPaymentLate(a.payDueDay, today, a.balance) ? 0 : 1;
        const bl = isPaymentLate(b.payDueDay, today, b.balance) ? 0 : 1;
        if (al !== bl) return al - bl;
        return b.balance - a.balance;
      }
      return b.balance - a.balance || a.name.localeCompare(b.name, "es");
    });
    return list;
  }, [data?.clients, sort, today]);

  const qc = useQueryClient();
  const bulk = useMutation({
    mutationFn: (kind: "paid" | "waived") => recordPaymentsBulk({ data: { clientIds: picked, kind } }),
    onSuccess: async (res, kind) => {
      toast.success(
        kind === "paid"
          ? tx(`${res.count} cobros · ${money(res.total)}`, `${res.count} payments · ${money(res.total)}`)
          : tx(`${res.count} saldos perdonados`, `${res.count} balances forgiven`),
      );
      setPicked([]);
      setAskBulk(null);
      await invalidateLawn(qc);
    },
  });

  function toggle(id: number) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const paid = (data?.payments ?? []).filter(
    (p) => p.kind === "paid" && !((p.note ?? "") === "Propina" && p.amount === 0),
  );
  const abonoPays = (data?.payments ?? []).filter((p) => {
    if (!(p.note ?? "").toLowerCase().includes("abono")) return false;
    return owing.some((c) => c.id === p.clientId);
  });
  const abonoClients = owing.filter((c) => abonoPays.some((p) => p.clientId === c.id));
  const abonoSum = abonoPays.reduce((sum, p) => sum + p.amount, 0);
  const abonoPeople = abonoClients.length;
  const paidWeek = paid.filter((p) => {
    const d = p.paidAt.slice(0, 10);
    return d >= weekStart && d <= weekEnd;
  });
  const paidMonth = paid.filter((p) => {
    const d = p.paidAt.slice(0, 10);
    return d >= monthStart && d <= monthEnd;
  });
  const waivedMonth = (data?.payments ?? []).filter((p) => {
    const d = p.paidAt.slice(0, 10);
    return p.kind === "waived" && d >= monthStart && d <= monthEnd;
  });

  return (
    <AppShell title={tx("Cobros", "Payments")}>
      <ScrollTop />
      <section className="relative mb-3 grid min-w-0 grid-cols-2 items-stretch gap-3">
        <div
          className={cn(
            "bz-stat bz-stat-due flex min-h-24 min-w-0 flex-col rounded-xl border-l-4 bg-due-bg p-3 text-left",
            (view === "owing" || view === "abonos") && "bz-stat-on",
          )}
        >
          <p className="bz-stat-label flex items-center gap-1 text-xs font-medium tracking-wide text-muted uppercase">
            {tx("Por cobrar", "To collect")}
            <Hint topic="por-cobrar" />
          </p>
          <Link to="/cobros" search={{ view: "owing" }} hash="lista" className="mt-1 block min-h-10 touch-manipulation">
            <p className="font-display text-xl font-semibold tabular-nums text-due sm:text-2xl">
              {data ? money(data.totals.outstanding) : "—"}
            </p>
            {data ? (
              <p className="text-sm font-semibold text-fg">
                {data.clients.length} {data.clients.length === 1 ? tx("persona", "person") : tx("personas", "people")}
              </p>
            ) : null}
          </Link>
          <div className="mt-auto pt-2">
            <p className="bz-stat-label flex items-center gap-1 text-xs font-medium tracking-wide text-muted uppercase">
              {tx("Abonado", "Partial paid")}
              <Hint topic="abonado" />
            </p>
            <Link
              to="/cobros"
              search={{ view: "abonos" }}
              hash="lista"
              className={cn("block rounded-md touch-manipulation", view === "abonos" && "bg-surface/70 px-1")}
            >
              <p className="font-display text-lg font-semibold tabular-nums text-due">{data ? money(abonoSum) : "—"}</p>
              <p className="text-sm font-semibold text-fg">
                {abonoPeople} {abonoPeople === 1 ? tx("persona", "person") : tx("personas", "people")}
              </p>
            </Link>
          </div>
        </div>
        <CollectedNest
          week={data ? money(data.totals.collectedWeek) : "—"}
          month={data ? money(data.totals.collectedMonth) : "—"}
          year={data ? money(data.totals.collectedYear) : "—"}
          active={view.startsWith("collected")}
          current={view}
        />
      </section>

      <div className="mb-3 grid gap-3">
        <Fold
          id="cob-espera"
          group="cobros"
          className="bz-fold-toned bg-hold-bg [--fold-tone:var(--color-hold)]"
          title={
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="min-w-0 truncate">{tx("En espera", "Waiting")}</span>
              <span className="bz-fold-badge">
                {data
                  ? String(data.clients.filter((c) => inEspera(c)).length)
                  : "—"}
              </span>
            </span>
          }
          hint={
            <Hint topic="en-espera" />
          }
        >
          <Link to="/cobros" search={{ view: "espera" }} hash="lista" className="block text-sm font-semibold text-hold">
            {tx("Siguen debiendo. Toca para verlos.", "They still owe. Tap to see them.")}
          </Link>
        </Fold>
        <Fold
          id="cob-perdonado"
          group="cobros"
          className="bz-fold-toned bg-late-bg [--fold-tone:var(--color-late)]"
          title={
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="min-w-0 truncate">{tx("Perdonado este mes", "Forgiven this month")}</span>
              <span className="bz-fold-badge">
                {data ? money(data.totals.waivedMonth) : "—"}
              </span>
            </span>
          }
          hint={
            <Hint topic="perdonado" />
          }
        >
          <Link to="/cobros" search={{ view: "waived" }} hash="lista" className="block text-sm font-semibold text-late">
            {tx("Toca para ver los saldos perdonados.", "Tap to see the forgiven balances.")}
          </Link>
        </Fold>
      </div>

      <WorkNest
        weekAmount={data ? money(data.totals.completedWeek) : "—"}
        monthAmount={data ? money(data.totals.completedMonth) : "—"}
        yearAmount={data ? money(data.totals.completedYear) : "—"}
        weekCuts={data?.totals.cutsWeek ?? 0}
        monthCuts={data?.totals.cutsMonth ?? 0}
        yearCuts={data?.totals.cutsYear ?? 0}
        current={view}
      />

      {paying && (
        <PayDialog
          open
          mode={paying.mode}
          clientId={paying.client.id}
          name={paying.client.name}
          balance={paying.client.balance}
          credit={paying.client.credit}
          onClose={() => setPaying(null)}
        />
      )}

      {q.isLoading && <div id="lista" className="h-28 animate-pulse rounded-xl bg-surface-2" />}

      <div id="lista" className="scroll-mt-20">
        {view !== "owing" ? (
          <div className="mb-3">
            <DensityToggle />
          </div>
        ) : null}
        {view === "owing" && data && owing.length === 0 && (
          <div className="rounded-xl bg-sun px-5 py-8 text-center">
            <p className="font-display text-lg font-semibold">{tx("Nadie debe nada", "Nobody owes anything")}</p>
            <p className="mt-1 text-sm text-muted">
              {tx("El saldo sube cuando marcas un corte como hecho, salvo si paga el mismo día.", "The balance goes up when you mark a cut as done, unless they pay the same day.")}
            </p>
          </div>
        )}

        {view === "owing" && owing.length > 0 && (
          <>
            <div className="mb-3 grid gap-2">
              <DensityToggle />
              <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                value={sort}
                onChange={(e) => setSort(e.target.value as OwingSort)}
                className="max-w-xs"
              >
                <option value="amount">{tx("Mayor saldo", "Highest balance")}</option>
                <option value="name">{tx("Nombre A–Z", "Name A–Z")}</option>
                <option value="cut">{tx("Último corte", "Latest cut")}</option>
                <option value="late">{tx("Pago atrasado primero", "Late payment first")}</option>
              </NativeSelect>
              {picked.length > 0 ? (
                <p className="text-sm font-medium">{tx(`${picked.length} elegidos`, `${picked.length} selected`)}</p>
              ) : (
                <p className="text-xs text-muted">{tx("Marca varios si pagan juntos", "Select several if they pay together")}</p>
              )}
              </div>
            </div>
            {picked.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Button onClick={() => setAskBulk("paid")}>{tx("Cobrar elegidos", "Collect selected")}</Button>
                <Button variant="outline" onClick={() => setAskBulk("waived")}>
                  {tx("Perdonar elegidos", "Forgive selected")}
                </Button>
              </div>
            )}
            <ul className={viewGrid(density, cols, dense ? "gap-1" : "gap-2")}>
              {owing.map((c) => {
                const late = isPaymentLate(c.payDueDay, today, c.balance);
                const on = picked.includes(c.id);
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "min-w-0 max-w-full overflow-hidden rounded-xl border-l-4 bg-surface shadow-card",
                      quad ? meshFrame(cols) : dense ? "px-2 py-1.5" : media ? "px-2.5 py-2" : "px-3 py-3",
                      late ? "border-late" : c.highRisk || c.payTier === "espera" ? "border-hold" : "border-due",
                    )}
                  >
                    {quad ? (
                      <div className="flex h-full min-w-0 flex-col overflow-hidden">
                        <Link to="/clientes/$id" params={{ id: String(c.id) }} className="min-w-0">
                          <MeshName name={c.name} cols={cols} />
                        </Link>
                        <span className={cn("truncate font-semibold tabular-nums text-due", cols === 4 ? "text-[11px]" : "text-xs")}>{money(c.balance)}</span>
                        {cols < 4 ? (
                          <p className="truncate text-[11px] text-muted">
                            {c.lastCutDate ? tx(`Corte ${formatDay(c.lastCutDate, "d MMM")}`, `Cut ${formatDay(c.lastCutDate, "d MMM")}`) : tx("Sin corte hecho", "No cut done")}
                            {c.payDueDay ? ` · ${payDueLabel(c.payDueDay)}` : ""}
                            {late ? tx(" · atrasado", " · late") : ""}
                            {c.payTier === "espera" ? tx(" · en espera", " · waiting") : ""}
                          </p>
                        ) : null}
                        {cols === 2 ? (
                          <Button size="sm" className="mt-auto h-8 px-1 text-[11px]" onClick={() => setPaying({ client: c, mode: "full" })}>
                            {tx("Pagado", "Paid")}
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                    <>
                    <div className={cn("flex min-w-0 items-center gap-2", dense || media ? "" : "items-start")}>
                      <label className={cn("grid shrink-0 place-items-center", dense ? "size-8" : "size-11")}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(c.id)}
                          className="size-5 accent-primary"
                          aria-label={tx(`Elegir ${c.name}`, `Select ${c.name}`)}
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Link
                            to="/clientes/$id"
                            params={{ id: String(c.id) }}
                            className={cn(
                              "min-w-0 flex-1 truncate font-semibold leading-snug",
                              dense ? "text-sm" : "font-display text-base",
                            )}
                          >
                            {c.name}
                          </Link>
                          {media ? (
                            <div className="flex shrink-0 gap-1">
                              <Button size="sm" className="h-8 px-2 text-xs" onClick={() => setPaying({ client: c, mode: "full" })}>
                                {tx("Pagado", "Paid")}
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setPaying({ client: c, mode: "abono" })}>
                                {tx("Abono", "Partial")}
                              </Button>
                            </div>
                          ) : null}
                          {dense ? (
                            <Button size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={() => setPaying({ client: c, mode: "full" })}>
                              {tx("Pagado", "Paid")}
                            </Button>
                          ) : null}
                          <p className={cn("shrink-0 font-display font-semibold tabular-nums text-due", dense ? "text-sm" : "text-lg")}>
                            {money(c.balance)}
                          </p>
                        </div>
                        {!dense && !quad ? (
                          <p className="truncate text-xs text-muted">
                            {c.lastCutDate ? tx(`Corte ${formatDay(c.lastCutDate, "d MMM")}`, `Cut ${formatDay(c.lastCutDate, "d MMM")}`) : tx("Sin corte hecho", "No cut done")}
                            {c.payDueDay ? ` · ${payDueLabel(c.payDueDay)}` : ""}
                            {late ? tx(" · atrasado", " · late") : ""}
                            {c.servicePaused ? tx(" · en pausa", " · paused") : ""}
                            {!c.isActive ? tx(" · archivado", " · archived") : ""}
                            {c.payTier === "espera" ? tx(" · en espera", " · waiting") : ""}
                            {c.highRisk ? tx(" · alto riesgo", " · high risk") : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {!dense && !media ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 pl-12">
                        <Button size="sm" onClick={() => setPaying({ client: c, mode: "full" })}>
                          {tx("Pagado", "Paid")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPaying({ client: c, mode: "abono" })}>
                          {tx("Abono", "Partial")}
                        </Button>
                        <Waive client={c} />
                        <ServicePause id={c.id} name={c.name} paused={c.servicePaused} />
                      </div>
                    ) : null}
                    {media ? (
                      <div className="mt-2 flex items-center pl-11">
                        <ServicePause id={c.id} name={c.name} paused={c.servicePaused} />
                      </div>
                    ) : null}
                    </>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {view === "collectedWeek" && (
          <PayList payments={paidWeek} empty={tx("Todavía no hay cobros esta semana.", "There are no payments this week yet.")} dense={dense} media={media} quad={quad} cols={cols} />
        )}
        {view === "collectedMonth" && (
          <PayList payments={paidMonth} empty={tx("Todavía no hay cobros este mes.", "There are no payments this month yet.")} dense={dense} media={media} quad={quad} cols={cols} />
        )}
        {view === "collectedYear" && (
          <PayList payments={paid} empty={tx("Todavía no hay cobros este año.", "There are no payments this year yet.")} dense={dense} media={media} quad={quad} cols={cols} />
        )}
        {view === "abonos" && (
          <AbonoFollow clients={abonoClients} payments={abonoPays} dense={dense} media={media} quad={quad} cols={cols} />
        )}
        {view === "waived" && (
          <PayList payments={waivedMonth} empty={tx("No hay saldos perdonados este mes.", "There are no forgiven balances this month.")} dense={dense} media={media} quad={quad} cols={cols} />
        )}
        {view === "espera" && (
          <WaitList
            clients={(data?.clients ?? []).filter((c) => inEspera(c))}
            dense={dense}
            media={media}
            quad={quad}
            cols={cols}
          />
        )}
        {view === "doneWeek" && (
          <DoneList jobs={data?.doneWeek ?? []} empty={tx("Todavía no hay cortes hechos esta semana.", "There are no completed cuts this week yet.")} dense={dense} media={media} quad={quad} cols={cols} />
        )}
        {view === "doneMonth" && (
          <DoneList jobs={data?.doneMonth ?? []} empty={tx("Todavía no hay cortes hechos este mes.", "There are no completed cuts this month yet.")} dense={dense} media={media} quad={quad} cols={cols} />
        )}
        {view === "doneYear" && (
          <DoneList jobs={data?.doneYear ?? []} empty={tx("Todavía no hay cortes hechos este año.", "There are no completed cuts this year yet.")} dense={dense} media={media} quad={quad} cols={cols} />
        )}
      </div>

      <ConfirmDialog
        open={askBulk === "paid"}
        title={tx(`¿Cobrar ${picked.length} clientes?`, `Collect from ${picked.length} clients?`)}
        description={tx("Se registra el saldo completo de cada uno como pagado.", "Each one's full balance is recorded as paid.")}
        confirmLabel={tx("Sí, cobrados", "Yes, collected")}
        pending={bulk.isPending}
        onConfirm={() => bulk.mutate("paid")}
        onCancel={() => setAskBulk(null)}
      />
      <ConfirmDialog
        open={askBulk === "waived"}
        title={tx(`¿Cancelar ${picked.length} saldos?`, `Cancel ${picked.length} balances?`)}
        description={tx("No se cuenta como cobrado.", "It is not counted as collected.")}
        confirmLabel={tx("Cancelar saldos", "Cancel balances")}
        danger
        pending={bulk.isPending}
        onConfirm={() => bulk.mutate("waived")}
        onCancel={() => setAskBulk(null)}
      />
    </AppShell>
  );
}

function CollectedNest({
  week,
  month,
  year,
  active,
  current,
}: {
  week: string;
  month: string;
  year: string;
  active: boolean;
  current: CobrosView;
}) {
  const tx = useTx();
  return (
    <div
      className={cn(
        "bz-stat bz-stat-done bz-stat-nest rounded-xl border-l-4 bg-done-bg p-2.5",
        active && "bz-stat-on",
      )}
    >
      <p className="bz-stat-label flex items-center gap-1 px-1 text-xs font-medium tracking-wide text-muted uppercase">
        {tx("Cobrado", "Collected")}
        <Hint topic="cobrado" />
      </p>
      <NestRow view="collectedWeek" label={tx("Semana", "Week")} value={week} active={current === "collectedWeek"} wash />
      <NestRow view="collectedMonth" label={tx("Mes", "Month")} value={month} active={current === "collectedMonth"} wash />
      <NestRow view="collectedYear" label={tx("Año", "Year")} value={year} active={current === "collectedYear"} wash />
    </div>
  );
}

function WorkNest({
  weekAmount,
  monthAmount,
  yearAmount,
  weekCuts,
  monthCuts,
  yearCuts,
  current,
}: {
  weekAmount: string;
  monthAmount: string;
  yearAmount: string;
  weekCuts: number;
  monthCuts: number;
  yearCuts: number;
  current: CobrosView;
}) {
  const tx = useTx();
  return (
    <Fold
      id="cob-hecho"
      group="cobros"
      className="bz-fold-toned mb-2 bg-soil-bg [--fold-tone:var(--color-soil)]"
      title={
        <span className="min-w-0 truncate">
          {tx("Trabajo ya hecho", "Work already done")}
        </span>
      }
      hint={
        <Hint topic="trabajo-hecho" />
      }
    >
      <NestRow
        view="doneWeek"
        label={tx("Semana", "Week")}
        value={
          <>
            <span className="bz-row-sub">{weekCuts} {weekCuts === 1 ? tx("corte", "cut") : tx("cortes", "cuts")}</span>
            <span className="bz-row-amt">{weekAmount}</span>
          </>
        }
        active={current === "doneWeek"}
        muted
      />
      <NestRow
        view="doneMonth"
        label={tx("Mes", "Month")}
        value={
          <>
            <span className="bz-row-sub">{monthCuts} {monthCuts === 1 ? tx("corte", "cut") : tx("cortes", "cuts")}</span>
            <span className="bz-row-amt">{monthAmount}</span>
          </>
        }
        active={current === "doneMonth"}
        muted
      />
      <NestRow
        view="doneYear"
        label={tx("Año", "Year")}
        value={
          <>
            <span className="bz-row-sub">{yearCuts} {yearCuts === 1 ? tx("corte", "cut") : tx("cortes", "cuts")}</span>
            <span className="bz-row-amt">{yearAmount}</span>
          </>
        }
        active={current === "doneYear"}
        muted
      />
    </Fold>
  );
}

function NestRow({
  view,
  label,
  value,
  active,
  muted,
  wash,
}: {
  view: CobrosView;
  label: string;
  value: ReactNode;
  active?: boolean;
  muted?: boolean;
  wash?: boolean;
}) {
  return (
    <Link
      to="/cobros"
      search={{ view }}
      hash="lista"
      className={cn(
        "bz-row mt-1 flex min-h-11 items-center justify-between rounded-sm px-2 py-1 touch-manipulation",
        active && (wash ? "bz-row-on bz-row-on-wash" : "bz-row-on"),
        active && wash && "nest-on",
        active && !wash && !muted && "bg-surface",
        active && muted && "bg-[color-mix(in_srgb,var(--color-soil-bg)_42%,var(--color-surface))]",
        !active && wash && "nest-wash",
        !active && !wash && "hover:bg-surface/60",
      )}
    >
      <span className={cn("text-sm font-semibold", muted && "text-soil")}>{label}</span>
      <span className="bz-row-val font-display text-sm font-semibold tabular-nums">{value}</span>
    </Link>
  );
}

function StatLink({
  view,
  label,
  value,
  sub,
  hint,
  tone,
  active,
  compact,
}: {
  view: CobrosView;
  label: string;
  value: string;
  sub?: string;
  hint: string;
  tone: "due" | "late" | "hold";
  active?: boolean;
  compact?: boolean;
}) {
  const tones = {
    due: "border-l-4 border-due bg-due-bg",
    late: "border-l-4 border-late bg-late-bg",
    hold: "border-l-4 border-hold bg-hold-bg",
  };
  return (
    <div
      className={cn(
        "relative min-w-0 rounded-xl p-3 text-left shadow-card transition-shadow",
        compact ? "min-h-16" : "min-h-24",
        tones[tone],
        active && "ring-4 ring-due ring-offset-2 ring-offset-bg",
      )}
    >
      <p className="flex items-center gap-1 text-xs font-medium tracking-wide text-muted uppercase">
        {label}
        <Hint text={hint} />
      </p>
      <Link to="/cobros" search={{ view }} hash="lista" className="mt-1 block min-h-10 touch-manipulation">
        <p
          className={cn(
            "font-display font-semibold tabular-nums",
            compact ? "text-lg" : "text-xl sm:text-2xl",
            tone === "due" && "text-due",
            tone === "late" && "text-late",
            tone === "hold" && "text-hold",
          )}
        >
          {value}
        </p>
        {sub ? <p className="text-sm font-semibold text-fg">{sub}</p> : null}
      </Link>
    </div>
  );
}

function AbonoFollow({
  clients,
  payments,
  dense,
  media,
  quad,
  cols,
}: {
  clients: ClientRow[];
  payments: PaymentRow[];
  dense?: boolean;
  media?: boolean;
  quad?: boolean;
  cols?: 2 | 3 | 4;
}) {
  const tx = useTx();
  if (clients.length === 0) {
    return (
      <p className="rounded-xl bg-sun px-4 py-5 text-sm text-muted">
        {tx(
          "Nadie con un abono pendiente. Si pagan toda la deuda, salen de aquí.",
          "Nobody with a partial still open. If they pay the whole debt, they leave this list.",
        )}
      </p>
    );
  }
  return (
    <ul className={viewGrid(quad ? "quad" : dense ? "dense" : media ? "compact" : "full", cols ?? 2, dense ? "gap-1" : "gap-2")}>
      {clients.map((c) => {
        const paid = payments.filter((p) => p.clientId === c.id).reduce((sum, p) => sum + p.amount, 0);
        return (
          <li
            key={c.id}
            className={cn("min-w-0 overflow-hidden rounded-xl border-l-4 border-due bg-surface shadow-card", quad ? meshFrame(cols ?? 2) : dense ? "px-2 py-1.5" : media ? "px-2.5 py-2" : "px-3 py-3")}
          >
            <Link to="/clientes/$id" params={{ id: String(c.id) }} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="min-w-0">{quad ? <MeshName name={c.name} cols={cols ?? 2} /> : <span className={cn("block truncate font-semibold", dense ? "text-xs" : "text-base")}>{c.name}</span>}</span>
                {!dense && (!quad || (cols ?? 2) < 4) ? (
                  <span className="block truncate text-[11px] text-muted">
                    {tx(`Abonado ${money(paid)} • Debe ${money(c.balance)}`, `Partial ${money(paid)} • Owes ${money(c.balance)}`)}
                  </span>
                ) : null}
              </span>
              <span className={cn("shrink-0 font-semibold tabular-nums text-due", dense || quad ? "text-xs" : "text-base")}>
                {money(c.balance)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function PayList({
  payments,
  empty,
  dense,
  media,
  quad,
  cols,
  grouped,
}: {
  payments: PaymentRow[];
  empty: string;
  dense?: boolean;
  media?: boolean;
  quad?: boolean;
  cols?: 2 | 3 | 4;
  grouped?: boolean;
}) {
  const tx = useTx();
  const rows = grouped
    ? [...payments.reduce((map, p) => {
        const cur = map.get(p.clientId);
        if (!cur) {
          map.set(p.clientId, { ...p, amount: p.amount });
        } else {
          cur.amount = Math.round((cur.amount + p.amount) * 100) / 100;
          if (p.paidAt > cur.paidAt) {
            cur.paidAt = p.paidAt;
            cur.method = p.method ?? cur.method;
          }
        }
        return map;
      }, new Map<number, PaymentRow>()).values()]
    : payments;
  if (rows.length === 0) {
    return <p className="rounded-xl bg-sun px-4 py-5 text-sm text-muted">{empty}</p>;
  }
  return (
    <ul className={viewGrid(quad ? "quad" : dense ? "dense" : media ? "compact" : "full", cols ?? 2, dense ? "gap-1" : "gap-2")}>
      {rows.map((p) => (
        <li
          key={grouped ? p.clientId : p.id}
          className={cn("min-w-0 overflow-hidden rounded-xl bg-surface shadow-card", quad ? meshFrame(cols ?? 2) : dense ? "px-2 py-1.5" : media ? "px-2.5 py-2" : "px-3 py-3")}
        >
          <div className={cn(quad ? "grid gap-1" : "flex items-start justify-between gap-2")}>
            <div className="min-w-0">
              <Link to="/clientes/$id" params={{ id: String(p.clientId) }} className="min-w-0">
                {quad ? <MeshName name={p.clientName ?? tx("Cliente", "Client")} cols={cols ?? 2} /> : <span className={cn("block truncate font-semibold", dense ? "text-xs" : "text-base")}>{p.clientName ?? tx("Cliente", "Client")}</span>}
              </Link>
              {!dense && (!quad || (cols ?? 2) < 4) ? (
                <p className="truncate text-[11px] text-muted">
                  {formatDay(p.paidAt.slice(0, 10), "EEE d MMM")}
                  {" · "}
                  {p.kind === "waived" ? tx("Perdonado", "Forgiven") : tx("Cobrado", "Collected")}
                  {methodLabel(p.method) ? ` · ${methodLabel(p.method)}` : ""}
                </p>
              ) : null}
            </div>
              <p className={cn("shrink-0 font-semibold tabular-nums", dense || quad ? "text-xs" : "text-base")}>
                {p.amount === 0 && (p.tip ?? 0) > 0 ? money(p.tip ?? 0) : money(p.amount)}
              </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function inEspera(c: ClientRow) {
  return c.payTier === "espera" || c.payTier === "serio" || c.servicePaused;
}

function WaitList({
  clients,
  dense,
  media,
  quad,
  cols,
}: {
  clients: ClientRow[];
  dense?: boolean;
  media?: boolean;
  quad?: boolean;
  cols?: 2 | 3 | 4;
}) {
  const tx = useTx();
  if (clients.length === 0) {
    return (
      <p className="rounded-xl bg-sun px-4 py-5 text-sm text-muted">
        {emphasize(tx("En espera está vacía. El dinero sin pagar sigue en Por cobrar.", "Waiting is empty. Unpaid money stays in To collect."))}
      </p>
    );
  }
  return (
    <ul className={viewGrid(quad ? "quad" : dense ? "dense" : media ? "compact" : "full", cols ?? 2, dense ? "gap-1" : "gap-2")}>
      {clients.map((c) => (
        <li
          key={c.id}
          className={cn(
            "min-w-0 overflow-hidden rounded-xl border-l-4 bg-surface shadow-card",
            c.servicePaused || c.highRisk ? "border-hold bg-hold-bg" : "border-pending",
            quad ? meshFrame(cols ?? 2) : dense ? "px-2 py-1.5" : media ? "px-2.5 py-2" : "px-3 py-3",
          )}
        >
          <Link to="/clientes/$id" params={{ id: String(c.id) }} className={cn(quad ? "block min-w-0" : "flex items-start justify-between gap-2")}>
            {quad ? <MeshName name={c.name} cols={cols ?? 2} /> : <span className={cn("min-w-0 truncate font-semibold", dense ? "text-xs" : "text-base")}>{c.name}</span>}
            <span className={cn("shrink-0 font-semibold tabular-nums text-hold", dense || quad ? "text-xs" : "text-base")}>
              {money(c.balance)}
            </span>
          </Link>
          {!dense && (!quad || (cols ?? 2) < 4) ? (
            <p className="mt-0.5 truncate text-[11px] text-muted">
              {emphasize(
                c.servicePaused
                  ? tx("En pausa · sin cortes hasta Continuar", "Paused · no cuts until Play")
                  : c.highRisk
                    ? tx("Espera seria · Alto riesgo", "Serious wait · High risk")
                    : tx("En espera", "Waiting"),
              )}
              {c.daysSincePay != null ? tx(` · ${c.daysSincePay} días sin pagar`, ` · ${c.daysSincePay} days unpaid`) : ""}
              {tx(` · fiabilidad ${c.reliability}`, ` · reliability ${c.reliability}`)}
            </p>
          ) : null}
          {!quad && !dense ? (
            <div className="mt-1">
              <ServicePause id={c.id} name={c.name} paused={c.servicePaused} />
            </div>
          ) : null}
          {!dense && (!quad || (cols ?? 2) < 4) ? (
            <ContactIcons
              phone={c.phone}
              address={c.address}
              name={c.name}
              tight={Boolean(media || quad)}
              variant={quad ? "some" : "all"}
              className="mt-1"
            />
          ) : null}
          {!dense && !media && !quad ? (
            <div className="mt-2 grid gap-1 text-sm">
              {c.cue ? <p>{c.cue}</p> : null}
              <p className="text-xs text-muted">
                {c.payDueDay ? payDueLabel(c.payDueDay) : tx("Sin día fijo de pago", "No fixed pay day")}
                {c.lastCutDate
                  ? tx(` · último corte ${formatDay(c.lastCutDate, "d MMM")}`, ` · last cut ${formatDay(c.lastCutDate, "d MMM")}`)
                  : tx(" · sin corte hecho", " · no cut done")}
                {c.paySameDay ? tx(" · paga el mismo día", " · pays the same day") : ""}
              </p>
              {c.notes ? <p className="line-clamp-2 text-xs text-muted">{c.notes}</p> : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function DoneList({
  jobs,
  empty,
  dense,
  media,
  quad,
  cols,
}: {
  jobs: JobRow[];
  empty: string;
  dense?: boolean;
  media?: boolean;
  quad?: boolean;
  cols?: 2 | 3 | 4;
}) {
  const tx = useTx();
  if (jobs.length === 0) {
    return <p className="rounded-xl bg-sun px-4 py-5 text-sm text-muted">{empty}</p>;
  }
  return (
    <ul className={viewGrid(quad ? "quad" : dense ? "dense" : media ? "compact" : "full", cols ?? 2, dense ? "gap-1" : "gap-2")}>
      {jobs.map((j) => {
        const kind = j.kind === "extra" ? tx("Extra", "Extra") : j.kind === "one_time" ? tx("Una vez", "One time") : tx("Corte", "Cut");
        return (
          <li
            key={j.id}
            className={cn("min-w-0 overflow-hidden rounded-xl bg-surface shadow-card", quad ? meshFrame(cols ?? 2) : dense ? "px-2 py-1.5" : media ? "px-2.5 py-2" : "px-3 py-3")}
          >
            <div className={cn(quad ? "grid gap-1" : "flex items-start justify-between gap-2")}>
              <div className="min-w-0">
                <Link to="/clientes/$id" params={{ id: String(j.clientId) }} className="min-w-0">
                  {quad ? <MeshName name={j.clientName} cols={cols ?? 2} /> : <span className={cn("block truncate font-semibold", dense ? "text-xs" : "text-base")}>{j.clientName}</span>}
                </Link>
                {!dense && (!quad || (cols ?? 2) < 4) ? (
                  <p className="truncate text-[11px] text-muted">
                    {formatDay(j.scheduledDate, "EEE d MMM")}
                    {j.title ? ` · ${j.title}` : ` · ${kind}`}
                    {j.paySameDay ? tx(" · cobrado al hacer", " · paid when done") : tx(" · puede quedar por cobrar", " · may stay to collect")}
                  </p>
                ) : null}
              </div>
              <p className={cn("shrink-0 font-semibold tabular-nums", dense || quad ? "text-xs" : "text-base")}>{money(j.amount)}</p>
            </div>
            {!dense && (!quad || (cols ?? 2) < 4) ? (
              <ContactIcons
                phone={j.clientPhone}
                address={j.clientAddress}
                name={j.clientName}
                tight={Boolean(media || quad)}
                variant={quad ? "some" : "all"}
                className="mt-1"
              />
            ) : null}
            {!dense && !media && !quad ? (
              <div className="mt-2 grid gap-1 text-sm">
                {j.clientCue ? <p>{j.clientCue}</p> : null}
                <p className="text-xs text-muted">
                  {j.arrivalTime ? tx(`Llegada ${formatTime(j.arrivalTime)}`, `Arrival ${formatTime(j.arrivalTime)}`) : tx("Sin hora de llegada", "No arrival time")}
                  {j.notes ? ` · ${j.notes}` : ""}
                </p>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function Waive({ client }: { client: ClientRow }) {
  const tx = useTx();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const mut = useMutation({
    mutationFn: () => recordPayment({ data: { clientId: client.id, kind: "waived" } }),
    onSuccess: async () => {
      toast(tx("Saldo perdonado. Ya no está por cobrar.", "Balance forgiven. It is no longer in To collect."));
      setOpen(false);
      await invalidateLawn(qc);
    },
  });
  return (
    <>
      <Button variant="outline" size="sm" disabled={mut.isPending} onClick={() => setOpen(true)}>
        {tx("Perdonar", "Forgive")}
      </Button>
      <ConfirmDialog
        open={open}
        title={tx(`¿Perdonar ${money(client.balance)} de ${client.name}?`, `Forgive ${money(client.balance)} from ${client.name}?`)}
        description={tx("Esto sí sale de Por cobrar. No es una espera: es dinero que decides no cobrar.", "This does leave To collect. It is not a wait: it is money you decide not to collect.")}
        confirmLabel={tx("Perdonar saldo", "Forgive balance")}
        danger
        pending={mut.isPending}
        onConfirm={() => mut.mutate()}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
