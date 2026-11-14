import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FlaskConical, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useI18n, useTx } from "@/lib/i18n";
import { requestFocus } from "@/lib/manual/nav";
import { getSampleState, loadSample, removeSample } from "@/lib/server/sample";
import { cn } from "@/lib/utils";

export function useSampleState() {
  return useQuery({ queryKey: ["sample-state"], queryFn: () => getSampleState(), staleTime: 30_000 });
}

async function refreshAll(qc: ReturnType<typeof useQueryClient>) {
  try { new BroadcastChannel("ols-live").postMessage({ all: true }); } catch { /* ignore */ }
  await qc.invalidateQueries();
}

/** Load / remove with the Brizna confirm dialog. */
export function useSampleActions() {
  const tx = useTx();
  const { locale } = useI18n();
  const qc = useQueryClient();
  const [ask, setAsk] = useState<null | "load" | "remove">(null);
  const load = useMutation({
    mutationFn: () => loadSample({ data: { locale: locale === "en" ? "en" : "es" } }),
    onSuccess: async (r) => {
      setAsk(null);
      await refreshAll(qc);
      if (r.already) toast(tx("El ejemplo ya está cargado", "The sample is already loaded"));
      else toast.success(tx(`Ejemplo listo: ${r.clients} clientes`, `Sample ready: ${r.clients} clients`));
    },
    onError: () => toast.error(tx("No se pudo cargar el ejemplo", "Could not load the sample")),
  });
  const remove = useMutation({
    mutationFn: () => removeSample(),
    onSuccess: async (r) => {
      setAsk(null);
      await refreshAll(qc);
      toast.success(r.clients ? tx("Ejemplo quitado", "Sample removed") : tx("No había ejemplo", "There was no sample"));
    },
    onError: () => toast.error(tx("No se pudo quitar el ejemplo", "Could not remove the sample")),
  });
  const dialog = (
    <>
      <ConfirmDialog
        open={ask === "load"}
        title={tx("¿Cargar el ejemplo?", "Load the sample?")}
        description={tx(
          "Añade 14 clientes de ejemplo con dos meses de cortes, cobros y horas. Lo tuyo no se toca, y se quita entero con Quitar ejemplo.",
          "Adds 14 sample clients with two months of cuts, payments and hours. Your own data is not touched, and it all goes away with Remove sample.",
        )}
        confirmLabel={load.isPending ? tx("Cargando…", "Loading…") : tx("Cargar ejemplo", "Load sample")}
        cancelLabel={tx("Ahora no", "Not now")}
        pending={load.isPending}
        onConfirm={() => load.mutate()}
        onCancel={() => { if (!load.isPending) setAsk(null); }}
      />
      <ConfirmDialog
        open={ask === "remove"}
        title={tx("¿Quitar el ejemplo?", "Remove the sample?")}
        description={tx(
          "Se borran solo los clientes de ejemplo, con sus cortes, cobros, horas y notas. Los clientes que añadiste tú se quedan.",
          "Only the sample clients go, with their cuts, payments, hours and notes. The clients you added yourself stay.",
        )}
        confirmLabel={remove.isPending ? tx("Quitando…", "Removing…") : tx("Quitar ejemplo", "Remove sample")}
        cancelLabel={tx("Cancelar", "Cancel")}
        danger
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => { if (!remove.isPending) setAsk(null); }}
      />
    </>
  );
  return { ask: setAsk, dialog, loading: load.isPending, removing: remove.isPending };
}

/** Ajustes, Datos de ejemplo. */
export function SampleSettings() {
  const tx = useTx();
  const state = useSampleState();
  const { ask, dialog, loading, removing } = useSampleActions();
  const on = Boolean(state.data?.loaded);
  return (
    <div>
      <p className="text-sm text-muted">
        {tx(
          "Un negocio de ejemplo para ver la app en acción.",
          "A sample business to see the app in action.",
        )}
        <br />
        {tx("Se quita entero; lo tuyo se queda.", "It all comes off; your data stays.")}
      </p>
      <div className="aj-nums mt-3">
        <div className="aj-num">
          <div className="min-w-0">
            <p className="aj-num-label">{on ? tx("Ejemplo cargado", "Sample loaded") : tx("Sin ejemplo", "No sample")}</p>
            <p className="aj-num-sub">
              {on
                ? tx(`${state.data?.sample ?? 0} clientes de ejemplo`, `${state.data?.sample ?? 0} sample clients`)
                : tx("14 clientes, dos meses de historia", "14 clients, two months of history")}
            </p>
          </div>
          {on ? <SampleChip static /> : null}
        </div>
      </div>
      <div className="bz-sample-acts mt-3">
        <button
          type="button"
          className="bz-sample-btn is-load"
          disabled={on || loading || state.isLoading}
          onClick={() => ask("load")}
        >
          <Sparkles className="size-[1.05rem]" aria-hidden />
          {tx("Cargar ejemplo", "Load sample")}
        </button>
        <button
          type="button"
          className="bz-sample-btn is-remove"
          data-present="ejemplo-quitar"
          disabled={!on || removing}
          onClick={() => ask("remove")}
        >
          <Trash2 className="size-[1.05rem]" aria-hidden />
          {tx("Quitar ejemplo", "Remove sample")}
        </button>
      </div>
      {dialog}
    </div>
  );
}

/** The secondary action under an empty state: Ver un ejemplo. */
export function SampleTryButton({ className }: { className?: string }) {
  const tx = useTx();
  const state = useSampleState();
  const { ask, dialog } = useSampleActions();
  if (state.data?.loaded) return null;
  return (
    <>
      <button type="button" className={cn("bz-sample-try", className)} onClick={() => ask("load")}>
        <Sparkles className="size-4" aria-hidden />
        {tx("Ver un ejemplo", "Try a sample")}
      </button>
      {dialog}
    </>
  );
}

/** Small "Ejemplo" mark while sample data is loaded; opens Ajustes, Datos de ejemplo. */
export function SampleChip({ static: still = false, className }: { static?: boolean; className?: string }) {
  const tx = useTx();
  const navigate = useNavigate();
  const state = useSampleState();
  if (!still && !state.data?.loaded) return null;
  const body = (
    <>
      <FlaskConical className="size-3" aria-hidden />
      {tx("Ejemplo", "Sample")}
    </>
  );
  if (still) return <span className={cn("bz-sample-chip", className)}>{body}</span>;
  return (
    <button
      type="button"
      className={cn("bz-sample-chip", className)}
      title={tx("Datos de ejemplo cargados", "Sample data loaded")}
      onClick={() => {
        requestFocus({ id: "aj-ejemplo", path: "/ajustes" });
        void navigate({ to: "/ajustes" });
      }}
    >
      {body}
    </button>
  );
}
