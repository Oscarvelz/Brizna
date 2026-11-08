import { MapPin } from "lucide-react";
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
  oneLine,
}: {
  address: string;
  className?: string;
  compact?: boolean;
  name?: string;
  /** 1.5.12 (spec 2026-11-04): the work card shows the address on ONE line, no breaks; a long one truncates. */
  oneLine?: boolean;
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
        "bz-addr flex w-full gap-2 rounded-md text-sm font-medium text-muted transition-colors hover:bg-sun hover:text-fg",
        oneLine ? "items-center is-oneline" : "items-start",
        compact ? "min-h-10 px-1 py-2" : "bz-inset min-h-11 items-center bg-sun py-1.5 pr-1.5 pl-3 text-fg",
        className,
      )}
    >
      <MapPin className={cn("size-4 shrink-0 text-primary", compact && !oneLine && "mt-0.5")} />
      <span className={cn("bz-addr-text min-w-0 flex-1", oneLine && "truncate")}>{oneLine ? address.trim() : addressParts(address)}</span>
      {/* 1.4.82 (Oscar): the pin on the left already says "map"; no second map icon, so the address gets the full width and fits one line when it can. */}
      <span className="sr-only">{tx("Abrir el mapa", "Open the map")}</span>
    </ConfirmLink>
  );
}
