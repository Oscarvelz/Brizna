import { Map, MapPin } from "lucide-react";
import { ConfirmLink } from "@/components/confirm-link";
import { mapsHref } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** 1.4.66 (Oscar): a client without a real address shows no address line at all (blank, spaces or bare commas count as none). */
export function hasAddress(address: string | null | undefined): address is string {
  return /[\p{L}\p{N}]/u.test(address ?? "");
}

/** Street, then "City, ST zip" kept together, so a long address breaks at the comma instead of mid-city. */
function addressParts(address: string) {
  const text = address.trim();
  const cut = text.indexOf(",");
  if (cut < 1) return text;
  const rest = text.slice(cut + 1).trim();
  if (!rest || rest.length > 26) return text;
  return (
    <>
      {text.slice(0, cut + 1)} <span className="whitespace-nowrap">{rest}</span>
    </>
  );
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
        // 1.4.69 (Oscar): never "…". A long address wraps to a second line; icons stay on the first line.
        "bz-addr flex w-full items-start gap-2 rounded-md text-sm font-medium text-muted transition-colors hover:bg-sun hover:text-fg",
        compact ? "min-h-10 px-1 py-2" : "min-h-12 bg-sun px-3 py-3 text-fg",
        className,
      )}
    >
      <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="bz-addr-text min-w-0 flex-1">{addressParts(address)}</span>
      <span className="-my-1 grid size-7 shrink-0 place-items-center rounded-full text-primary" aria-label={tx("Abrir el mapa", "Open the map")}>
        <Map className="size-4" />
      </span>
    </ConfirmLink>
  );
}
