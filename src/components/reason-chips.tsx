import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { formatDay } from "@/lib/format";
import { reasonLabel, useI18n, useTx } from "@/lib/i18n";
import { listPostponed } from "@/lib/server/lawn";
import { POSTPONE_REASONS } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ReasonChips({
  value,
  onChange,
  reasons = POSTPONE_REASONS,
  history = false,
}: {
  value: string;
  onChange: (reason: string) => void;
  reasons?: readonly string[];
  history?: boolean;
}) {
  const tx = useTx();
  const { locale } = useI18n();
  const [ask, setAsk] = useState(false);
  const [draft, setDraft] = useState("");
  const custom = value.length > 0 && !reasons.includes(value);
  const past = useQuery({
    queryKey: ["postponed", value],
    queryFn: () => listPostponed({ data: { reason: value } }),
    enabled: history && value.trim().length > 1,
  });

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {reasons.map((item) => {
          const on = item === "Otro" ? value === "Otro" || custom : value === item;
          const shown = item === "Otro" && custom ? value : reasonLabel(locale, item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => {
                if (item === "Otro") {
                  setDraft(custom ? value : "");
                  setAsk(true);
                  return;
                }
                onChange(value === item ? "" : item);
              }}
              className={cn(
                "h-9 max-w-full truncate rounded-full px-3 text-xs font-semibold",
                on ? "bg-soil text-primary-fg" : "bg-sun text-muted",
              )}
            >
              {shown}
            </button>
          );
        })}
      </div>
      {history && value.trim().length > 1 ? (
        <ul className="mt-2 grid gap-1">
          {(past.data ?? []).length === 0 ? (
            <li className="text-xs text-muted">
              {tx("Todavía no hay patios con esta razón.", "There are no yards with this reason yet.")}
            </li>
          ) : (
            past.data?.map((row) => (
              <li key={`${row.clientName}-${row.date}-${row.title}`} className="text-xs text-muted">
                <span className="font-semibold text-fg">{row.clientName}</span>
                {" · "}
                {formatDay(row.date)}
                {row.title ? ` · ${row.title}` : ""}
              </li>
            ))
          )}
        </ul>
      ) : null}
      <ConfirmDialog
        open={ask}
        title={tx("¿Por qué pospuso?", "Why was it postponed?")}
        description={
          <div className="grid gap-2">
            <p>
              {tx(
                "Puedes dejarla como Otro, o escribir una razón que no está en la lista.",
                "You can leave it as Other, or type a reason that is not on the list.",
              )}
            </p>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={tx("Viaje, portón, familia…", "Trip, gate, family…")}
              maxLength={80}
            />
          </div>
        }
        confirmLabel={draft.trim() ? tx("Usar esta razón", "Use this reason") : tx("Dejar Otro", "Leave as Other")}
        onConfirm={() => {
          onChange(draft.trim() || "Otro");
          setAsk(false);
        }}
        onCancel={() => setAsk(false)}
      />
    </>
  );
}
