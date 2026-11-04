import { useEffect, useId, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
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
  icon,
  iconTone,
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
  /** 1.4.68: small tone chip above the title (tint + fine ring, never solid). Danger dialogs get a warning chip by default. */
  icon?: ReactNode;
  iconTone?: "primary" | "pin" | "late" | "post";
}) {
  const { t } = useI18n();
  const titleId = useId();
  const yes = confirmLabel ?? t("common.confirm");
  const no = cancelLabel ?? t("common.cancel");
  const dismiss = onDismiss ?? onCancel;
  useBackClose(open, dismiss);
  const chip = icon ?? (danger ? <TriangleAlert /> : null);
  const chipTone = iconTone ?? (icon ? "primary" : "late");

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
        className="bz-dialog relative my-auto w-full min-w-0 max-w-md bg-surface"
      >
        {chip ? (
          <span className={cn("bz-dialog-chip", `bz-dialog-chip-${chipTone}`)} aria-hidden="true">
            {chip}
          </span>
        ) : null}
        <h2 id={titleId} className="bz-dialog-title font-display">
          <span className="min-w-0 flex-1">{title}</span>
          {hint}
        </h2>
        {description ? <div className="bz-dialog-text text-muted">{emphasizeTree(description)}</div> : null}
        <div className="bz-dialog-actions">
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
              <Button type="button" variant="secondary" className="bz-dialog-quiet" onClick={onCancel} disabled={pending}>
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
              <div className={cn("bz-dialog-pair", (yes.length > 16 || no.length > 16) && "bz-dialog-pair-col")}>
                <Button type="button" variant="secondary" className="bz-dialog-quiet" onClick={onCancel} disabled={pending}>
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
