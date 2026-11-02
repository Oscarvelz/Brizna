import { useEffect, useId, type ReactNode } from "react";
import { useBackClose } from "@/lib/back-close";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useI18n, emphasizeTree } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger,
  pending,
  onConfirm,
  onCancel,
  onDismiss,
  extraLabel,
  onExtra,
  altLabel,
  onAlt,
  hint,
  stack,
  confirmTone,
  front,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  hint?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onDismiss?: () => void;
  extraLabel?: string;
  onExtra?: () => void;
  altLabel?: string;
  onAlt?: () => void;
  stack?: boolean;
  confirmTone?: "paid" | "owe" | "abono";
  front?: boolean;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const yes = confirmLabel ?? t("common.confirm");
  const no = cancelLabel ?? t("common.cancel");
  const dismiss = onDismiss ?? onCancel;
  useBackClose(open, dismiss);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={cn("fixed inset-0 grid place-items-end overflow-y-auto p-3 sm:place-items-center sm:p-4", front ? "z-[100]" : "z-[80]")}>
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bz-scrim"
        onClick={dismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative my-auto w-full min-w-0 max-w-md rounded-xl bg-surface p-4 shadow-card sm:p-5"
      >
        <h2 id={titleId} className="flex items-start gap-2 font-display text-xl font-semibold">
          <span className="min-w-0 flex-1">{title}</span>
          {hint}
        </h2>
        {description ? <div className="mt-2 text-sm text-muted">{emphasizeTree(description)}</div> : null}
        <div className="mt-5 grid gap-2">
          {stack ? (
            <>
              <Button type="button" onClick={onConfirm} disabled={pending} className="btn-hecho-paid">
                {pending ? "…" : yes}
              </Button>
              {extraLabel && onExtra ? (
                <Button type="button" onClick={onExtra} disabled={pending} className="btn-hecho-owe">
                  {extraLabel}
                </Button>
              ) : null}
              {altLabel && onAlt ? (
                <Button type="button" onClick={onAlt} disabled={pending} className="btn-hecho-abono">
                  {altLabel}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
                {no}
              </Button>
            </>
          ) : (
            <>
              {extraLabel && onExtra ? (
                <Button
                  type="button"
                  onClick={onExtra}
                  disabled={pending}
                  className="bg-pending text-primary-fg hover:bg-pending"
                >
                  {extraLabel}
                </Button>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
                  {no}
                </Button>
                <Button
                  type="button"
                  variant={danger ? "danger" : "primary"}
                  onClick={onConfirm}
                  disabled={pending}
                  className={cn(
                    danger && "bg-late",
                    confirmTone === "paid" && "btn-hecho-paid",
                    confirmTone === "owe" && "btn-hecho-owe",
                    confirmTone === "abono" && "btn-hecho-abono",
                  )}
                >
                  {pending ? t("common.wait") : yes}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
