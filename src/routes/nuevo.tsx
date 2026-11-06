import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, CircleCheck, Users } from "lucide-react";
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
import { DupCompare, afterDialogClose, afterMerge } from "@/components/dup-compare";
import { Hint } from "@/components/hint";
import { ScrollTop } from "@/components/scroll-top";
import { invalidateLawn } from "@/components/job-card";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { todayISO } from "@/lib/dates";
import { frequencyLabel, money, weekdayLabel } from "@/lib/format";
import { createClient, createClientsBulk, addClientPhoto, getSettings } from "@/lib/server/lawn";
import { checkClientDupes, checkClientDupesBatch, markNotDuplicate, mergeClients, undoMerge, type DupClient, type DupMatch } from "@/lib/server/dups";
import { nameMatch, phoneTail } from "@/lib/dup-match";
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
  /** 1.5.02: existing clients that look like this row, and what you decided ("other" = a different person). */
  dups?: DupMatch[];
  dupState?: "other" | { merge: number; name: string };
};

/** 1.5.02: the earlier row in the same list this one repeats (same name, almost the same, or same phone). */
function repeatOf(rows: BulkRow[], i: number): number {
  const r = rows[i];
  for (let j = 0; j < i; j++) {
    const o = rows[j];
    if (nameMatch(r.name, o.name) || (phoneTail(r.phone) && phoneTail(r.phone) === phoneTail(o.phone))) return j;
  }
  return -1;
}

