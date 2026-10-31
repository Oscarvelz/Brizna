import { useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { DEFAULT_BUSINESS_NAME, PRODUCT_NAME } from "@/lib/format";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isPending, error } = useCurrentUserState();
  const [holding, setHolding] = useState(true);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const hold = window.setTimeout(() => setHolding(false), 500);
    const late = window.setTimeout(() => setSlow(true), 12000);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(late);
    };
  }, [user, isPending]);

  if (user) return <>{children}</>;
  if (!isPending && !holding && !error && !slow) return <RedirectToSignIn />;
  if (error || slow) return <ConnectRetry />;
  return <AppSkeleton />;
}

function BrandLine() {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <p className="shrink-0 font-display text-base font-semibold leading-none">{PRODUCT_NAME}</p>
      <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
      <p className="min-w-0 truncate font-display text-sm font-medium text-muted">{DEFAULT_BUSINESS_NAME}</p>
    </div>
  );
}

function ConnectRetry() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex h-16 items-center gap-3 px-4">
        <BrandMark className="size-9" />
        <BrandLine />
      </header>
      <div className="grid flex-1 content-start gap-3 p-4">
        <p className="text-sm text-muted">La conexión tardó demasiado. Prueba otra vez.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-11 w-fit rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

export function AppSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex h-16 items-center gap-3 px-4">
        <BrandMark className="size-9" />
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold leading-tight">{PRODUCT_NAME}</p>
          <p className="text-xs text-muted">Cargando agenda…</p>
        </div>
      </header>
      <div className="grid flex-1 gap-3 p-4">
        <div className="h-28 rounded-xl bg-surface-2" />
        <div className="h-24 rounded-xl bg-surface-2" />
        <div className="h-24 rounded-xl bg-surface-2" />
      </div>
    </div>
  );
}
