import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Plus, Search, Sprout, Users, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { usePageWidth } from "@/components/app-shell";
import { formatDay, money } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { listClients } from "@/lib/server/lawn";
import { todayISO } from "@/lib/dates";
import type { ClientRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Lens = "all" | "owing" | "late";

/**
 * Hoy on a large screen: the page column splits into the day (left) and the clients (right).
 * Phones and narrow split windows get the old single column, in the old order.
 *   head  = date, notes, tiles   tools = hours, rain, move buttons   list = the day board
 */
export function HoyLayout({
  head,
  tools,
  wideTools,
  list,
  extra,
  empty,
}: {
  head: ReactNode;
  tools: ReactNode;
  /** The same tools arranged for a large screen (hours beside the day's changes). */
  wideTools: ReactNode;
  list: ReactNode;
  /** Shown under the tools (the rain messages), full width of the day column. */
  extra?: ReactNode;
  /** The big "start with a client" card: phone only (the panel shows its own when wide). */
  empty?: ReactNode;
}) {
  const width = usePageWidth();
  if (width < 720) {
    return (
      <>
        {head}
        {empty}
        {tools}
        {extra}
        {list}
      </>
    );
  }
  const roomy = width >= 940;
  return (
    <div className={cn("bz-hoy", roomy ? "is-roomy" : "is-mid")}>
      <div className="bz-hoy-head">{head}</div>
      <div className="bz-hoy-tools">{wideTools}</div>
      {extra ? <div className="bz-hoy-extra">{extra}</div> : null}
      <div className="bz-hoy-list">{list}</div>
      <aside className="bz-hoy-side">
        <ClientsPanel />
      </aside>
    </div>
  );
}

function ClientsPanel() {
  const tx = useTx();
  const [q, setQ] = useState("");
  const [lens, setLens] = useState<Lens>("all");
  const query = useQuery({
    queryKey: ["clients", { q: "", sort: "name", filter: "active", panel: true }],
    queryFn: () => listClients({ data: { q: "", sort: "name", filter: "active" } }),
    staleTime: 15_000,
  });
  const all = query.data ?? [];
  const counts = useMemo(
    () => ({
      all: all.length,
      owing: all.filter((c) => c.balance > 0.004).length,
      late: all.filter((c) => c.overdueDate).length,
    }),
    [all],
  );
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = all;
    if (lens === "owing") rows = rows.filter((c) => c.balance > 0.004).sort((a, b) => b.balance - a.balance);
    if (lens === "late") rows = rows.filter((c) => c.overdueDate).sort((a, b) => (a.overdueDate ?? "").localeCompare(b.overdueDate ?? ""));
    if (needle) {
      rows = rows.filter(
        (c) => c.name.toLowerCase().includes(needle) || (c.address ?? "").toLowerCase().includes(needle) || (c.phone ?? "").includes(needle),
      );
    }
    return rows;
  }, [all, q, lens]);

  const lenses: { id: Lens; label: string; n: number; tone: string }[] = [
    { id: "all", label: tx("Todos", "All"), n: counts.all, tone: "is-all" },
    { id: "owing", label: tx("Deben", "Owe"), n: counts.owing, tone: "is-owing" },
    { id: "late", label: tx("Atrasados", "Late"), n: counts.late, tone: "is-late" },
  ];

  return (
    <section className="bz-cp rounded-xl bg-surface shadow-card" aria-label={tx("Clientes", "Clients")}>
      <header className="bz-cp-head">
        <div className="bz-cp-title">
          <Users className="size-[1.05rem] text-primary" aria-hidden />
          <h2>{tx("Clientes", "Clients")}</h2>
          {query.data ? <span className="bz-cp-count">{counts.all}</span> : null}
        </div>
        <Link to="/clientes" className="bz-cp-all">
          {tx("Ver todos", "See all")}
        </Link>
        <Link to="/nuevo" className="bz-cp-add" aria-label={tx("Añadir cliente", "Add client")} title={tx("Añadir cliente", "Add client")}>
          <Plus className="size-[1.1rem]" />
        </Link>
      </header>

      {query.data && counts.all === 0 ? (
        <PanelEmpty />
      ) : (
        <>
          <div className="bz-cp-tools">
            <div className="bz-tsearch bz-cp-search">
              <Search className="bz-tsearch-icon" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && q) {
                    e.preventDefault();
                    e.stopPropagation();
                    setQ("");
                  }
                }}
                placeholder={tx("Buscar nombre o calle", "Search name or street")}
                aria-label={tx("Buscar cliente", "Search client")}
                className="bz-cp-input"
              />
              {q ? (
                <button type="button" className="bz-tsearch-x" aria-label={tx("Borrar búsqueda", "Clear search")} onClick={() => setQ("")}>
                  <X aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="bz-cp-lenses" role="tablist" aria-label={tx("Mostrar", "Show")}>
              {lenses.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={lens === l.id}
                  onClick={() => setLens(l.id)}
                  className={cn("bz-cp-lens", l.tone, lens === l.id && "is-on")}
                >
                  {l.label}
                  <span>{l.n}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="bz-cp-scroll">
            {query.isLoading ? (
              <div className="grid gap-2 p-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <p className="bz-cp-none">
                {q.trim()
                  ? tx("Nadie con ese nombre o calle.", "No one with that name or street.")
                  : lens === "owing"
                    ? tx("Nadie te debe ahora.", "No one owes you now.")
                    : tx("Nadie atrasado.", "No one is late.")}
              </p>
            ) : (
              <ul className="bz-cp-list">
                {shown.map((c) => (
                  <ClientLine key={c.id} client={c} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ClientLine({ client }: { client: ClientRow }) {
  const tx = useTx();
  const today = todayISO();
  const late = Boolean(client.overdueDate);
  const owes = client.balance > 0.004;
  const tone = late ? "late" : owes ? "money" : client.servicePaused ? "hold" : client.kind === "one_time" ? "pending" : "today";
  let sub: string;
  if (late) sub = `${tx("Atrasado desde", "Late since")} ${formatDay(client.overdueDate as string)}`;
  else if (client.servicePaused) sub = tx("Servicio en pausa", "Service paused");
  else if (client.nextCutDate === today) sub = tx("Le toca hoy", "Due today");
  else if (client.nextCutDate) sub = `${tx("Próximo corte", "Next cut")} ${formatDay(client.nextCutDate)}`;
  else sub = client.address?.trim() || tx("Sin corte en agenda", "No cut scheduled");
  const initials = client.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <li>
      <Link to="/clientes/$id" params={{ id: String(client.id) }} className={cn("bz-cp-row", `is-${tone}`)}>
        <span className="bz-cp-av" aria-hidden>
          {initials || "·"}
        </span>
        <span className="bz-cp-main">
          <span className="bz-cp-name">{client.name}</span>
          <span className="bz-cp-sub">{sub}</span>
        </span>
        {owes ? (
          <span className="bz-cp-chip is-money">{money(client.balance)}</span>
        ) : client.nextCutDate === today ? (
          <span className="bz-cp-chip is-today">{tx("Hoy", "Today")}</span>
        ) : (
          <span className="bz-cp-price">{money(client.pricePerCut)}</span>
        )}
        <ChevronRight className="bz-cp-go" aria-hidden />
      </Link>
    </li>
  );
}

function PanelEmpty() {
  const tx = useTx();
  return (
    <div className="bz-cp-empty">
      <span className="bz-cp-empty-mark" aria-hidden>
        <Sprout className="size-7" />
      </span>
      <h3>{tx("Empieza por un cliente", "Start with a client")}</h3>
      <p>
        {tx(
          "Añade el patio, el precio y el día de inicio. La app arma sola la agenda de cada mes.",
          "Add the yard, the price, and the start day. The app builds each month's schedule on its own.",
        )}
      </p>
      <Link to="/nuevo" className="bz-cp-empty-btn">
        <Plus className="size-4" />
        {tx("Añadir primer cliente", "Add the first client")}
      </Link>
      <ol className="bz-cp-steps">
        <li>
          <b>1</b>
          {tx("Nombre, calle y teléfono", "Name, street and phone")}
        </li>
        <li>
          <b>2</b>
          {tx("Precio y cada cuánto se corta", "Price and how often you cut")}
        </li>
        <li>
          <b>3</b>
          {tx("Sus cortes salen solos aquí en Hoy", "Their cuts show up here in Today")}
        </li>
      </ol>
    </div>
  );
}
