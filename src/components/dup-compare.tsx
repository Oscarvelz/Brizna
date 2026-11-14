// 1.5.02 "¿Es el mismo cliente?": the one you are adding (or editing) beside the client(s) that look like it,
// phone and address included, so you can tell at a glance. Usar existente / Es otro cliente / Unir.
// Nothing merges unless Unir is tapped. Same dialog frame as every Brizna dialog (bz-dialog), back closes it.
import { useEffect, useId, useState, type ReactNode } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateLawn } from "@/components/job-card";
import { createPortal } from "react-dom";
import { ArrowLeftRight, CalendarClock, Check, ChevronRight, MapPin, Phone, Scissors, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import { useBackClose } from "@/lib/back-close";
import { formatDay, money } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { phoneTail, addressKey, nameMatch, type DupWhy } from "@/lib/dup-match";
import { markNotDuplicate, mergeClients, scanClientDupes, undoMerge, type DupClient, type DupMatch } from "@/lib/server/dups";

/** The side you bring: a new client (only what was typed) or an existing one. */
export type DupSide = {
  id?: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  price?: number | null;
  balance?: number | null;
  existing?: DupClient;
};

type Tx = ReturnType<typeof useTx>;

export type DupMode = "new" | "edit" | "scan";

export function DupCompare({
  open,
  mode,
  mine,
  matches,
  pending,
  onUse,
  onOther,
  onMerge,
  onClose,
}: {
  open: boolean;
  mode: DupMode;
  mine: DupSide;
  matches: DupMatch[] | DupClient[];
  pending?: boolean;
  /** Usar existente (new/edit): keep that client and drop what you typed. */
  onUse?: (other: DupClient) => void;
  /** Es otro cliente: they are different people. */
  onOther: (other: DupClient) => void;
  /** Unir: keepId stays, dropId is archived with what could not move. For a new client keepId is the existing one. */
  onMerge: (keepId: number, other: DupClient) => void;
  onClose: () => void;
}) {
  const tx = useTx();
  const titleId = useId();
  const [at, setAt] = useState(0);
  const [keepMine, setKeepMine] = useState(false);
  useBackClose(open, onClose);
  useEffect(() => {
    if (open) {
      setAt(0);
      setKeepMine(false);
    }
  }, [open, matches]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined" || matches.length === 0) return null;
  const other = matches[Math.min(at, matches.length - 1)] as DupMatch;
  const why: DupWhy[] = other.why ?? whyOf(mine, other);
  // Scan/edit: by default the one with more history stays.
  const mineId = mine.id ?? mine.existing?.id;
  const mineDone = mine.existing?.done ?? 0;
  const defaultKeepMine = mode !== "new" && mineId != null && (mineDone > other.done || (mineDone === other.done && (mine.existing?.isActive ?? true) && !other.isActive));
  const keepsMine = mode !== "new" && mineId != null && (keepMine ? !defaultKeepMine : defaultKeepMine);
  // Same name on both sides: say which side stays, so the note never reads "Ana pasa a Ana".
  const sameNames = mine.name.trim().toLowerCase() === other.name.trim().toLowerCase();
  const mineLabel = mode === "new" ? tx("Nuevo", "New") : mode === "edit" ? tx("Este", "This one") : tx("Uno", "One");
  const otherLabel = !other.isActive ? tx("En archivos", "Archived") : mode === "scan" ? tx("Otro", "Other") : tx("Ya existe", "Already there");
  const keepName = sameNames ? `${keepsMine ? mine.name : other.name} (${keepsMine ? mineLabel : otherLabel})` : keepsMine ? mine.name : other.name;
  const goneName = sameNames ? `${keepsMine ? other.name : mine.name} (${keepsMine ? otherLabel : mineLabel})` : keepsMine ? other.name : mine.name;
  const reason = whyWords(why, tx);

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-end overflow-y-auto p-3 sm:place-items-center sm:p-4">
      <button type="button" aria-label={tx("Cerrar", "Close")} className="absolute inset-0 bz-scrim" onClick={onClose} />
      <div role="dialog" aria-modal="true" data-present="dup-comparar" aria-labelledby={titleId} className="bz-dialog bz-dup relative my-auto w-full min-w-0 bg-surface">
        <h2 id={titleId} className="bz-dialog-title has-chip font-display">
          <span className="bz-dialog-chip" aria-hidden="true"><Users /></span>
          <span className="bz-dialog-tblock min-w-0 flex-1">
            <span className="block">{tx("¿Es el mismo cliente?", "Is it the same client?")}</span>
            <span className="bz-dialog-sub">{reason}</span>
          </span>
          <Hint compact topic="clientes-repetidos" />
        </h2>
        {matches.length > 1 ? (
          <div className="bz-dup-pick" role="tablist" aria-label={tx("Parecidos", "Look-alikes")}>
            {(matches as DupClient[]).map((m, i) => (
              <button key={m.id} type="button" role="tab" aria-selected={i === at} className={cn("bz-dup-tab", i === at && "is-on")} onClick={() => { setAt(i); setKeepMine(false); }}>
                {m.name}
              </button>
            ))}
          </div>
        ) : null}
        <div className="bz-dup-grid">
          <SideHead label={mineLabel} name={mine.name} on={why.includes("name") || why.includes("near")} stays={mode !== "new" ? keepsMine : undefined} archived={mine.existing ? !mine.existing.isActive : false} />
          <SideHead label={otherLabel} name={other.name} on={why.includes("name") || why.includes("near")} stays={mode !== "new" ? !keepsMine : true} archived={!other.isActive} />
          <Cell icon={<Phone />} value={mine.phone} empty={tx("Sin teléfono", "No phone")} on={why.includes("phone")} tel />
          <Cell icon={<Phone />} value={other.phone} empty={tx("Sin teléfono", "No phone")} on={why.includes("phone")} tel />
          <Cell icon={<MapPin />} value={mine.address} empty={tx("Sin dirección", "No address")} on={why.includes("address")} />
          <Cell icon={<MapPin />} value={other.address} empty={tx("Sin dirección", "No address")} on={why.includes("address")} />
          <Cell icon={<Scissors />} value={priceLine(mine.existing ?? (mine.price != null ? { price: mine.price, kind: "regular", done: 0 } : null), tx)} empty={tx("Sin precio", "No price")} />
          <Cell icon={<Scissors />} value={priceLine(other, tx)} empty={tx("Sin precio", "No price")} />
          <Cell icon={<CalendarClock />} value={mine.existing ? visitLine(mine.existing, tx) : tx("Sin visitas todavía", "No visits yet")} empty="" />
          <Cell icon={<CalendarClock />} value={visitLine(other, tx)} empty="" />
          <Cell icon={<Wallet />} value={debtLine(mine.existing?.balance ?? mine.balance ?? 0, tx)} empty="" />
          <Cell icon={<Wallet />} value={debtLine(other.balance, tx)} empty="" />
        </div>
        <p className="bz-dup-note">
          {mode === "new"
            ? tx(`Unir: lo nuevo (teléfono, dirección, deuda) pasa a ${other.name} y no queda un cliente doble. Se puede deshacer.`, `Merge: what is new (phone, address, debt) goes to ${other.name}, with no double client left. It can be undone.`)
            : tx(`Unir: queda ${keepName}. Cortes, pagos, fotos y notas de ${goneName} pasan a ${keepName}; ${goneName} va a Archivos. Se puede deshacer.`, `Merge: ${keepName} stays. Cuts, payments, photos and notes of ${goneName} move to ${keepName}; ${goneName} goes to the archive. It can be undone.`)}
          {mode !== "new" && mineId != null ? (
            <button type="button" className="bz-dup-swap" data-present="dup-cambiar" onClick={() => setKeepMine((v) => !v)}>
              <ArrowLeftRight aria-hidden />{tx("Cambiar", "Swap")}
            </button>
          ) : null}
        </p>
        <div className="bz-dialog-actions">
          {mode !== "scan" && onUse ? (
            <Button type="button" data-present="dup-usar" disabled={pending} onClick={() => onUse(other)}>
              {mode === "edit" ? tx(`Ir a ${firstWord(other.name)}`, `Open ${firstWord(other.name)}`) : tx("Usar existente", "Use existing")}
            </Button>
          ) : null}
          <div className="bz-dialog-pair">
            <Button type="button" variant="secondary" className="bz-dialog-quiet" data-present="dup-otro" disabled={pending} onClick={() => onOther(other)}>
              {tx("Es otro cliente", "Another client")}
            </Button>
            <Button
              type="button"
              data-present="dup-unir"
              variant={mode === "scan" ? "primary" : "secondary"}
              className={cn(mode !== "scan" && "bz-dup-merge")}
              disabled={pending}
              onClick={() => onMerge(keepsMine && mineId != null ? mineId : other.id, other)}
            >
              {pending ? tx("Uniendo", "Merging") : tx("Unir", "Merge")}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SideHead({ label, name, on, stays, archived }: { label: string; name: string; on: boolean; stays?: boolean; archived: boolean }) {
  const tx = useTx();
  return (
    <div className={cn("bz-dup-head", on && "is-on")}>
      <span className="bz-dup-label">
        {label}
        {stays ? <span className="bz-dup-stays"><Check aria-hidden />{tx("Queda", "Stays")}</span> : null}
        {archived && !stays ? null : null}
      </span>
      <span className="bz-dup-name">{name}</span>
    </div>
  );
}

function Cell({ icon, value, empty, on, tel }: { icon: ReactNode; value: string | null | undefined; empty: string; on?: boolean; tel?: boolean }) {
  const v = (value ?? "").trim();
  return (
    <div className={cn("bz-dup-cell", on && "is-on", !v && "is-empty")}>
      <span className="bz-dup-ic" aria-hidden>{icon}</span>
      <span className={cn("bz-dup-val", tel && "tabular-nums")}>{v || empty}</span>
      {on ? <Check className="bz-dup-eq" aria-hidden /> : null}
    </div>
  );
}

function whyOf(a: DupSide, b: DupClient): DupWhy[] {
  const out: DupWhy[] = [];
  const nm = nameMatch(a.name, b.name);
  if (nm === "same") out.push("name");
  else if (nm === "near") out.push("near");
  if (phoneTail(a.phone) && phoneTail(a.phone) === phoneTail(b.phone)) out.push("phone");
  if (addressKey(a.address) && addressKey(a.address) === addressKey(b.address)) out.push("address");
  return out;
}

function whyWords(why: DupWhy[], tx: Tx): string {
  const parts: string[] = [];
  if (why.includes("name")) parts.push(tx("el mismo nombre", "the same name"));
  else if (why.includes("near")) parts.push(tx("un nombre casi igual", "an almost equal name"));
  if (why.includes("phone")) parts.push(tx("el mismo teléfono", "the same phone"));
  if (why.includes("address")) parts.push(tx("la misma dirección", "the same address"));
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} ${tx("y", "and")} ${parts[parts.length - 1]}` : parts[0] ?? "";
  return tx(`Tienen ${list}.`, `They have ${list}.`);
}

function priceLine(c: { price: number; kind: string; done: number; cutsPerMonth?: number; frequencyDays?: number | null } | null, tx: Tx): string {
  if (!c || !(c.price > 0)) return "";
  if (c.kind === "one_time") return tx(`${money(c.price)} · Una vez`, `${money(c.price)} · One-time`);
  const f = c.frequencyDays ? tx(`cada ${c.frequencyDays} días`, `every ${c.frequencyDays} days`) : c.cutsPerMonth ? (c.cutsPerMonth >= 4 ? tx("cada semana", "weekly") : tx(`${c.cutsPerMonth} al mes`, `${c.cutsPerMonth} a month`)) : "";
  return f ? `${money(c.price)} · ${f}` : money(c.price);
}

function visitLine(c: DupClient, tx: Tx): string {
  const done = tx(`${c.done} ${c.done === 1 ? "corte hecho" : "cortes hechos"}`, `${c.done} ${c.done === 1 ? "cut" : "cuts"} done`);
  const yr = new Date().getFullYear().toString();
  if (c.lastCut) return `${done} · ${tx("último", "last")} ${formatDay(c.lastCut, c.lastCut.startsWith(yr) ? "d MMM" : "d MMM yy")}`;
  if (c.nextCut) return `${done} · ${tx("próximo", "next")} ${formatDay(c.nextCut, "d MMM")}`;
  return done;
}

function debtLine(v: number, tx: Tx): string {
  return v > 0 ? tx(`Debe ${money(v)}`, `Owes ${money(v)}`) : tx("No debe", "Owes nothing");
}

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** After Unir: refresh, and a toast with Deshacer (the undo also lives in Cambios hechos of both clients). */
export async function afterMerge(
  qc: QueryClient,
  tx: Tx,
  res: { ok: boolean; mergeId?: string; conflicts?: { jobs: number; links: number } },
  keepName: string,
  dropName: string,
) {
  void qc.invalidateQueries({ queryKey: ["dup-scan"] });
  void invalidateLawn(qc);
  if (!res.ok || !res.mergeId) {
    toast.error(tx("No se pudo unir", "Could not merge"));
    return;
  }
  const mergeId = res.mergeId;
  const left = res.conflicts?.jobs ?? 0;
  const same = dropName.trim().toLowerCase() === keepName.trim().toLowerCase();
  toast.success(same ? tx(`Los dos ${keepName} quedaron en uno`, `The two ${keepName} are now one`) : tx(`${dropName} quedó unido a ${keepName}`, `${dropName} was merged into ${keepName}`), {
    description: left > 0
      ? tx(`${left} ${left === 1 ? "corte del mismo día quedó" : "cortes del mismo día quedaron"} en Archivos con ${dropName}.`, `${left} same-day ${left === 1 ? "cut stayed" : "cuts stayed"} in the archive with ${dropName}.`)
      : undefined,
    duration: 10000,
    action: {
      label: tx("Deshacer", "Undo"),
      onClick: () => {
        void undoMerge({ data: { mergeId } })
          .then((r) => {
            if (r.ok) toast.success(tx("Unión deshecha", "Merge undone"));
            else toast(tx("Esa unión ya estaba deshecha", "That merge was already undone"));
            void qc.invalidateQueries({ queryKey: ["dup-scan"] });
            void invalidateLawn(qc);
          })
          .catch(() => toast.error(tx("No se pudo deshacer", "Could not undo")));
      },
    },
  });
}

/**
 * 1.5.02 Clientes > Inventario: "N posibles repetidos" (only when there are), a list of the groups, and the same
 * side-by-side dialog for each pair. Unir and Es otro cliente act only on tap.
 */
export function DupScanLine() {
  const tx = useTx();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["dup-scan"], queryFn: () => scanClientDupes(), staleTime: 60_000 });
  const [open, setOpen] = useState(false);
  const [pair, setPair] = useState<{ a: DupClient; others: DupClient[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const groups = q.data?.groups ?? [];
  const n = groups.length;
  useBackClose(open && !pair, () => setOpen(false));
  if (!n && !open) return null;
  const close = () => setOpen(false);
  return (
    <>
      {n ? (
        <button type="button" className="bz-inv-dups" data-present="dup-escanear" data-ref="inv-dups" onClick={() => setOpen(true)}>
          <Users aria-hidden />
          <span className="min-w-0">{tx(`${n} ${n === 1 ? "posible cliente repetido" : "posibles clientes repetidos"}`, `${n} possible duplicate ${n === 1 ? "client" : "clients"}`)}</span>
          <span className="bz-inv-dups-go">{tx("Revisar", "Review")}<ChevronRight aria-hidden /></span>
        </button>
      ) : null}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[90] grid place-items-end overflow-y-auto p-3 sm:place-items-center sm:p-4">
              <button type="button" aria-label={tx("Cerrar", "Close")} className="absolute inset-0 bz-scrim" onClick={close} />
              <div role="dialog" aria-modal="true" aria-label={tx("Posibles repetidos", "Possible duplicates")} className="bz-dialog bz-dup-scan relative my-auto w-full min-w-0 bg-surface">
                <h2 className="bz-dialog-title has-chip font-display">
                  <span className="bz-dialog-chip" aria-hidden="true"><Users /></span>
                  <span className="bz-dialog-tblock min-w-0 flex-1">
                    <span className="block">{tx("Posibles repetidos", "Possible duplicates")}</span>
                    <span className="bz-dialog-sub">{n ? tx("Toca uno para compararlos. Nada se une solo.", "Tap one to compare them. Nothing merges by itself.") : tx("Ya no queda ninguno.", "None left.")}</span>
                  </span>
                </h2>
                <div className="bz-dup-list">
                  {groups.map((g) => (
                    <button key={g.members.map((m) => m.id).join("-")} type="button" className="bz-dup-group" data-present="dup-grupo" onClick={() => setPair({ a: g.members[0], others: g.members.slice(1) })}>
                      <span className="bz-dup-group-names">
                        {g.members.map((m) => m.name).join(" · ")}
                        <span className="bz-dup-group-why">{whyWords(g.why, tx)}</span>
                      </span>
                      <ChevronRight aria-hidden />
                    </button>
                  ))}
                </div>
                <div className="bz-dialog-actions">
                  <Button type="button" variant="secondary" className="bz-dialog-quiet" onClick={close}>{tx("Cerrar", "Close")}</Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <DupCompare
        open={pair != null}
        mode="scan"
        mine={pair ? { id: pair.a.id, name: pair.a.name, phone: pair.a.phone, address: pair.a.address, existing: pair.a } : { name: "" }}
        matches={pair?.others ?? []}
        pending={busy}
        onOther={(other) => {
          if (!pair) return;
          setBusy(true);
          void markNotDuplicate({ data: { a: pair.a.id, b: other.id } })
            .then(async () => {
              toast(tx(`Listo: ${pair.a.name} y ${other.name} son clientes distintos.`, `Done: ${pair.a.name} and ${other.name} are different clients.`));
              await qc.invalidateQueries({ queryKey: ["dup-scan"] });
            })
            .finally(() => {
              setBusy(false);
              setPair(null);
            });
        }}
        onMerge={(keepId, other) => {
          if (!pair) return;
          const dropId = keepId === pair.a.id ? other.id : pair.a.id;
          const keepName = keepId === pair.a.id ? pair.a.name : other.name;
          const dropName = keepId === pair.a.id ? other.name : pair.a.name;
          setBusy(true);
          void mergeClients({ data: { keepId, dropId } })
            .then((res) => afterMerge(qc, tx, res, keepName, dropName))
            .catch(() => toast.error(tx("No se pudo unir", "Could not merge")))
            .finally(() => {
              setBusy(false);
              setPair(null);
            });
        }}
        onClose={() => setPair(null)}
      />
    </>
  );
}

/** Run `fn` once the dialog's own history step is gone (its back), so a navigation is never undone by it. */
export function afterDialogClose(fn: () => void) {
  if (typeof window === "undefined") return fn();
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    window.removeEventListener("popstate", run);
    window.setTimeout(fn, 0);
  };
  window.addEventListener("popstate", run);
  window.setTimeout(run, 450);
}
