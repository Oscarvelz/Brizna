import { MapPin, Phone } from "lucide-react";
import { ConfirmLink } from "@/components/confirm-link";
import { MessageComposer, WhatsAppButton } from "@/components/message-composer";
import { mapsHref, telHref } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Call, text, WhatsApp, and map, without printing the number or the street. */
export function ContactIcons({
  phone,
  address,
  name,
  tight,
  variant = "all",
  className,
}: {
  phone?: string | null;
  address?: string | null;
  name: string;
  tight?: boolean;
  variant?: "all" | "some";
  className?: string;
}) {
  const tx = useTx();
  const dial = phone?.trim() ?? "";
  const street = address?.trim() ?? "";
  if (!dial && !street) return null;
  const box = cn("bz-tone grid shrink-0 place-items-center rounded-sm", tight ? "size-8" : "size-10");
  const icon = tight ? "size-3.5" : "size-4";
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {dial ? (
        <ConfirmLink href={telHref(dial)} kind="call" name={name} className={cn(box, "bz-tone-call")}>
          <Phone className={icon} />
          <span className="sr-only">{tx("Llamar", "Call")}</span>
        </ConfirmLink>
      ) : null}
      {dial && variant === "all" ? <MessageComposer phone={dial} name={name} compact tight={tight} /> : null}
      {dial && variant === "all" ? <WhatsAppButton phone={dial} name={name} tight={tight} /> : null}
      {street ? (
        <ConfirmLink href={mapsHref(street)} kind="maps" name={name} className={cn(box, "bz-tone-map")}>
          <MapPin className={icon} />
          <span className="sr-only">{tx("Mapa", "Map")}</span>
        </ConfirmLink>
      ) : null}
    </div>
  );
}
