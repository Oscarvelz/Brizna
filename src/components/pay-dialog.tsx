import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { invalidateLawn } from "@/components/job-card";
import { MethodField } from "@/components/method-field";
import { MoneyCalc } from "@/components/money-calc";
import { Input, Label } from "@/components/ui/input";
import { money } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { recordPayment } from "@/lib/server/lawn";
import { useUndo } from "@/lib/undo";
import { undoPayment } from "@/lib/server/lawn";

export type PayMode = "full" | "abono" | "prepaid";

export function PayDialog({
  open,
  mode,
  clientId,
  name,
  balance,
  credit,
  defaultAmount,
  presets,
  onClose,
}: {
  open: boolean;
  mode: PayMode;
  clientId: number;
  name: string;
  balance: number;
  credit: number;
  defaultAmount?: string;
  presets?: number[];
  onClose: () => void;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const push = useUndo((s) => s.push);
  const [amount, setAmount] = useState(mode === "full" ? String(balance) : "");
  const [tip, setTip] = useState("");
  const [method, setMethod] = useState("");
  // 1.5.54 (censo de botones): el aviso de «falta la cantidad» vive DENTRO de la hoja;
  // el toast anterior no se veía sobre el diálogo y la hoja parecía callarse sin guardar.
  const [amountError, setAmountError] = useState(false);
  const changeAmount = (v: string) => {
    setAmount(v);
    setAmountError(false);
  };

  useEffect(() => {
    if (!open) return;
    setAmountError(false);
    if (defaultAmount) setAmount(defaultAmount);
    else setAmount(mode === "full" && balance > 0 ? String(balance) : "");
  }, [open, mode, balance, defaultAmount]);

  const n = Math.round((Number(amount) || 0) * 100) / 100;
  const applyToDebt = mode === "prepaid" ? Math.min(n, balance) : Math.min(n, balance);
  const leftover = Math.max(0, n - applyToDebt);
  const nextBalance = Math.max(0, balance - applyToDebt);
  const nextCredit = credit + leftover;

  const mut = useMutation({
    mutationFn: () =>
      recordPayment({
        data: {
          clientId,
          kind: mode === "prepaid" ? "prepaid" : "paid",
          amount: n,
          note:
            mode === "prepaid"
              ? "Pago por adelantado"
              : mode === "abono"
                ? "Abono"
                : "Pagado",
          method,
          tip: Math.round((Number(tip) || 0) * 100) / 100,
        },
      }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(tx("No se pudo guardar el pago", "The payment could not be saved"));
        return;
      }
      toast.success(
        mode === "prepaid"
          ? leftover > 0 && applyToDebt > 0
            ? tx(`Abono ${money(applyToDebt)} · adelanto ${money(leftover)}`, `Partial ${money(applyToDebt)} · advance ${money(leftover)}`)
            : leftover > 0
              ? tx(`Adelanto ${money(leftover)} guardado`, `Advance ${money(leftover)} saved`)
              : tx(`Abono ${money(applyToDebt)}`, `Partial ${money(applyToDebt)}`)
          : n >= balance
            ? tx(`Cobrado ${money(applyToDebt)}`, `Collected ${money(applyToDebt)}`)
            : tx(`Abono ${money(applyToDebt)} · quedan ${money(nextBalance)}`, `Partial ${money(applyToDebt)} · ${money(nextBalance)} left`),
      );
      const ids = res.paymentIds;
      push({
        label: tx(`Pago de ${name}`, `Payment from ${name}`),
        undo: async () => {
          await undoPayment({ data: { ids } });
          await invalidateLawn(qc);
        },
        redo: async () => {
          await recordPayment({
            data: {
              clientId,
              kind: mode === "prepaid" ? "prepaid" : "paid",
              amount: n,
              note: mode === "prepaid" ? "Pago por adelantado" : mode === "abono" ? "Abono" : "Pagado",
              method,
              tip: Math.round((Number(tip) || 0) * 100) / 100,
            },
          });
          await invalidateLawn(qc);
        },
      });
      await invalidateLawn(qc);
      onClose();
    },
    onError: () => toast.error(tx("No se pudo guardar el pago", "The payment could not be saved")),
  });

  const title =
    mode === "prepaid"
      ? tx(`¿Pago por adelantado de ${name}?`, `Advance payment from ${name}?`)
      : mode === "abono"
        ? tx(`¿Abono de ${name}?`, `Partial payment from ${name}?`)
        : tx(`¿Registrar ${money(n || balance)} de ${name}?`, `Record ${money(n || balance)} from ${name}?`);

  return (
    <ConfirmDialog
      open={open}
      title={title}
      description={
        <div className="grid gap-2">
          <p>
            {tx("Saldo ahora:", "Balance now:")} <span className="font-semibold text-fg">{money(balance)}</span>
            {credit > 0 ? tx(` · adelanto ${money(credit)}`, ` · advance ${money(credit)}`) : ""}
          </p>
          {mode === "prepaid" ? (
            <p>
              {tx(
                "Si debe algo, se aplica primero a la deuda. Lo que sobre queda de adelanto para cortes futuros. No se vuelve a cobrar ese monto al marcar ",
                "If they owe anything, it is applied to the debt first. The rest stays as an advance for future cuts. That amount is not collected again when you mark ",
              )}
              <strong className="text-fg">{tx("Hecho", "Done")}</strong>.
            </p>
          ) : mode === "abono" ? (
            <p>{tx("Escribe lo que te entregó. El restante se calcula solo.", "Enter what they handed you. The rest is calculated on its own.")}</p>
          ) : (
            <p>{tx("Puedes cobrar el total o cambiar la cantidad si te dieron un abono.", "You can collect the total or change the amount if they gave you a partial payment.")}</p>
          )}
          <div>
            <Label className="text-fg">{tx("Cantidad", "Amount")}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => changeAmount(e.target.value)}
            />
            <MoneyCalc value={amount} onChange={changeAmount} presets={presets} />
            {amountError ? (
              <p className="bz-msg bz-msg-error" role="alert">
                <TriangleAlert aria-hidden />
                {tx("Falta la cantidad.", "The amount is missing.")}
              </p>
            ) : null}
          </div>
          <div>
            <Label className="text-fg">{tx("Propina, si dieron de más", "Tip, if they gave extra")}</Label>
            <Input value={tip} inputMode="decimal" onChange={(e) => setTip(e.target.value)} placeholder="0" />
          </div>
          <MethodField value={method} onChange={setMethod} />
          <p className="text-xs text-muted">{tx("El medio no cambia el saldo. Sirve para cuadrar.", "The method does not change the balance. It is for matching records.")}</p>
          {n > 0 ? (
            <p className="text-sm text-fg">
              {applyToDebt > 0 ? tx(`A la deuda: ${money(applyToDebt)}. `, `To the debt: ${money(applyToDebt)}. `) : ""}
              {tx(`Quedan debiendo ${money(nextBalance)}`, `${money(nextBalance)} still owed`)}
              {leftover > 0 ? tx(` · adelanto ${money(nextCredit)}`, ` · advance ${money(nextCredit)}`) : ""}
              {mode !== "prepaid" && leftover > 0
                ? tx(
                    " (de más: se guarda como adelanto, no como segundo cobro).",
                    " (extra: it is saved as an advance, not as a second payment).",
                  )
                : "."}
            </p>
          ) : null}
        </div>
      }
      confirmLabel={
        mode === "prepaid"
          ? tx("Sí, adelanto", "Yes, advance")
          : n >= balance && balance > 0
            ? tx("Sí, cobrado", "Yes, collected")
            : tx("Sí, abono", "Yes, partial")
      }
      pending={mut.isPending}
      onConfirm={() => {
        if (n <= 0) {
          setAmountError(true);
          return;
        }
        mut.mutate();
      }}
      onCancel={onClose}
    />
  );
}
