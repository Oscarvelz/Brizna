import { useQuery } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { NameLink } from "@/components/name-jump";
import { formatDay } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { mondayAfter, rareKind, type RareKind } from "@/lib/rare-day";
import { getSettings, getWeekOff } from "@/lib/server/lawn";

export function useRareDay() {
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const off = useQuery({ queryKey: ["week-off"], queryFn: () => getWeekOff() });
  return {
    kindOf(iso: string): RareKind | null {
      return rareKind(iso, settings.data?.excludedWeekdays ?? [], off.data?.offDates ?? []);
    },
  };
}

export function OffDayDialog({
  iso,
  kind,
  onKeep,
  onMonday,
  onClose,
  pending,
}: {
  iso: string | null;
  kind: RareKind | null;
  onKeep: () => void;
  onMonday?: () => void;
  onClose: () => void;
  pending?: boolean;
}) {
  const tx = useTx();
  const sunday = kind === "sunday";
  return (
    <ConfirmDialog
      open={Boolean(iso && kind)}
      presentConfirm="agenda-dia-raro"
      title={
        sunday
          ? tx("¿Trabajar este domingo?", "Work this Sunday?")
          : tx("¿Añadir trabajo en un día libre?", "Add work on a day off?")
      }
      description={
        <div className="grid gap-2">
          <p>
            {sunday
              ? tx(
                  `${iso ? formatDay(iso, "EEEE d 'de' MMMM") : "Este domingo"} casi nunca se trabaja. Si lo dejas, cuenta como un día hábil de más. También puedes pasarlo al lunes.`,
                  `${iso ? formatDay(iso, "EEEE, MMMM d") : "This Sunday"} is almost never a work day. If you keep it, it counts as an extra business day. You can also move it to Monday.`,
                )
              : tx(
                  "Esa fecha está marcada para no trabajar. Si sigues, el trabajo queda ese día y cuenta como día hábil.",
                  "That date is marked as a day off. If you continue, the work stays that day and counts as a business day.",
                )}
          </p>
          <p>
            {tx("Viene de ", "This comes from ")}
            <NameLink term={tx("Días libres", "Days off this week")} />
            .
          </p>
        </div>
      }
      confirmLabel={sunday ? tx("Sí, este domingo", "Yes, this Sunday") : tx("Sí, ese día", "Yes, that day")}
      extraLabel={sunday && onMonday ? tx("Pasar al lunes", "Move to Monday") : undefined}
      onExtra={sunday ? onMonday : undefined}
      pending={pending}
      onConfirm={onKeep}
      onCancel={onClose}
    />
  );
}

export function shiftToMonday(iso: string): string {
  return mondayAfter(iso);
}
