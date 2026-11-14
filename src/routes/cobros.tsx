import { WideSplit } from "@/components/wide-layout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode, useRef } from "react";
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
  payDueISO,
  lastDayOfMonthISO,
  monthParts,
  stampDay,
  startOfWeekISO,
  todayISO,
} from "@/lib/dates";
import { FREQ_SEP, formatDay, formatTime, money, payDueLabel } from "@/lib/format";
import { MeshNameUniform } from "@/components/mesh-name";
import { FitLine } from "@/components/job-card";
import { viewGrid } from "@/lib/density";
import type { QuadCols } from "@/lib/density";
import { emphasize, useTx } from "@/lib/i18n";
import { useUndo } from "@/lib/undo";
import { listBalances, recordPayment, recordPaymentsBulk, undoPayment } from "@/lib/server/lawn";
import type { ClientRow, JobRow, PaymentRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Banknote, BadgeCheck, Check, ReceiptText, Smartphone, Coins, HandCoins, HandHeart, ShieldAlert, Hourglass, CircleAlert, Wallet } from "lucide-react";
import { DayNightSwitch } from "@/components/day-night-switch";
import { WeatherChip } from "@/components/weather-chip";

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

  // Switching views never jumps: no router reset, no hash jump. The list is brought into view
  // only when it is not already there, and the header keeps its state while we glide.
  const firstView = useRef(true);
  useEffect(() => {
    const fromOutside = firstView.current;
    firstView.current = false;
    if (!viewParam) return;
    const run = () => {
      const list = document.getElementById("lista");
      if (!list) return;
      const header = document.querySelector<HTMLElement>(".pod-header");
      const headerShown = header && !header.classList.contains("is-away") && !header.style.transform;
      const offset = (headerShown ? header.offsetHeight : 0) + 8;
      const top = list.getBoundingClientRect().top;
      const delta = top - offset;
      const visible = top >= offset - 2 && top < window.innerHeight - 160;
      if (!fromOutside && visible) return;
      if (Math.abs(delta) < 4) return;
      const root = document.documentElement;
      root.dataset.bzQuiet = "1";
      window.scrollTo({ top: window.scrollY + delta, behavior: fromOutside ? "auto" : "smooth" });
      let still = 0;
      let lastY = -1;
      const settle = () => {
        if (window.scrollY === lastY) still += 1;
        else still = 0;
        lastY = window.scrollY;
        if (still >= 4) delete root.dataset.bzQuiet;
        else requestAnimationFrame(settle);
      };
      requestAnimationFrame(settle);
    };
    requestAnimationFrame(run);
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
  const push = useUndo((s) => s.push);
  const bulk = useMutation({
    mutationFn: (kind: "paid" | "waived") => recordPaymentsBulk({ data: { clientIds: picked, kind } }),
    onSuccess: async (res, kind) => {
      // Hallazgo 1 (grupo): el cobro/perdón en grupo también se puede deshacer,
      // por tandas de 8 ids (el límite de undoPayment).
      const ids = res.paymentIds ?? [];
      const idsSnapshot = [...picked];
      if (ids.length > 0) {
        push({
          label:
            kind === "waived"
              ? tx(`Perdón en grupo (${res.count})`, `Group forgiveness (${res.count})`)
              : tx(`Cobro en grupo (${res.count})`, `Group collection (${res.count})`),
          undo: async () => {
            for (let i = 0; i < ids.length; i += 8) {
              await undoPayment({ data: { ids: ids.slice(i, i + 8) } });
            }
            await invalidateLawn(qc);
          },
          redo: async () => {
            await recordPaymentsBulk({ data: { clientIds: idsSnapshot, kind } });
            await invalidateLawn(qc);
          },
        });
      }
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

  // 1.5.69 (Oscar, vía el censo de la Presentación H-D2): las listas de Cobrado enseñan también los
  // adelantos — los totales de cabecera siempre los sumaron (paid + prepaid), pero la lista filtraba
  // solo 'paid', así que un adelanto (y el pago tardío de un cliente perdonado, que entra como
  // adelanto) subía el total sin fila que lo enseñara. Ahora lista y total cuentan lo mismo.
  const paid = (data?.payments ?? []).filter(
    (p) => (p.kind === "paid" || p.kind === "prepaid") && !((p.note ?? "") === "Propina" && p.amount === 0),
  );
  const abonoPays = (data?.payments ?? []).filter((p) => {
    if (!(p.note ?? "").toLowerCase().includes("abono")) return false;
    return owing.some((c) => c.id === p.clientId);
  });
  const abonoClients = owing.filter((c) => abonoPays.some((p) => p.clientId === c.id));
  const abonoSum = abonoPays.reduce((sum, p) => sum + p.amount, 0);
  const abonoPeople = abonoClients.length;
  const paidWeek = paid.filter((p) => {
    const d = stampDay(p.paidAt);
    return d >= weekStart && d <= weekEnd;
  });
  const paidMonth = paid.filter((p) => {
    const d = stampDay(p.paidAt);
    return d >= monthStart && d <= monthEnd;
  });
  const waivedMonth = (data?.payments ?? []).filter((p) => {
    const d = stampDay(p.paidAt);
    return p.kind === "waived" && d >= monthStart && d <= monthEnd;
  });

  return (
    <AppShell
      title={tx("Cobros", "Payments")}
      action={
        <span className="inline-flex items-center gap-3">
          {/* 1.5.15 (Oscar): the weather sits beside the day/night switch at EVERY width — he placed it
              there precisely because that spot is empty; the 1.4.99 narrow-phone hiding is retired. */}
          <WeatherChip />
          <span className="mr-2 grid w-10 shrink-0 place-items-center">
            <DayNightSwitch />
          </span>
        </span>
      }
    >
      <ScrollTop />
      <WideSplit
        side={
          <>
      <section className="bz-lenses relative mb-3 grid min-w-0 grid-cols-2 items-stretch gap-3">
        <div
          data-spot="por-cobrar"
          className={cn(
            "bz-stat bz-stat-due flex min-h-24 min-w-0 flex-col rounded-xl border-l-4 bg-due-bg p-3 text-left",
            (view === "owing" || view === "abonos") && "bz-stat-on",
          )}
        >
          <p className="bz-stat-label flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
            <Wallet className="size-4" />
            {tx("Por cobrar", "To collect")}
            <Hint topic="por-cobrar" />
          </p>
          <Link to="/cobros" search={{ view: "owing" }} resetScroll={false} className={cn("-mx-1 mt-1 block min-h-10 rounded-lg px-2 py-1.5 touch-manipulation", view === "owing" && "bz-due-on bg-surface/70")}>
            <p className="font-display text-lg font-semibold tabular-nums text-due sm:text-xl">
              {data ? money(data.totals.outstanding) : "—"}
            </p>
            {data ? (
              <p className="text-[13px] font-semibold text-fg">
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
              data-ref="abonos"
              data-present="cobros-abonado"
              search={{ view: "abonos" }}
              resetScroll={false}
              className={cn("-mx-1 block rounded-lg px-2 py-1.5 touch-manipulation", view === "abonos" && "bz-due-on bg-surface/70")}
            >
              <p className="font-display text-base font-semibold tabular-nums text-due">{data ? money(abonoSum) : "—"}</p>
              <p className="text-[13px] font-semibold text-fg">
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
          className="bz-fold-toned cob-espera bg-hold-bg [--fold-tone:var(--color-hold)]"
          title={
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="bz-fold-fit min-w-0">{tx("En espera", "Waiting")}</span>
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
          <Link to="/cobros" search={{ view: "espera" }} resetScroll={false} className="block text-sm font-semibold text-[color:var(--fold-ink)]">
            {tx("Siguen debiendo. Toca para verlos.", "They still owe. Tap to see them.")}
          </Link>
        </Fold>
        <Fold
          id="cob-perdonado"
          group="cobros"
          className="bz-fold-toned cob-perdon bg-late-bg [--fold-tone:var(--color-late)]"
          title={
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="bz-fold-fit min-w-0">{tx("Perdonado este mes", "Forgiven this month")}</span>
              <span className="bz-fold-badge">
                {data ? money(data.totals.waivedMonth) : "—"}
              </span>
            </span>
          }
          hint={
            <Hint topic="perdonado" />
          }
        >
          <Link to="/cobros" search={{ view: "waived" }} resetScroll={false} className="block text-sm font-semibold text-[color:var(--fold-ink)]">
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

          </>
        }
        sideLeft
        pinSideFolds
      >
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
                present="cobros-orden"
              >
                <option value="amount">{tx("Mayor saldo", "Highest balance")}</option>
                <option value="name">{tx("Nombre A–Z", "Name A–Z")}</option>
                <option value="cut">{tx("Último corte", "Latest cut")}</option>
                <option value="late">{tx("Pago atrasado primero", "Late payment first")}</option>
              </NativeSelect>
              {picked.length > 0 ? (
                <p className="text-sm font-medium">{tx(`${picked.length} elegidos`, `${picked.length} selected`)}</p>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                  {tx("Varios a la vez", "Several at once")}
                  <Hint compact topic="cobrar-varios" />
                </span>
              )}
              </div>
            </div>
            {picked.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Button onClick={() => setAskBulk("paid")}>{tx("Cobrar elegidos", "Collect selected")}</Button>
                <Button variant="outline" data-present="cobros-perdonar-elegidos" onClick={() => setAskBulk("waived")}>
                  {tx("Perdonar elegidos", "Forgive selected")}
                </Button>
              </div>
            )}
            <ul className={viewGrid(density, cols, dense ? "gap-1" : "gap-2")}>
              {owing.map((c) => {
                const late = isPaymentLate(c.payDueDay, today, c.balance);
                const on = picked.includes(c.id);
                if (!dense) {
                  return (
                    <OwingCard
                      key={c.id}
                      client={c}
                      late={late}
                      today={today}
                      on={on}
                      onToggle={() => toggle(c.id)}
                      onPay={(mode) => setPaying({ client: c, mode })}
                      mode={quad ? "quad" : media ? "media" : "grande"}
                      cols={cols}
                    />
                  );
                }
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "min-w-0 max-w-full overflow-hidden rounded-xl border-l-4 bg-surface shadow-card px-2 py-1.5",
                      late ? "border-late" : c.highRisk || c.payTier === "espera" ? "border-hold" : "border-due",
                    )}
                  >
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
                              "min-w-0 flex-1 font-semibold leading-snug [text-wrap:pretty]",
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
                          <p className="text-xs leading-snug text-muted [text-wrap:pretty]">
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
          <PayList payments={paid} more={Math.max(0, (data?.counts.paidYear ?? 0) - paid.length)} empty={tx("Todavía no hay cobros este año.", "There are no payments this year yet.")} dense={dense} media={media} quad={quad} cols={cols} />
        )}
        {view === "abonos" && (
          <AbonoFollow clients={abonoClients} payments={abonoPays} dense={dense} media={media} quad={quad} cols={cols} />
        )}
        {view === "waived" && (
          <PayList payments={waivedMonth} more={Math.max(0, (data?.counts.waivedMonth ?? 0) - waivedMonth.length)} empty={tx("No hay saldos perdonados este mes.", "There are no forgiven balances this month.")} dense={dense} media={media} quad={quad} cols={cols} />
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
          <DoneList jobs={data?.doneYear ?? []} more={Math.max(0, (data?.totals.cutsYear ?? 0) - (data?.doneYear.length ?? 0))} empty={tx("Todavía no hay cortes hechos este año.", "There are no completed cuts this year yet.")} dense={dense} media={media} quad={quad} cols={cols} />
        )}
      </div>
      </WideSplit>

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
        presentConfirm="cobros-grupo-confirmar"
        title={tx(
          picked.length === 1 ? "¿Perdonar 1 saldo?" : `¿Perdonar ${picked.length} saldos?`,
          picked.length === 1 ? "Forgive 1 balance?" : `Forgive ${picked.length} balances?`,
        )}
        description={tx("No se cuenta como cobrado.", "It is not counted as collected.")}
        confirmLabel={tx("Perdonar saldos", "Forgive balances")}
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
      data-spot="cobrado"
      className={cn(
        "bz-stat bz-stat-done bz-stat-nest rounded-xl border-l-4 bg-done-bg p-2.5",
        active && "bz-stat-on",
      )}
    >
      <p className="bz-stat-label flex items-center gap-1.5 px-1 text-xs font-medium tracking-wide text-muted uppercase">
        <BadgeCheck className="size-4" />
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
      className="bz-fold-toned cob-hecho mb-2 bg-soil-bg [--fold-tone:var(--color-soil)]"
      title={
        <span className="bz-fold-fit min-w-0">
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
      resetScroll={false}
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
      <Link to="/cobros" search={{ view }} resetScroll={false} className={cn("-mx-1 mt-1 block min-h-10 rounded-lg px-2 py-1.5 touch-manipulation", view === "owing" && "bz-due-on bg-surface/70")}>
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
            className={cn("min-w-0 overflow-hidden rounded-xl border-l-4 border-due bg-surface shadow-card", quad ? "bz-ccard is-quad w-full p-2" : dense ? "px-2 py-1.5" : media ? "px-2.5 py-2" : "px-3 py-3")}
          >
            <Link to="/clientes/$id" params={{ id: String(c.id) }} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="min-w-0">{quad ? <MeshNameUniform name={c.name} cols={cols ?? 2} /> : <span className={cn("block font-semibold", dense ? "text-xs" : "text-base")}>{c.name}</span>}</span>
                {!dense && (!quad || (cols ?? 2) < 4) ? (
                  <span className="block text-[11px] leading-snug text-muted [text-wrap:pretty]">
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
  more = 0,
}: {
  payments: PaymentRow[];
  empty: string;
  dense?: boolean;
  media?: boolean;
  quad?: boolean;
  cols?: 2 | 3 | 4;
  grouped?: boolean;
  /** Movimiento 3 (hallazgo 20): filas reales que la lista no trae (corte en 2500/año). */
  more?: number;
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
  const c = cols ?? 2;
  // 1.4.91 (Oscar): never "…". Cobrado lists already say "Cobrado", so the word is gone from every subline;
  // the method (or Perdonado / Propina) follows the date after the thin en dash used in Clientes and Hoy.
  // Grande = icon chip + big serif name + price beside it + long date + method chip; Media = one compact row
  // (name · price) over a short subline; Lista = one line; Malla x2 one subline, x3 date over method, x4 date.
  return (
    <>
    <ul className={viewGrid(quad ? "quad" : dense ? "dense" : media ? "compact" : "full", c, dense ? "gap-1" : "gap-2")}>
      {rows.map((p) => {
        const name = p.clientName ?? tx("Cliente", "Client");
        const day = stampDay(p.paidAt);
        const tipOnly = p.amount === 0 && (p.tip ?? 0) > 0;
        const amount = money(tipOnly ? (p.tip ?? 0) : p.amount);
        const how = p.kind === "waived"
          ? tx("Perdonado", "Forgiven")
          : tipOnly
            ? tx("Propina", "Tip")
            : p.kind === "prepaid"
              ? methodLabel(p.method)
                ? `${tx("Adelanto", "Advance")}${FREQ_SEP}${methodLabel(p.method)}`
                : tx("Adelanto", "Advance")
              : methodLabel(p.method);
        const kind = p.kind === "waived" ? "is-waived" : tipOnly ? "is-tip" : `is-${(p.method ?? "otro").split(":")[0]}`;
        const shortDay = formatDay(day, "EEE d MMM");
        const tinyDay = formatDay(day, "d MMM");
        const withHow = (d: string) => (how ? `${d}${FREQ_SEP}${how}` : d);
        const link = (size?: "grande" | "media") =>
          quad ? <MeshNameUniform name={name} cols={c} /> : <MeshNameUniform name={name} cols={2} size={size} fit />;
        const key = grouped ? p.clientId : p.id;
        if (quad) {
          return (
            <li key={key} className={cn("bz-pay min-w-0 overflow-hidden rounded-xl bg-surface shadow-card bz-ccard is-quad w-full", `is-c${c}`, kind)}>
              <Link to="/clientes/$id" params={{ id: String(p.clientId) }} className="bz-pay-q">
                {link()}
                {c === 2 ? <FitLine forms={[withHow(shortDay), withHow(tinyDay), tinyDay]} className="bz-pay-sub" /> : null}
                {c === 3 ? (
                  <span className="bz-pay-sub is-stack">
                    <span>{shortDay}</span>
                    {how ? <span className="bz-pay-how"><PayIcon kind={kind} />{how}</span> : null}
                  </span>
                ) : null}
                {c === 4 ? <span className="bz-pay-sub">{tinyDay}</span> : null}
                <span className="bz-pay-amt">{amount}</span>
              </Link>
            </li>
          );
        }
        if (dense) {
          return (
            <li key={key} className={cn("bz-pay min-w-0 overflow-hidden rounded-xl bg-surface shadow-card is-lista", kind)}>
              <Link to="/clientes/$id" params={{ id: String(p.clientId) }} className="bz-pay-row">
                <span className="bz-pay-name">{name}</span>
                <span className="bz-pay-sub">{tinyDay}</span>
                <span className="bz-pay-amt">{amount}</span>
              </Link>
            </li>
          );
        }
        if (media) {
          return (
            <li key={key} className={cn("bz-pay min-w-0 overflow-hidden rounded-xl bg-surface shadow-card is-media", kind)}>
              <Link to="/clientes/$id" params={{ id: String(p.clientId) }} className="block min-w-0">
                <span className="bz-pay-top" data-name-room>
                  {link("media")}
                  <span className="bz-pay-amt">{amount}</span>
                </span>
                <FitLine forms={[withHow(shortDay), withHow(tinyDay), tinyDay]} className="bz-pay-sub" />
              </Link>
            </li>
          );
        }
        return (
          <li key={key} className={cn("bz-pay min-w-0 overflow-hidden rounded-xl bg-surface shadow-card is-grande", kind)}>
            <Link to="/clientes/$id" params={{ id: String(p.clientId) }} className="bz-pay-g">
              <span className="bz-pay-ic" aria-hidden><PayIcon kind={kind} /></span>
              <span className="min-w-0 flex-1">
                <span className="bz-pay-top" data-name-room>
                  {link("grande")}
                  <span className="bz-pay-amt">{amount}</span>
                </span>
                <span className="bz-pay-line">
                  <FitLine forms={[tx(formatDay(day, "EEEE d 'de' MMMM"), formatDay(day, "EEEE, MMMM d")), tx(formatDay(day, "EEEE d MMM"), formatDay(day, "EEEE, MMM d")), shortDay]} className="bz-pay-sub min-w-0 flex-1" />
                  {how ? <span className="bz-pay-chip">{how}</span> : null}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
    {more > 0 ? (
      <p className="mt-2 px-1 text-sm text-muted">{tx(`+${more} más`, `+${more} more`)}</p>
    ) : null}
    </>
  );
}

function PayIcon({ kind }: { kind: string }) {
  if (kind === "is-waived") return <HandHeart />;
  if (kind === "is-tip") return <Coins />;
  if (kind === "is-efectivo") return <Banknote />;
  if (kind === "is-zelle") return <Smartphone />;
  if (kind === "is-cheque") return <ReceiptText />;
  return <BadgeCheck />;
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
            quad ? "bz-ccard is-quad w-full p-2" : dense ? "px-2 py-1.5" : media ? "px-2.5 py-2" : "px-3 py-3",
          )}
        >
          <Link to="/clientes/$id" params={{ id: String(c.id) }} className={cn(quad ? "block min-w-0" : "flex items-start justify-between gap-2")}>
            {quad ? <MeshNameUniform name={c.name} cols={cols ?? 2} /> : <span className={cn("min-w-0 font-semibold", dense ? "text-xs" : "text-base")}>{c.name}</span>}
            <span className={cn("shrink-0 font-semibold tabular-nums text-hold", dense || quad ? "text-xs" : "text-base")}>
              {money(c.balance)}
            </span>
          </Link>
          {!dense && (!quad || (cols ?? 2) < 4) ? (
            <p className="mt-0.5 text-[11px] leading-snug text-muted [text-wrap:pretty]">
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
  more = 0,
}: {
  jobs: JobRow[];
  empty: string;
  dense?: boolean;
  media?: boolean;
  quad?: boolean;
  cols?: 2 | 3 | 4;
  /** Movimiento 3 (hallazgo 20): hechos reales que la lista no trae (corte en 2500/año). */
  more?: number;
}) {
  const tx = useTx();
  if (jobs.length === 0) {
    return <p className="rounded-xl bg-sun px-4 py-5 text-sm text-muted">{empty}</p>;
  }
  return (
    <>
    <ul className={viewGrid(quad ? "quad" : dense ? "dense" : media ? "compact" : "full", cols ?? 2, dense ? "gap-1" : "gap-2")}>
      {jobs.map((j) => {
        const kind = j.kind === "extra" ? tx("Extra", "Extra") : j.kind === "one_time" ? tx("Una vez", "One time") : tx("Corte", "Cut");
        return (
          <li
            key={j.id}
            className={cn("min-w-0 overflow-hidden rounded-xl bg-surface shadow-card", quad ? "bz-ccard is-quad w-full p-2" : dense ? "px-2 py-1.5" : media ? "px-2.5 py-2" : "px-3 py-3")}
          >
            <div className={cn(quad ? "grid gap-1" : "flex items-start justify-between gap-2")}>
              <div className="min-w-0">
                <Link to="/clientes/$id" params={{ id: String(j.clientId) }} className="min-w-0">
                  {quad ? <MeshNameUniform name={j.clientName} cols={cols ?? 2} /> : <span className={cn("block font-semibold", dense ? "text-xs" : "text-base")}>{j.clientName}</span>}
                </Link>
                {!dense && (!quad || (cols ?? 2) < 4) ? (
                  <p className="text-[11px] leading-snug text-muted [text-wrap:pretty]">
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
    {more > 0 ? (
      <p className="mt-2 px-1 text-sm text-muted">{tx(`+${more} más`, `+${more} more`)}</p>
    ) : null}
    </>
  );
}

function Waive({ client, icon }: { client: ClientRow; icon?: boolean }) {
  const tx = useTx();
  const qc = useQueryClient();
  const push = useUndo((s) => s.push);
  const [open, setOpen] = useState(false);
  // Hallazgo 1: perdón PARCIAL — por defecto el saldo completo; lo que no se
  // perdona se queda debiendo. Y el perdón entra en Deshacer como un pago.
  const [amount, setAmount] = useState("");
  const amt = Math.min(client.balance, Math.max(0, Number(amount) || 0));
  const mut = useMutation({
    mutationFn: () =>
      recordPayment({
        data: { clientId: client.id, kind: "waived", amount: amt > 0 ? amt : undefined },
      }),
    onSuccess: async (res) => {
      const ids = res.paymentIds ?? [];
      if (ids.length > 0) {
        push({
          label: tx(`Perdón a ${client.name}`, `Forgiveness for ${client.name}`),
          undo: async () => {
            await undoPayment({ data: { ids } });
            await invalidateLawn(qc);
          },
          redo: async () => {
            await recordPayment({
              data: { clientId: client.id, kind: "waived", amount: amt > 0 ? amt : undefined },
            });
            await invalidateLawn(qc);
          },
        });
      }
      toast(tx("Saldo perdonado. Puedes deshacerlo arriba.", "Balance forgiven. You can undo it above."));
      setOpen(false);
      await invalidateLawn(qc);
    },
  });
  return (
    <>
      <button type="button" className={icon ? "bz-cact is-forgive is-icon" : "bz-cact is-forgive"} data-present="cobros-perdonar" disabled={mut.isPending} onClick={() => setOpen(true)} aria-label={icon ? tx(`Perdonar a ${client.name}`, `Forgive ${client.name}`) : undefined}>
        <HandHeart aria-hidden />
        {icon ? null : <span className="bz-cact-l">{tx("Perdonar", "Forgive")}</span>}
      </button>
      <ConfirmDialog
        open={open}
        presentConfirm="perdonar-confirmar"
        icon={<HandHeart />}
        iconTone="late"
        title={
          <>
            {tx("¿Perdonar a ", "Forgive ")}
            <span className="bz-dialog-who"><span className="bz-dialog-name is-heather">{client.name}</span>?</span>
          </>
        }
        aside={
          <>
            {tx("Debe", "Owes")} <b>{money(client.balance)}</b>
          </>
        }
        description={
          <div className="grid gap-2">
            <p>{tx("Esto sí sale de Por cobrar. No es una espera: es dinero que decides no cobrar.", "This does leave To collect. It is not a wait: it is money you decide not to collect.")}</p>
            <div>
              <label className="text-sm font-medium text-fg" htmlFor={`waive-amt-${client.id}`}>{tx("Cantidad a perdonar", "Amount to forgive")}</label>
              <input
                id={`waive-amt-${client.id}`}
                data-present="perdonar-cantidad"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-fg"
                placeholder={String(client.balance)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted">
                {amt > 0 && amt < client.balance
                  ? tx(`Perdón parcial: quedan debiendo ${money(client.balance - amt)}. Vacío = todo el saldo.`, `Partial forgiveness: ${money(client.balance - amt)} stays owed. Empty = the whole balance.`)
                  : tx("Vacío = todo el saldo.", "Empty = the whole balance.")}
              </p>
            </div>
          </div>
        }
        confirmLabel={tx("Perdonar saldo", "Forgive balance")}
        danger
        pending={mut.isPending}
        onConfirm={() => mut.mutate()}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

/** 1.4.78 (Oscar): a selection box with the .bz-pick look (tint, fine outline, inline check). */
function PickBox({ on, onToggle, label, className }: { on: boolean; onToggle: () => void; label: string; className?: string }) {
  return (
    <button type="button" role="checkbox" data-present="cobros-grupo" aria-checked={on} aria-label={label} onClick={onToggle} className={cn("bz-cpick", on && "is-on", className)}>
      <span className="bz-cpick-box">{on ? <Check aria-hidden /> : null}</span>
    </button>
  );
}

function lateDays(dueDay: number | null | undefined, today: string): number {
  if (!dueDay) return 0;
  const due = payDueISO(dueDay, today);
  return Math.max(0, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${due}T12:00:00Z`)) / 86400000));
}

/**
 * 1.4.78 (Oscar): Cobros debt card for Grande, Media and Malla. Name row = selection · name (one size for every
 * card, last name to line 2 when it must, never cut) · balance (unchanged look). Then the subline with the state
 * chips, then the actions: Pagado · Abono · Perdonar · Pausa. No buttons on the name row.
 */
function OwingCard({
  client: c,
  late,
  today,
  on,
  onToggle,
  onPay,
  mode,
  cols,
}: {
  client: ClientRow;
  late: boolean;
  today: string;
  on: boolean;
  onToggle: () => void;
  onPay: (mode: PayMode) => void;
  mode: "grande" | "media" | "quad";
  cols: QuadCols;
}) {
  const tx = useTx();
  const quad = mode === "quad";
  const days = late ? lateDays(c.payDueDay, today) : 0;
  const cut = c.lastCutDate ? tx(`Corte ${formatDay(c.lastCutDate, "d MMM")}`, `Cut ${formatDay(c.lastCutDate, "d MMM")}`) : tx("Sin corte hecho", "No cut done");
  const pays = c.payDueDay ? payDueLabel(c.payDueDay) : null;
  const paysShort = c.payDueDay ? tx(`Paga el ${c.payDueDay}`, `Pays on ${c.payDueDay}`) : null;
  const forms = [pays ? `${cut} · ${pays}` : cut, ...(paysShort ? [`${cut} · ${paysShort}`] : []), cut];
  const chips: React.ReactNode[] = [];
  if (late)
    chips.push(
      <span key="late" className="bz-state is-late is-xs bz-late-pulse">
        <CircleAlert aria-hidden />
        {quad && cols > 2 ? (days > 0 ? tx(`${days} d`, `${days} d`) : tx("Atrasado", "Late")) : days > 0 ? tx(`Atrasado · ${days} ${days === 1 ? "día" : "días"}`, `Late · ${days} ${days === 1 ? "day" : "days"}`) : tx("Atrasado", "Late")}
      </span>,
    );
  if (c.highRisk && !(quad && cols > 2))
    chips.push(
      <span key="risk" className="bz-state is-hold is-xs" data-present="cobros-riesgo">
        <ShieldAlert aria-hidden />
        {tx("Alto riesgo", "High risk")}
      </span>,
    );
  if (c.payTier === "espera" && !(quad && cols > 2))
    chips.push(
      <span key="wait" className="bz-state is-hold is-xs">
        <Hourglass aria-hidden />
        {tx("En espera", "Waiting")}
      </span>,
    );
  if (c.servicePaused && !quad)
    chips.push(
      <span key="pause" className="bz-state is-soil is-xs">
        {tx("En pausa", "Paused")}
      </span>,
    );
  if (!c.isActive && !quad)
    chips.push(
      <span key="arch" className="bz-state is-soil is-xs">
        {tx("Archivado", "Archived")}
      </span>,
    );
  const tone = late ? "border-late" : c.highRisk || c.payTier === "espera" ? "border-hold" : "border-due";
  const balance = (
    <p className={cn("bz-owe shrink-0 font-display font-semibold tabular-nums text-due", quad ? (cols === 4 ? "text-[12.5px]" : "text-[13.5px]") : "text-lg")}>{money(c.balance)}</p>
  );
  const pickLabel = tx(`Elegir ${c.name}`, `Select ${c.name}`);

  if (quad) {
    return (
      <li className={cn("bz-ocard bz-ccard is-quad relative min-w-0 overflow-hidden rounded-xl border-l-4 bg-surface shadow-card", `is-c${cols}`, tone, on && "is-picked")}>
        <PickBox on={on} onToggle={onToggle} label={pickLabel} className="bz-cpick-corner" />
        <div className="bz-cbody">
          <Link to="/clientes/$id" params={{ id: String(c.id) }} className="bz-ocard-name block min-w-0">
            <MeshNameUniform name={c.name} cols={cols} />
          </Link>
          {cols === 2 ? <FitLine forms={forms} className="bz-csub is-quad mt-0.5" /> : null}
          <div className="bz-cfoot">
            <div className="mt-1 flex min-w-0 items-center justify-between gap-1">
              {balance}
              {chips[0] ?? null}
            </div>
            {cols === 4 ? (
              <button type="button" className="bz-cact is-paid is-icon mt-1 w-full" onClick={() => onPay("full")} aria-label={tx(`Pagado: ${c.name}`, `Paid: ${c.name}`)}>
                <HandCoins aria-hidden />
              </button>
            ) : (
              <button type="button" className="bz-cact is-paid mt-1.5 w-full" onClick={() => onPay("full")}>
                <HandCoins aria-hidden />
                {tx("Pagado", "Paid")}
              </button>
            )}
          </div>
        </div>
      </li>
    );
  }

  if (mode === "media") {
    // 1.4.79 (Oscar: Media looked like Grande): half the height. Row 1 = pick · name · state · balance;
    // row 2 = cut date at the left, icon-only actions at the right.
    const lateChip = late ? (
      <span className="bz-state is-late is-xs bz-late-pulse" title={tx("Atrasado", "Late")}>
        <CircleAlert aria-hidden />
        {days > 0 ? tx(`${days} ${days === 1 ? "día" : "días"}`, `${days} ${days === 1 ? "day" : "days"}`) : tx("Atrasado", "Late")}
      </span>
    ) : c.highRisk ? (
      <span className="bz-state is-hold is-xs">
        <ShieldAlert aria-hidden />
        {tx("Riesgo", "Risk")}
      </span>
    ) : null;
    return (
      <li className={cn("bz-ocard bz-ccard is-media min-w-0 overflow-hidden rounded-xl border-l-4 bg-surface shadow-card px-3 py-2", tone, on && "is-picked")}>
        <div className="flex min-w-0 items-center gap-2">
          <PickBox on={on} onToggle={onToggle} label={pickLabel} />
          <Link to="/clientes/$id" params={{ id: String(c.id) }} className="min-w-0 flex-1">
            <MeshNameUniform name={c.name} cols={2} size="media" />
          </Link>
          {lateChip}
          {balance}
        </div>
        <div className="bz-ocard-mrow">
          <FitLine forms={[cut, c.lastCutDate ? formatDay(c.lastCutDate, "d MMM") : cut]} className="bz-csub is-media min-w-0 flex-1" />
          <div className="bz-ocard-icons">
            <button type="button" className="bz-cact is-paid is-icon is-sm" onClick={() => onPay("full")} aria-label={tx(`Pagado: ${c.name}`, `Paid: ${c.name}`)} title={tx("Pagado", "Paid")}>
              <HandCoins aria-hidden />
            </button>
            <button type="button" className="bz-cact is-abono is-icon is-sm" onClick={() => onPay("abono")} aria-label={tx(`Abono: ${c.name}`, `Partial: ${c.name}`)} title={tx("Abono", "Partial")}>
              <Coins aria-hidden />
            </button>
            <Waive client={c} icon />
            <ServicePause id={c.id} name={c.name} paused={c.servicePaused} noHint />
          </div>
        </div>
      </li>
    );
  }

  return (
    <li data-present="cobros-tarjeta" className={cn("bz-ocard bz-ccard min-w-0 overflow-hidden rounded-xl border-l-4 bg-surface shadow-card", "is-grande px-3.5 pt-3 pb-3.5", tone, on && "is-picked")}>
      <div className="flex min-w-0 items-start gap-2.5">
        <PickBox on={on} onToggle={onToggle} label={pickLabel} className="mt-0.5" />
        <Link to="/clientes/$id" params={{ id: String(c.id) }} className="min-w-0 flex-1">
          <MeshNameUniform name={c.name} cols={2} size="grande" />
        </Link>
        {balance}
      </div>
      <div className="bz-ocard-sub mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <FitLine forms={forms} className="bz-csub is-grande min-w-0 flex-[1_1_8rem]" />
        {chips.length ? <span className="ml-auto flex flex-wrap justify-end gap-1">{chips}</span> : null}
      </div>
      <div className="bz-ocard-acts mt-2.5">
        <button type="button" className="bz-cact is-paid" onClick={() => onPay("full")}>
          <HandCoins aria-hidden />
          {tx("Pagado", "Paid")}
        </button>
        <button type="button" className="bz-cact is-abono" onClick={() => onPay("abono")}>
          {tx("Abono", "Partial")}
        </button>
        <Waive client={c} />
        <ServicePause id={c.id} name={c.name} paused={c.servicePaused} />
      </div>
    </li>
  );
}
