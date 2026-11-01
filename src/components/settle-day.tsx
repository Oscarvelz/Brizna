import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { invalidateLawn } from "@/components/job-card";
import { Input } from "@/components/ui/input";
import { money } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { playDing } from "@/lib/sounds";
import { completeJob } from "@/lib/server/lawn";
import type { JobRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "paid" | "abono" | "owe";
type Row = { id: number; mode: Mode; abono: string; tip: string };

export function SettleDay({
  jobs,
  open,
  onClose,
}: {
  jobs: JobRow[];
  open: boolean;
  onClose: () => void;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState(false);
  const key = jobs.map((job) => job.id).join(",");

  useEffect(() => {
    if (!open) return;
    setRows(
      jobs.map((job) => ({
        id: job.id,
        mode: job.paySameDay ? "paid" : "owe",
        abono: "",
        tip: "",
      })),
    );
  }, [open, key]);

  function setRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function save() {
    if (jobs.length === 0) {
      onClose();
      return;
    }
    for (const job of jobs) {
      const row = rows.find((item) => item.id === job.id);
      if (row?.mode === "abono" && (Number(row.abono) || 0) <= 0) {
        toast.error(tx(`Escribe el abono de ${job.clientName}.`, `Enter the partial payment for ${job.clientName}.`));
        return;
      }
    }
    setPending(true);
    try {
      for (const job of jobs) {
        const row = rows.find((item) => item.id === job.id);
        const mode = row?.mode ?? "owe";
        await completeJob({
          data: {
            id: job.id,
            settlement: mode,
            abono: mode === "abono" ? Math.round((Number(row?.abono) || 0) * 100) / 100 : undefined,
            tip: Math.round((Number(row?.tip) || 0) * 100) / 100,
          },
        });
      }
      playDing();
      toast.success(
        jobs.length === 1
          ? tx("1 patio marcado como hecho", "1 yard marked done")
          : tx(`${jobs.length} patios marcados como hechos`, `${jobs.length} yards marked done`),
      );
      await invalidateLawn(qc);
      onClose();
    } catch {
      toast.error(tx("No se pudieron marcar todos", "Could not mark them all"));
    } finally {
      setPending(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title={tx("¿Quién pagó hoy?", "Who paid today?")}
      description={
        <div className="grid max-h-80 gap-2 overflow-auto pr-1">
          <p>
            {tx(
              "Elige quién pagó o abonó. El resto queda pendiente y entra en Cobros.",
              "Choose who paid or left a partial payment. The rest stay unpaid and go to Payments.",
            )}
          </p>
          {jobs.map((job) => {
            const row = rows.find((item) => item.id === job.id);
            const mode = row?.mode ?? "owe";
            return (
              <div key={job.id} className="rounded-md bg-bg px-2 py-2">
                <p className="text-sm font-semibold">
                  {job.clientName} · {money(job.amount)}
                </p>
                <div className="mt-1 grid grid-cols-3 gap-1">
                  {(
                    [
                      ["paid", tx("Pagó", "Paid")],
                      ["abono", tx("Abonó", "Partial")],
                      ["owe", tx("Pendiente", "Unpaid")],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setRow(job.id, { mode: id })}
                      className={cn(
                        "h-9 rounded-sm text-xs font-semibold",
                        mode === id ? "bz-pick" : "bg-surface text-muted",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {mode === "abono" ? (
                  <Input
                    value={row?.abono ?? ""}
                    inputMode="decimal"
                    onChange={(e) => setRow(job.id, { abono: e.target.value })}
                    placeholder={tx("Monto del abono", "Partial amount")}
                    className="mt-1 h-10"
                  />
                ) : null}
                {mode !== "owe" ? (
                  <Input
                    value={row?.tip ?? ""}
                    inputMode="decimal"
                    onChange={(e) => setRow(job.id, { tip: e.target.value })}
                    placeholder={tx("Propina, si dieron de más", "Tip, if they gave extra")}
                    className="mt-1 h-10"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      }
      confirmLabel={tx("Sí, marcar todos", "Yes, mark all")}
      pending={pending}
      onConfirm={() => void save()}
      onCancel={onClose}
    />
  );
}
