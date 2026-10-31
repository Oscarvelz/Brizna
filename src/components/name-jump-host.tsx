import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { closeNameJump, subscribeNameJump, type NameDest } from "@/components/name-jump";
import { useI18n } from "@/lib/i18n";

export function NameJumpHost() {
  const [jump, setJump] = useState<NameDest | null>(null);
  const navigate = useNavigate();
  const { locale } = useI18n();
  useEffect(() => subscribeNameJump(setJump), []);
  const term = jump?.term ?? "";
  return (
    <ConfirmDialog
      front
      open={jump != null}
      title={locale === "en" ? `Open ${term}?` : `¿Abrir ${term}?`}
      description={locale === "en" ? "That function opens in the app." : "Se abre esa función en la app."}
      confirmLabel={locale === "en" ? "Yes, open" : "Sí, abrir"}
      onConfirm={() => {
        const target = jump;
        closeNameJump();
        if (!target) return;
        void navigate({ to: target.to, search: target.search, hash: target.hash });
      }}
      onCancel={closeNameJump}
    />
  );
}