function NuevoPage() {
  const tx = useTx();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pendingValue, setPendingValue] = useState<ClientFormValue | null>(null);
  const [dupes, setDupes] = useState<DupMatch[]>([]);
  // 1.5.02: look-alikes you said are someone else; once saved, the scan stops pairing them.
  const [notSame, setNotSame] = useState<number[]>([]);
  const [rowCompare, setRowCompare] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);
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
  const mutation = useMutation({
    mutationFn: (value: ClientFormValue) => createClient({ data: payloadFromForm(value) }),
    onSuccess: async (res, value) => {
      for (const data of value.pendingPhotos) {
        await addClientPhoto({ data: { clientId: res.id, data } }).catch(() => undefined);
      }
      toast.success(tx("Cliente guardado", "Client saved"));
      for (const other of notSame) void markNotDuplicate({ data: { a: res.id, b: other } }).catch(() => undefined);
      setNotSame([]);
      setPendingValue(null);
      await invalidateLawn(qc);
      await navigate({ to: "/clientes/$id", params: { id: String(res.id) } });
    },
    onError: () => toast.error(tx("No se pudo guardar el cliente", "Could not save the client")),
  });

  // 1.5.02 Unir from "¿Es el mismo cliente?" on a new client: it is saved, then merged into the one that exists
  // (phone, address, photos and earlier debt go there; the new card goes to Archivos and the undo brings it back).
  async function mergeNewInto(other: DupClient) {
    if (!pendingValue || merging) return;
    setMerging(true);
    try {
      const made = await createClient({ data: payloadFromForm(pendingValue) });
      for (const data of pendingValue.pendingPhotos) {
        await addClientPhoto({ data: { clientId: made.id, data } }).catch(() => undefined);
      }
      const res = await mergeClients({ data: { keepId: other.id, dropId: made.id } });
      await afterMerge(qc, tx, res, other.name, pendingValue.name);
      setDupes([]);
      setPendingValue(null);
      if (res.ok) afterDialogClose(() => void navigate({ to: "/clientes/$id", params: { id: String(other.id) } }));
    } catch {
      toast.error(tx("No se pudo unir", "Could not merge"));
    } finally {
      setMerging(false);
    }
  }

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
    onSuccess: async (res, rows) => {
      // 1.5.02: rows you chose to Unir are merged into the client that exists, one by one, each with its undo.
      const mergeIds: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        const st = rows[i].dupState;
        const id = res.ids[i];
        if (st === "other" && id) {
          for (const d of rows[i].dups ?? []) await markNotDuplicate({ data: { a: id, b: d.id } }).catch(() => undefined);
          continue;
        }
        if (!id || typeof st !== "object") continue;
        const m = await mergeClients({ data: { keepId: st.merge, dropId: id } }).catch(() => null);
        if (m?.ok) mergeIds.push(m.mergeId);
      }
      const merged = mergeIds.length;
      const added = res.count - merged;
      toast.success(
        merged
          ? tx(`${added} ${added === 1 ? "cliente añadido" : "clientes añadidos"} · ${merged} ${merged === 1 ? "unido" : "unidos"}`, `${added} added · ${merged} merged`)
          : tx(`${res.count} ${res.count === 1 ? "cliente añadido" : "clientes añadidos"}`, `${res.count} ${res.count === 1 ? "client" : "clients"} added`),
        merged
          ? {
              duration: 10000,
              action: {
                label: tx("Deshacer unión", "Undo merge"),
                onClick: () => {
                  void Promise.all(mergeIds.map((mergeId) => undoMerge({ data: { mergeId } }).catch(() => null))).then((all) => {
                    const ok = all.filter((r) => r?.ok).length;
                    toast.success(tx(`${ok} ${ok === 1 ? "unión deshecha" : "uniones deshechas"}`, `${ok} ${ok === 1 ? "merge" : "merges"} undone`));
                    void qc.invalidateQueries({ queryKey: ["dup-scan"] });
                    void invalidateLawn(qc);
                  });
                },
              },
            }
          : undefined,
      );
      closeBulk();
      void qc.invalidateQueries({ queryKey: ["dup-scan"] });
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
      // 1.5.02: back that only closed a dialog on top (¿Es el mismo cliente?, ¿Salir sin guardar?) lands on the
      // sheet's own step: stay in the sheet, ask nothing.
      if ((window.history.state as { olsBulk?: number } | null)?.olsBulk) return;
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

  // 1.5.02: every row is checked against your clients as soon as the list opens (and again when its phone changes).
  function openBulk(rows: BulkRow[]) {
    setBulk(rows);
    void checkClientDupesBatch({ data: { rows: rows.map((r) => ({ name: r.name, phone: r.phone, address: r.address })) } })
      .then((res) => {
        setBulk((prev) =>
          prev && prev.length === rows.length && prev.every((r, i) => r.name === rows[i].name)
            ? prev.map((row, i) => ({ ...row, dups: res.rows[i] ?? [] }))
            : prev,
        );
      })
      .catch(() => undefined);
  }

  function recheckRow(index: number) {
    const row = bulkRef.current?.[index];
    if (!row) return;
    void checkClientDupes({ data: { name: row.name, phone: row.phone, address: row.address } })
      .then((res) => {
        setBulk((prev) =>
          prev?.map((r, i) =>
            i === index ? { ...r, dups: res.matches, dupState: r.dupState && res.matches.length ? r.dupState : undefined } : r,
          ) ?? null,
        );
      })
      .catch(() => undefined);
  }

  function removeRow(index: number) {
    setBulk((prev) => {
      if (!prev) return prev;
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : null;
    });
    setOwing((cur) => cur.filter((n) => n !== index).map((n) => (n > index ? n - 1 : n)));
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
          setNotSame([]);
          void checkClientDupes({ data: { name: v.name, phone: v.phone, address: v.address } })
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
          openBulk(
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
      <DupCompare
        open={Boolean(pendingValue) && dupes.length > 0}
        mode="new"
        mine={{
          name: pendingValue?.name ?? "",
          phone: pendingValue?.phone,
          address: pendingValue?.address,
          price: Number(pendingValue?.pricePerCut) || null,
          balance: Number(pendingValue?.openingBalance) || 0,
        }}
        matches={dupes}
        pending={merging}
        onUse={(other) => {
          setDupes([]);
          setPendingValue(null);
          afterDialogClose(() => void navigate({ to: "/clientes/$id", params: { id: String(other.id) } }));
        }}
        onOther={() => {
          setNotSame(dupes.map((d) => d.id));
          setDupes([]);
        }}
        onMerge={(_keep, other) => void mergeNewInto(other)}
        onClose={() => {
          setDupes([]);
          setNotSame([]);
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
      {bulk ? (() => {
        const merges = bulk.filter((r) => r.dupState && r.dupState !== "other").length;
        const adds = bulk.length - merges;
        const saveLabel = tx(
          `Añadir ${adds}${merges ? ` · ${merges} ${merges === 1 ? "se une" : "se unen"}` : ""}${owing.length ? ` · ${owing.length} con deuda` : ""}`,
          `Add ${adds}${merges ? ` · ${merges} merge` : ""}${owing.length ? ` · ${owing.length} with debt` : ""}`,
        );
        const cmp = rowCompare != null ? bulk[rowCompare] : null;
        return (
        <div className="fixed inset-0 z-[70] grid place-items-end p-3 sm:place-items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bz-scrim"
            aria-label={tx("Cerrar", "Close")}
            onClick={requestLeaveBulk}
          />
          <div role="dialog" aria-modal="true" aria-label={tx("Revisar clientes", "Review clients")} className={cn("bz-dialog bz-bulk relative w-full min-w-0 bg-surface", bulk.length > 1 && "is-wide")}>
            <h2 className="bz-dialog-title font-display">
              <span className="min-w-0 flex-1">{tx("Revisar clientes", "Review clients")}</span>
              <span className="bz-dialog-aside tabular-nums">{bulk.length}</span>
            </h2>
            <p className="mt-2 text-sm text-muted">
              {tx(
                "Ajusta precio y fecha. Si alguno ya te debía, márcalo en su tarjeta: ese monto entra en Por cobrar.",
                "Adjust the price and date. If someone already owed you, mark it on their card: that amount goes to To collect.",
              )}
            </p>
            <div className="bz-bulk-box mt-3">
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
              <div className="mt-1 flex items-center gap-1 text-xs font-semibold">
                <button
                  type="button"
                  className="min-h-10 px-1 text-primary"
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
                  className="min-h-10 px-1 text-muted"
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
            <ul className="bz-bulk-list mt-3 grid gap-3">
              {bulk.map((row, i) => {
                const rep = repeatOf(bulk, i);
                const like = row.dups?.[0];
                return (
                <li key={`${row.name}-${i}`} className="bz-bulk-row">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("min-w-0 font-semibold leading-tight", i === 0 && bulk.length > 1 && "pt-2.5")}>{row.name}</p>
                    {i === 0 && bulk.length > 1 ? (
                      <button
                        type="button"
                        className="min-h-10 shrink-0 px-1 text-xs font-semibold text-primary"
                        onClick={() =>
                          setBulk((prev) => {
                            if (!prev || prev.length < 2) return prev;
                            const first = prev[0];
                            return prev.map((r, idx) =>
                              idx === 0
                                ? r
                                : { ...r, pricePerCut: first.pricePerCut, cutsPerMonth: first.cutsPerMonth, startDate: first.startDate, paySameDay: first.paySameDay },
                            );
                          })
                        }
                      >
                        {tx("Copiar a todos", "Copy to all")}
                      </button>
                    ) : null}
                  </div>
                  {row.address ? <p className="mt-0.5 text-xs text-muted">{row.address}</p> : null}
                  {rep >= 0 ? (
                    <div className="bz-bulk-dup">
                      <Users aria-hidden />
                      <span className="min-w-0">{tx("Repetido en esta lista:", "Repeated in this list:")} <b>{bulk[rep].name}</b></span>
                      <button type="button" className="bz-bulk-dup-go" onClick={() => removeRow(i)}>{tx("Quitar", "Remove")}</button>
                    </div>
                  ) : like && !row.dupState ? (
                    <button type="button" className="bz-bulk-dup" onClick={() => setRowCompare(i)}>
                      <Users aria-hidden />
                      <span className="min-w-0">
                        {tx("Se parece a", "Looks like")} <b>{like.name}</b>
                        {like.phone ? <span className="tabular-nums"> · {like.phone}</span> : null}
                        {row.dups && row.dups.length > 1 ? tx(` y ${row.dups.length - 1} más`, ` and ${row.dups.length - 1} more`) : ""}
                      </span>
                      <span className="bz-bulk-dup-go">{tx("Comparar", "Compare")}</span>
                    </button>
                  ) : row.dupState && row.dupState !== "other" ? (
                    <button type="button" className="bz-bulk-dup is-ok" onClick={() => setRowCompare(i)}>
                      <CircleCheck aria-hidden />
                      <span className="min-w-0">{tx("Se une a", "Merges into")} <b>{row.dupState.name}</b></span>
                      <span className="bz-bulk-dup-go">{tx("Cambiar", "Change")}</span>
                    </button>
                  ) : null}
                  <Input
                    type="tel"
                    inputMode="tel"
                    className="mt-2"
                    aria-label={tx("Teléfono", "Phone")}
                    placeholder={tx("Teléfono (opcional)", "Phone (optional)")}
                    value={row.phone}
                    onChange={(e) =>
                      setBulk((prev) => prev?.map((r, idx) => (idx === i ? { ...r, phone: e.target.value } : r)) ?? null)
                    }
                    onBlur={() => recheckRow(i)}
                  />
                  <button
                    type="button"
                    onClick={() => toggleOwing(i, !owing.includes(i))}
                    className="mt-2 flex h-10 w-full items-center gap-2 rounded-full bg-surface px-2 text-left"
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
                    <div className="col-span-2">
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
                    <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm font-medium">
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
                      <span className="min-w-0 flex-1 whitespace-nowrap leading-tight">{tx("Paga el mismo día", "Pays the same day")}</span>
                      <Hint compact topic="paga-mismo-dia" />
                    </label>
                  </div>
                </li>
                );
              })}
            </ul>
            <div className="bz-dialog-actions">
              <div className={cn("bz-dialog-pair", saveLabel.length > 16 && "bz-dialog-pair-col")}>
                <Button variant="secondary" className="bz-dialog-quiet" onClick={requestLeaveBulk}>
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
                  {bulkMut.isPending ? tx("Guardando", "Saving") : saveLabel}
                </Button>
              </div>
            </div>
          </div>
          <DupCompare
            open={cmp != null && Boolean(cmp.dups?.length)}
            mode="new"
            mine={{ name: cmp?.name ?? "", phone: cmp?.phone, address: cmp?.address, price: Number(cmp?.pricePerCut) || null, balance: owing.includes(rowCompare ?? -1) ? Number(cmp?.openingBalance) || 0 : 0 }}
            matches={cmp?.dups ?? []}
            onUse={(other) => {
              const at = rowCompare;
              setRowCompare(null);
              if (at == null) return;
              removeRow(at);
              toast(tx(`${other.name} ya existe: no se añade otra vez.`, `${other.name} already exists: not added again.`));
            }}
            onOther={() => {
              const at = rowCompare;
              setRowCompare(null);
              setBulk((prev) => prev?.map((r, idx) => (idx === at ? { ...r, dupState: "other" } : r)) ?? null);
            }}
            onMerge={(_keep, other) => {
              const at = rowCompare;
              setRowCompare(null);
              setBulk((prev) => prev?.map((r, idx) => (idx === at ? { ...r, dupState: { merge: other.id, name: other.name } } : r)) ?? null);
            }}
            onClose={() => setRowCompare(null)}
          />
        </div>
        );
      })() : null}
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
            className="absolute inset-0 bz-scrim"
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
                  openBulk(rows);
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
