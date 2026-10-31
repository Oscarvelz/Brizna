import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  ClientForm,
  DebtPresets,
  PricePresets,
  payloadFromForm,
  type ClientFormValue,
} from "@/components/client-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Hint } from "@/components/hint";
import { ScrollTop } from "@/components/scroll-top";
import { invalidateLawn } from "@/components/job-card";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { todayISO } from "@/lib/dates";
import { frequencyLabel, money, weekdayLabel } from "@/lib/format";
import { createClient, createClientsBulk, findDuplicateClients, addClientPhoto, getSettings } from "@/lib/server/lawn";
import { DEFAULT_DEBT_PRESETS, DEFAULT_PRICE_PRESETS } from "@/lib/types";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/nuevo")({ component: NuevoPage });

type BulkRow = {
  name: string;
  phone: string;
  address: string;
  pricePerCut: string;
  cutsPerMonth: number;
  startDate: string;
  paySameDay: boolean;
  openingBalance: string;
};

function NuevoPage() {
  const tx = useTx();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pendingValue, setPendingValue] = useState<ClientFormValue | null>(null);
  const [dupes, setDupes] = useState<{ id: number; name: string; phone: string | null }[]>([]);
  const [bulk, setBulk] = useState<BulkRow[] | null>(null);
  const [owing, setOwing] = useState<number[]>([]);
  const [sharedDebt, setSharedDebt] = useState("");
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [leaveAsk, setLeaveAsk] = useState(false);
  const skipPop = useRef(false);
  const nameDraftRef = useRef(nameDraft);
  const bulkRef = useRef(bulk);
  nameDraftRef.current = nameDraft;
  bulkRef.current = bulk;
  const settingsQ = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(),
  });
  const debtPresets = settingsQ.data?.debtPresets ?? DEFAULT_DEBT_PRESETS;
  const pricePresets = settingsQ.data?.pricePresets ?? DEFAULT_PRICE_PRESETS;
  const payHelp = tx(
    "Si la casilla está vacía, cada corte suma el precio a lo que debe. La deuda se acumula. Si la marcas, cobras al marcar Hecho y ese corte no se suma.",
    "If the box is empty, each cut adds the price to what they owe. The debt piles up. If you check it, you collect when you mark Done and that cut is not added.",
  );

  const mutation = useMutation({
    mutationFn: (value: ClientFormValue) => createClient({ data: payloadFromForm(value) }),
    onSuccess: async (res, value) => {
      for (const data of value.pendingPhotos) {
        await addClientPhoto({ data: { clientId: res.id, data } }).catch(() => undefined);
      }
      toast.success(tx("Cliente guardado", "Client saved"));
      setPendingValue(null);
      await invalidateLawn(qc);
      await navigate({ to: "/clientes/$id", params: { id: String(res.id) } });
    },
    onError: () => toast.error(tx("No se pudo guardar el cliente", "Could not save the client")),
  });

  const bulkMut = useMutation({
    mutationFn: (rows: BulkRow[]) =>
      createClientsBulk({
        data: {
          contacts: rows.map((r) => ({
            name: r.name,
            phone: r.phone,
            address: r.address,
            pricePerCut: Number(r.pricePerCut) || 30,
            cutsPerMonth: r.cutsPerMonth as 1 | 2 | 3 | 4 | 5,
            startDate: r.startDate,
            paySameDay: r.paySameDay,
            openingBalance: Number(r.openingBalance) || 0,
          })),
        },
      }),
    onSuccess: async (res) => {
      toast.success(tx(`${res.count} clientes añadidos`, `${res.count} clients added`));
      closeBulk();
      await invalidateLawn(qc);
      await navigate({ to: "/clientes" });
    },
    onError: () => toast.error(tx("No se pudieron guardar los contactos", "Could not save the contacts")),
  });

  const preview = pendingValue
    ? pendingValue.kind === "one_time"
      ? `${pendingValue.name} · ${pendingValue.oneTimeTitle || tx("Trabajo de una vez", "One-time job")} · ${money(Number(pendingValue.pricePerCut) || 0)} · ${pendingValue.oneTimeDate}`
      : `${pendingValue.name} · ${frequencyLabel(
          pendingValue.frequencyMode === "custom" ? 2 : Number(pendingValue.frequencyMode),
          {
            frequencyDays:
              pendingValue.frequencyMode === "custom"
                ? Number(pendingValue.frequencyDays) || 7
                : null,
          },
        )} · ${weekdayLabel(pendingValue.weekday)} · ${money(Number(pendingValue.pricePerCut) || 0)}`
    : "";
  const owed = Number(pendingValue?.openingBalance) || 0;
  const previewWithDebt = owed > 0 ? `${preview} · ${tx("Deuda anterior", "Earlier debt")} ${money(owed)}` : preview;

  function closeBulk() {
    setBulk(null);
    setOwing([]);
    setSharedDebt("");
  }

  function requestLeaveBulk() {
    setLeaveAsk(true);
  }

  function discardBulk() {
    setLeaveAsk(false);
    setNameDraft(null);
    closeBulk();
    if (typeof window !== "undefined" && window.history.state?.olsBulk) {
      skipPop.current = true;
      window.history.back();
    }
  }

  const inMulti = bulk != null || nameDraft != null;
  useEffect(() => {
    if (!inMulti) return;
    window.history.pushState({ ...(window.history.state ?? {}), olsBulk: 1 }, "");
    const onPop = () => {
      if (skipPop.current) {
        skipPop.current = false;
        return;
      }
      window.history.pushState({ ...(window.history.state ?? {}), olsBulk: 1 }, "");
      const draft = nameDraftRef.current;
      if (draft != null && !draft.trim() && !bulkRef.current) {
        setNameDraft(null);
        return;
      }
      setLeaveAsk(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [inMulti]);

  function rowsFromNames(raw: string): BulkRow[] {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const line of raw.split(/\n/)) {
      const name = line.replace(/\s+/g, " ").trim();
      const key = name.toLocaleLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    return names.slice(0, 40).map((name) => ({
      name,
      phone: "",
      address: "",
      pricePerCut: "30",
      cutsPerMonth: 2,
      startDate: todayISO(),
      paySameDay: false,
      openingBalance: "",
    }));
  }

  function saveBulk(rows: BulkRow[]) {
    bulkMut.mutate(rows);
  }

  function applyDebt(amount: string, indexes: number[]) {
    setBulk((prev) => prev?.map((row, idx) => (indexes.includes(idx) ? { ...row, openingBalance: amount } : row)) ?? null);
  }

  function toggleOwing(index: number, on: boolean) {
    setOwing((cur) => (on ? (cur.includes(index) ? cur : [...cur, index]) : cur.filter((n) => n !== index)));
    if (!on) {
      applyDebt("", [index]);
      return;
    }
    if (sharedDebt.trim()) applyDebt(sharedDebt.trim(), [index]);
  }

  function pickSharedDebt(amount: string) {
    setSharedDebt(amount);
    if (owing.length === 0) return;
    applyDebt(amount, owing);
  }

  return (
    <AppShell title={tx("Nuevo cliente", "New client")}>
      <ScrollTop />
      <ClientForm
        swipeKind
        submitLabel={tx("Guardar cliente", "Save client")}
        pending={mutation.isPending}
        onSubmit={(v) => {
          void findDuplicateClients({ data: { name: v.name, phone: v.phone } })
            .then((res) => {
              setDupes(res.matches);
              setPendingValue(v);
            })
            .catch(() => {
              setDupes([]);
              setPendingValue(v);
            });
        }}
        onPickMany={(contacts) =>
          setBulk(
            contacts.map((c) => ({
              name: c.name,
              phone: c.phone,
              address: c.address,
              pricePerCut: "30",
              cutsPerMonth: 2,
              startDate: todayISO(),
              paySameDay: false,
              openingBalance: "",
            })),
          )
        }
        onAddSeveral={() => setNameDraft("")}
      />
      <ConfirmDialog
        open={Boolean(pendingValue) && dupes.length > 0}
        title={tx("¿Este contacto ya existe?", "Does this contact already exist?")}
        description={
          <div className="grid gap-2">
            <p>
              {tx(
                "Hay alguien con el mismo nombre o el mismo teléfono. Revisa antes de guardar otro.",
                "Someone has the same name or the same phone. Check before saving another.",
              )}
            </p>
            <ul className="grid gap-1">
              {dupes.map((d) => (
                <li key={d.id}>
                  <Link to="/clientes/$id" params={{ id: String(d.id) }} className="font-semibold text-primary">
                    {d.name}
                    {d.phone ? ` · ${d.phone}` : ""}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        }
        confirmLabel={tx("Guardar igual", "Save anyway")}
        cancelLabel={tx("Revisar", "Review")}
        onConfirm={() => setDupes([])}
        onCancel={() => {
          setDupes([]);
          setPendingValue(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingValue) && dupes.length === 0}
        title={tx("¿Añadir este cliente?", "Add this client?")}
        description={<p>{previewWithDebt}</p>}
        confirmLabel={tx("Sí, guardar", "Yes, save")}
        pending={mutation.isPending}
        onConfirm={() => pendingValue && mutation.mutate(pendingValue)}
        onCancel={() => setPendingValue(null)}
      />
      {bulk ? (
        <div className="fixed inset-0 z-[70] grid place-items-end p-4 sm:place-items-center">
          <button
            type="button"
            className="absolute inset-0 bg-fg/45"
            aria-label={tx("Cerrar", "Close")}
            onClick={requestLeaveBulk}
          />
          <div className="relative max-h-[90dvh] w-full max-w-md overflow-auto rounded-xl bg-surface p-5 shadow-card">
            <h2 className="font-display text-xl font-semibold">{tx("Revisar contactos", "Review contacts")}</h2>
            <p className="mt-1 text-sm text-muted">
              {tx(
                "Ajusta precio y fecha. Si alguno ya te debía, márcalo en su tarjeta: ese monto entra en Por cobrar.",
                "Adjust the price and date. If someone already owed you, mark it on their card: that amount goes to To collect.",
              )}
            </p>
            <div className="mt-3 rounded-lg bg-bg p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{tx("Deuda de antes", "Earlier debt")}</p>
                <p className="text-xs text-muted">
                  {owing.length
                    ? tx(`${owing.length} con deuda`, `${owing.length} with debt`)
                    : tx("Nadie marcado", "None marked")}
                </p>
              </div>
              <DebtPresets
                value={sharedDebt}
                presets={debtPresets}
                onPick={(amount) => pickSharedDebt(String(amount))}
              />
              <div className="mt-2 flex gap-3 text-xs font-semibold">
                <button
                  type="button"
                  className="text-primary"
                  onClick={() => {
                    if (!bulk) return;
                    const amount = sharedDebt.trim() || String(debtPresets[0] ?? "");
                    if (!(Number(amount) > 0)) {
                      toast.error(tx("Elige un monto primero.", "Choose an amount first."));
                      return;
                    }
                    setSharedDebt(amount);
                    setOwing(bulk.map((_, index) => index));
                    applyDebt(amount, bulk.map((_, index) => index));
                  }}
                >
                  {tx("Todos", "All")}
                </button>
                <button
                  type="button"
                  className="text-muted"
                  onClick={() => {
                    if (!bulk) return;
                    setOwing([]);
                    applyDebt("", bulk.map((_, index) => index));
                  }}
                >
                  {tx("Ninguno", "None")}
                </button>
              </div>
            </div>
            {bulk.length > 1 ? (
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-primary"
                onClick={() =>
                  setBulk((prev) => {
                    if (!prev || prev.length < 2) return prev;
                    const first = prev[0];
                    return prev.map((row, idx) =>
                      idx === 0
                        ? row
                        : {
                            ...row,
                            pricePerCut: first.pricePerCut,
                            cutsPerMonth: first.cutsPerMonth,
                            startDate: first.startDate,
                            paySameDay: first.paySameDay,
                          },
                    );
                  })
                }
              >
                {tx("Copiar el primero en todos", "Copy the first onto all")}
              </button>
            ) : null}
            <ul className="mt-3 grid gap-3">
              {bulk.map((row, i) => (
                <li key={`${row.name}-${i}`} className="rounded-md bg-bg p-3">
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-muted">{row.phone || row.address || tx("Sin teléfono", "No phone")}</p>
                  <button
                    type="button"
                    onClick={() => toggleOwing(i, !owing.includes(i))}
                    className="mt-2 flex h-9 w-full items-center gap-2 rounded-full bg-surface px-2 text-left"
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border",
                        owing.includes(i) ? "border-due bg-due text-primary-fg" : "border-border",
                      )}
                    >
                      {owing.includes(i) ? <Check className="size-3" /> : null}
                    </span>
                    <span className={cn("text-xs font-semibold", owing.includes(i) ? "text-due" : "text-muted")}>
                      {tx("Ya debe", "Already owes")}
                    </span>
                    {owing.includes(i) && Number(row.openingBalance) > 0 ? (
                      <span className="ml-auto text-xs font-semibold tabular-nums">{money(Number(row.openingBalance))}</span>
                    ) : null}
                  </button>
                  {owing.includes(i) ? (
                    <div className="relative mt-2">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">$</span>
                      <Input
                        type="number"
                        min={0}
                        inputMode="decimal"
                        className="pl-7"
                        placeholder="0"
                        value={row.openingBalance}
                        onChange={(e) =>
                          setBulk((prev) =>
                            prev?.map((item, idx) => (idx === i ? { ...item, openingBalance: e.target.value } : item)) ?? null,
                          )
                        }
                      />
                    </div>
                  ) : null}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <Label>{tx("Precio", "Price")}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={row.pricePerCut}
                        onChange={(e) =>
                          setBulk((prev) =>
                            prev?.map((r, idx) =>
                              idx === i ? { ...r, pricePerCut: e.target.value } : r,
                            ) ?? null,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>{tx("Cortes al mes", "Cuts per month")}</Label>
                      <NativeSelect
                        value={row.cutsPerMonth}
                        onChange={(e) =>
                          setBulk((prev) =>
                            prev?.map((r, idx) =>
                              idx === i ? { ...r, cutsPerMonth: Number(e.target.value) } : r,
                            ) ?? null,
                          )
                        }
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>{tx("Cada semana", "Every week")}</option>
                      </NativeSelect>
                    </div>
                    <div className="col-span-2">
                      <PricePresets
                        value={row.pricePerCut}
                        presets={pricePresets}
                        onPick={(amount) =>
                          setBulk((prev) =>
                            prev?.map((r, idx) => (idx === i ? { ...r, pricePerCut: String(amount) } : r)) ?? null,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>{tx("Día de inicio", "Start day")}</Label>
                      <Input
                        type="date"
                        value={row.startDate}
                        onChange={(e) =>
                          setBulk((prev) =>
                            prev?.map((r, idx) =>
                              idx === i ? { ...r, startDate: e.target.value } : r,
                            ) ?? null,
                          )
                        }
                      />
                    </div>
                    <label className="mt-6 flex min-h-11 items-center gap-1.5 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={row.paySameDay}
                        onChange={(e) =>
                          setBulk((prev) =>
                            prev?.map((r, idx) =>
                              idx === i ? { ...r, paySameDay: e.target.checked } : r,
                            ) ?? null,
                          )
                        }
                        className="size-5 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 flex-1 whitespace-nowrap leading-tight">{tx("Paga el mismo día", "Same day")}</span>
                      <Hint compact text={payHelp} />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={requestLeaveBulk}>
                {tx("Cancelar", "Cancel")}
              </Button>
              <Button
                disabled={bulkMut.isPending}
                onClick={() => {
                  if (owing.some((index) => !(Number(bulk[index]?.openingBalance) > 0))) {
                    toast.error(tx("Escribe el monto de cada nombre marcado.", "Write the amount for each marked name."));
                    return;
                  }
                  saveBulk(bulk.map((row, index) => (owing.includes(index) ? row : { ...row, openingBalance: "" })));
                }}
              >
                {bulkMut.isPending
                  ? tx("Guardando…", "Saving…")
                  : tx(
                      `Añadir ${bulk.length}${owing.length ? ` · ${owing.length} con deuda` : ""}`,
                      `Add ${bulk.length}${owing.length ? ` · ${owing.length} with debt` : ""}`,
                    )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={leaveAsk}
        front
        stack
        title={tx("¿Salir sin guardar?", "Leave without saving?")}
        description={tx(
          "Se pierden los clientes que estás añadiendo.",
          "The clients you are adding will be lost.",
        )}
        confirmLabel={tx("Sí, salir", "Yes, leave")}
        cancelLabel={tx("Seguir aquí", "Stay here")}
        onConfirm={discardBulk}
        onCancel={() => setLeaveAsk(false)}
      />
      {nameDraft != null ? (
        <div className="fixed inset-0 z-[70] grid place-items-end p-4 sm:place-items-center">
          <button
            type="button"
            className="absolute inset-0 bg-fg/45"
            aria-label={tx("Cerrar", "Close")}
            onClick={() => {
              if (nameDraft.trim()) requestLeaveBulk();
              else setNameDraft(null);
            }}
          />
          <div className="relative w-full max-w-md rounded-xl bg-surface p-5 shadow-card">
            <h2 className="font-display text-xl font-semibold">{tx("Añadir varios", "Add several")}</h2>
            <p className="mt-1 text-sm text-muted">
              {tx(
                "Un nombre por línea, hasta 40, en caso de que estos clientes no estén en tus contactos.",
                "One name per line, up to 40, if these clients are not in your contacts.",
              )}
            </p>
            <textarea
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              rows={8}
              placeholder={"Franz Kafka\nAlbert Camus\nAgustín de Hipona"}
              className="mt-3 w-full rounded-md bg-bg px-3 py-3 text-fg shadow-card placeholder:text-subtle"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  if (nameDraft.trim()) requestLeaveBulk();
                  else setNameDraft(null);
                }}
              >
                {tx("Cancelar", "Cancel")}
              </Button>
              <Button
                onClick={() => {
                  const rows = rowsFromNames(nameDraft);
                  if (rows.length === 0) {
                    toast.error(tx("Escribe al menos un nombre.", "Write at least one name."));
                    return;
                  }
                  const typed = nameDraft.split(/\n/).map((line) => line.trim()).filter(Boolean).length;
                  if (typed > 40) toast.error(tx("Solo entran 40 a la vez. El resto se quedó fuera.", "Only 40 go in at a time. The rest were left out."));
                  setNameDraft(null);
                  setOwing([]);
                  setBulk(rows);
                }}
              >
                {tx("Continuar", "Continue")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
