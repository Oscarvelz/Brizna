import { Map, MapPin } from "lucide-react";
import { ConfirmLink } from "@/components/confirm-link";
import { mapsHref } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** 1.4.66 (Oscar): a client without a real address shows no address line at all (blank, spaces or bare commas count as none). */
export function hasAddress(address: string | null | undefined): address is string {
  return /[\p{L}\p{N}]/u.test(address ?? "");
}

export function AddressLine({
  address,
  className,
  compact,
  name,
}: {
  address: string;
  className?: string;
  compact?: boolean;
  name?: string;
}) {
  const tx = useTx();
  if (!hasAddress(address)) return null;
  return (
    <ConfirmLink
      href={mapsHref(address)}
      kind="maps"
      name={name}
      className={cn(
        "flex w-full items-center gap-2 rounded-md text-sm font-medium text-muted transition-colors hover:bg-sun hover:text-fg",
        compact ? "min-h-10 px-1" : "min-h-12 bg-sun px-3 text-fg",
        className,
      )}
    >
      <MapPin className="size-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate">{address}</span>
      <span className="grid size-7 shrink-0 place-items-center rounded-full text-primary" aria-label={tx("Abrir el mapa", "Open the map")}>
        <Map className="size-4" />
      </span>
    </ConfirmLink>
  );
}
