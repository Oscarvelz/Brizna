import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useTx } from "@/lib/i18n";
import { readStoredLocale } from "@/lib/theme";
import { PAY_METHODS } from "@/lib/types";
import { cn } from "@/lib/utils";

const EN_METHOD: Record<string, string> = {
  Efectivo: "Cash",
  Cheque: "Check",
  Otro: "Other",
  Zelle: "Zelle",
};

export function methodLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const en = readStoredLocale() === "en";
  if (value === "otro") return en ? "Other" : "Otro";
  if (value.startsWith("otro:")) return value.slice(5) || (en ? "Other" : "Otro");
  const label = PAY_METHODS.find((m) => m.id === value)?.label ?? value;
  return en ? (EN_METHOD[label] ?? label) : label;
}

export function MethodField({
  value,
  onChange,
}: {
  value: string;
  onChange: (method: string) => void;
}) {
  const tx = useTx();
  const [ask, setAsk] = useState(false);
  const [draft, setDraft] = useState("");
  const custom = value.startsWith("otro:");

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {PAY_METHODS.map((item) => {
          const on = item.id === "otro" ? value === "otro" || custom : value === item.id;
          const label = item.id === "otro" && custom ? value.slice(5) : tx(item.label, EN_METHOD[item.label] ?? item.label);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "otro") {
                  setDraft(custom ? value.slice(5) : "");
                  setAsk(true);
                  return;
                }
                onChange(value === item.id ? "" : item.id);
              }}
              className={cn(
                "h-9 rounded-full px-3 text-xs font-semibold",
                on ? "bz-pick" : "bg-sun text-muted",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <ConfirmDialog
        open={ask}
        title={tx("Otro medio de pago", "Other payment method")}
        description={
          <div className="grid gap-2">
            <p>
              {tx(
                "Puedes dejarlo como Otro, o escribir el nombre. No cambia el saldo.",
                "You can leave it as Other, or type the name. The balance does not change.",
              )}
            </p>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="CashApp, Venmo…"
              maxLength={40}
            />
          </div>
        }
        confirmLabel={draft.trim() ? tx("Usar este nombre", "Use this name") : tx("Dejar Otro", "Leave as Other")}
        onConfirm={() => {
          const text = draft.trim();
          onChange(text ? `otro:${text}` : "otro");
          setAsk(false);
        }}
        onCancel={() => setAsk(false)}
      />
    </>
  );
}
