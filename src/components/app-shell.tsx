import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  ArrowUpDown,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Home,
  LayoutGrid,
  LogOut,
  NotebookPen,
  PictureInPicture2,
  Rows2,
  Settings,
  Search,
  Users,
  X,
} from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Hint } from "@/components/hint";
import { OfflineBanner } from "@/components/offline-banner";
import { BackupWatch } from "@/components/backup-watch";
import { RequireAuth } from "@/components/require-auth";
import { UndoBar } from "@/components/undo-bar";
import { useUndo } from "@/lib/undo";
import { Input } from "@/components/ui/input";
import { signOut, authEnabled } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { DEFAULT_BUSINESS_NAME, PRODUCT_NAME } from "@/lib/format";
import { getSettings, saveBackupNow, updateSettings } from "@/lib/server/lawn";
import { useI18n, useTx } from "@/lib/i18n";
import {
  applyLocale,
  ensureAppearance,
  readStoredBusinessName,
  storeBusinessName,
} from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useScrollBars } from "@/lib/use-scroll-bars";
import {
  readTabletEnabled,
  readTabletLayout,
  tabletTabLabel,
  writeTabletLayout,
  TABLET_TABS,
  type TabletLayout,
  type TabletTab,
} from "@/lib/tablet-mode";
import { PaneView, usePane } from "@/lib/pane-context";
import { useFloatState } from "@/components/float-window";

const nav = [
  { to: "/", label: "nav.today", icon: Home },
  { to: "/agenda", label: "nav.agenda", icon: CalendarDays },
  { to: "/clientes", label: "nav.clients", icon: Users },
  { to: "/cobros", label: "nav.payments", icon: CircleDollarSign },
  { to: "/estadisticas", label: "nav.stats", icon: BarChart3 },
] as const;

type ShellTo = "/" | "/clientes" | "/agenda" | "/cobros" | "/estadisticas" | "/ajustes" | "/notas" | "/imprimir";

export function TitleSearch({
  open,
  onToggle,
  value,
  onChange,
  placeholder,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      {open ? (
        <Input
          value={value}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="h-10 w-[9.5rem] max-w-[42vw] sm:w-56"
        />
      ) : null}
      <button
        type="button"
        aria-pressed={open}
        aria-label={label}
        onClick={onToggle}
        className="grid size-10 shrink-0 place-items-center rounded-full text-fg"
      >
        <Search className="size-5" />
      </button>
    </div>
  );
}

export function AppShell({
  title,
  children,
  action,
  titleExtra,
  titleFull,
  titleTight,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  titleExtra?: ReactNode;
  titleFull?: boolean;
  titleTight?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const pane = usePane();
  const embedded = pane !== null;
  const [float, saveFloat] = useFloatState();
  const [wide, setWide] = useState(false);
  const [tabletOn, setTabletOn] = useState(true);
  const [board, setBoard] = useState<TabletLayout>({ count: 1, flow: "side", slots: ["/", "/agenda", "/clientes", "/cobros", "/estadisticas"], phone: false, ratio: 0.5 });
  const [boardOpen, setBoardOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
  const [dockEl, setDockEl] = useState<HTMLElement | null>(null);
  useScrollBars({
    scroller: typeof window === "undefined" ? (null as unknown as Window) : window,
    header: headerEl,
    dock: dockEl,
  });
  const [activePane, setActivePane] = useState(0);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const tabs = ["/", "/agenda", "/clientes", "/cobros", "/estadisticas"] as const;
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const { t, locale, setLocale } = useI18n();
  const tx = useTx();
  const businessName = settingsQ.data?.businessName || readStoredBusinessName(DEFAULT_BUSINESS_NAME);

  useEffect(() => {
    const full = { h: window.innerHeight };
    const vv = window.visualViewport;
    const check = () => {
      const h = vv?.height ?? window.innerHeight;
      if (h > full.h) full.h = h;
      setKeyboard(full.h - h > 140);
    };
    check();
    vv?.addEventListener("resize", check);
    window.addEventListener("resize", check);
    return () => {
      vv?.removeEventListener("resize", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  useEffect(() => {
    if (!settingsQ.data) return;
    ensureAppearance(settingsQ.data.theme, settingsQ.data.palette);
    if (settingsQ.data.locale !== locale) setLocale(settingsQ.data.locale);
    storeBusinessName(settingsQ.data.businessName);
  }, [settingsQ.data, locale, setLocale]);

  useEffect(() => {
    ensureAppearance();
    const tick = () => ensureAppearance();
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  useLayoutEffect(() => {
    const sync = () => {
      setWide(window.matchMedia("(min-width: 1024px)").matches);
      setTabletOn(readTabletEnabled());
      setBoard(readTabletLayout());
    };
    sync();
    window.addEventListener("ols-tablet", sync);
    const media = window.matchMedia("(min-width: 1024px)");
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener("ols-tablet", sync);
      media.removeEventListener("change", sync);
    };
  }, []);

  const onBoard = (TABLET_TABS as readonly string[]).includes(pathname);
  const phoneSplit = tabletOn && !wide && !embedded && board.phone === true && onBoard;
  const split = !embedded && tabletOn && onBoard && (phoneSplit || (wide && board.count > 1));
  const flow = phoneSplit ? "stack" : "side";
  const paneCount = phoneSplit ? 2 : board.count;
  const cols = !split ? 1 : flow === "stack" ? 1 : paneCount;
  const slotted = board.slots.slice(0, paneCount);
  const visible = slotted as TabletTab[];
  const bare = embedded || split;
  const tunable = split && paneCount === 2;
  const savedShare = flow === "stack" ? board.ratio : board.sideRatio;
  const ratio = dragRatio ?? (typeof savedShare === "number" ? savedShare : 0.5);

  function closeFloat() {
    saveFloat({ ...float, open: false, min: false });
  }
  /** Same as Faro: off opens it; on folds it to the bubble or brings it back. */
  function foldFloat() {
    if (float.open) {
      if (float.min) saveFloat({ ...float, min: false });
      else saveFloat({ ...float, min: true, bx: Math.max(6, Math.min(float.x + float.w - 56, window.innerWidth - 62)), by: Math.max(6, float.y) });
      return;
    }
    toggleFloat();
  }
  function toggleFloat() {
    if (float.open) {
      saveFloat({ ...float, open: false, min: false });
      return;
    }
    // Open on a different tab than the one in front, so the window adds something.
    const here = (TABLET_TABS as readonly string[]).includes(pathname) ? (pathname as TabletTab) : "/";
    const path = float.path === here ? (here === "/agenda" ? "/" : "/agenda") : float.path;
    saveFloat({ ...float, open: true, min: false, path });
  }

  function saveBoard(next: TabletLayout) {
    setBoard(next);
    writeTabletLayout(next);
  }

  function openTab(tab: TabletTab) {
    if (!split) {
      void navigate({ to: tab });
      return;
    }
    const index = Math.min(activePane, paneCount - 1);
    assignPane(index < 0 ? 0 : index, tab);
  }

  function assignPane(index: number, tab: TabletTab) {
    const next = [...board.slots];
    if (!next[index] || next[index] === tab) return;
    next[index] = tab;
    setActivePane(index);
    saveBoard({ ...board, slots: next });
  }

  function swapPane(index: number, delta: number) {
    const limit = paneCount;
    const other = index + delta;
    if (other < 0 || other >= limit) return;
    const next = [...board.slots];
    const a = next[index];
    const b = next[other];
    if (!a || !b) return;
    next[index] = b;
    next[other] = a;
    saveBoard({ ...board, slots: next });
  }

  useEffect(() => {
    if (!pane) return;
    const tab = (TABLET_TABS as readonly string[]).find((item) => (item === "/" ? pathname === "/" : pathname === item || pathname.startsWith(`${item}/`)));
    if (tab) pane.onPath(tab as TabletTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (embedded) return;
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (/^[1-5]$/.test(event.key)) {
        event.preventDefault();
        const tab = tabs[Number(event.key) - 1];
        if (tab) openTab(tab);
        return;
      }
      if (event.key === "\\" || event.key === "|") {
        event.preventDefault();
        if (wide) saveBoard({ ...board, count: board.count > 1 ? 1 : 2 });
        else saveBoard({ ...board, phone: !board.phone });
        return;
      }
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        toggleFloat();
        return;
      }
      if (!event.shiftKey || !split) return;
      const index = Math.max(0, visible.indexOf(pathname as TabletTab));
      if (event.key === "ArrowUp") {
        event.preventDefault();
        swapPane(index, -cols);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        swapPane(index, cols);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        swapPane(index, -1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        swapPane(index, 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const column = (index: number) => (
        <div
          key="live"
          className={cn(
            "flex min-w-0 flex-col",
            embedded ? "min-h-full pb-0" : split ? "min-h-0 flex-1 overflow-hidden" : keyboard ? "min-h-dvh pb-2 lg:pb-0" : "min-h-dvh pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0",
          )}
          onTouchStart={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("input, textarea, select, [contenteditable='true'], [data-no-swipe]")) return;
            const touch = e.changedTouches[0];
            if (!touch) return;
            swipe.current = { x: touch.clientX, y: touch.clientY };
          }}
          onTouchEnd={(e) => {
            if (!swipe.current) return;
            const touch = e.changedTouches[0];
            const start = swipe.current;
            swipe.current = null;
            if (!touch) return;
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
            const index = tabs.indexOf(pathname as (typeof tabs)[number]);
            if (index < 0) return;
            const next = dx < 0 ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
            void navigate({ to: tabs[next] });
          }}
        >
          <header
            ref={setHeaderEl}
            className={cn(
              "pod-header sticky top-0 z-30 border-b border-border/70 bg-bg px-3 pb-2 print:hidden sm:px-5 lg:px-6",
              split || embedded ? "pt-2" : "pt-[calc(0.5rem+env(safe-area-inset-top,0px))]",
            )}
          >
            <div className={cn("flex min-h-10 min-w-0 items-center gap-2 lg:hidden", embedded && "hidden", bare && !embedded && "lg:flex")}>
              <BrandMark className="size-8 shrink-0" />
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="font-display text-lg font-semibold leading-none tracking-tight">{PRODUCT_NAME}</span>
                <span className="h-3.5 w-px shrink-0 bg-border" aria-hidden />
                <EditableBrand name={businessName} quiet nowrap />
              </div>
              <div className="ml-auto -mr-1.5 flex shrink-0 items-center">
                <NotesDoor iconOnly />
                <Link
                  to="/ajustes"
                  className="grid size-10 place-items-center rounded-sm text-muted hover:bg-surface-2 hover:text-fg"
                  aria-label={tx("Ajustes", "Settings")}
                >
                  <Settings className="size-5" />
                </Link>
              </div>
            </div>
            <div className="mt-0.5 flex min-h-11 min-w-0 items-center gap-2">
              <h1 className={cn("flex min-w-0 items-center gap-2 font-display font-semibold tracking-tight", titleTight ? "shrink-0 text-lg md:text-2xl" : "flex-1 text-xl sm:text-2xl")}>
                <span className={titleFull ? "leading-tight" : "truncate"}>{title}</span>
                {titleExtra}
              </h1>
              {pathname === "/agenda" ? null : <UndoBar confirm={pathname !== "/notas" && pathname !== "/fichero"} />}
              {action}
              {embedded ? (
                <div className="ml-auto flex shrink-0 items-center">
                  <NotesDoor iconOnly />
                  <Link
                    to="/ajustes"
                    className="grid size-10 place-items-center rounded-sm text-muted hover:bg-surface-2 hover:text-fg"
                    aria-label={tx("Ajustes", "Settings")}
                  >
                    <Settings className="size-5" />
                  </Link>
                </div>
              ) : null}
            </div>
          </header>
          <main className={cn("mx-auto w-full min-w-0 max-w-3xl flex-1 overflow-x-clip px-3 py-4 sm:px-5 sm:py-5 lg:max-w-4xl lg:px-6 lg:py-6", split && "overflow-y-auto", embedded && "px-2.5 py-3 sm:px-4 lg:px-4 lg:py-4")}>
            <OfflineBanner />
            <BackupWatch />
            {children}
          </main>
        </div>
  );

  return (
    <RequireAuth>
      <div className={cn("min-h-dvh w-full max-w-full overflow-x-clip bg-bg text-fg", !embedded && "lg:grid", !embedded && (split ? "lg:grid-cols-[4.25rem_minmax(0,1fr)]" : "lg:grid-cols-[15.5rem_minmax(0,1fr)]"))}>
        <aside className={cn("hidden pt-[env(safe-area-inset-top,0px)] lg:flex lg:flex-col lg:border-r lg:border-border lg:bg-surface print:hidden", embedded && "lg:hidden", split && "lg:items-center")}>
          {split ? (
            <nav className="flex flex-1 flex-col items-center gap-1 px-1.5 pt-3" aria-label={tx("Pestañas", "Tabs")}>
              {nav.map((item) => {
                const Icon = item.icon;
                const on = pathname === item.to;
                return (
                  <button
                    key={item.to}
                    type="button"
                    aria-label={t(item.label)}
                    aria-pressed={on}
                    title={t(item.label)}
                    onClick={() => openTab(item.to as TabletTab)}
                    className={cn("grid size-11 place-items-center rounded-xl", on ? "bg-sun text-primary" : "text-muted hover:bg-bg hover:text-fg")}
                  >
                    <Icon className="size-5" strokeWidth={on ? 2.3 : 1.9} />
                  </button>
                );
              })}
              <NotesDoor iconOnly />
              <Link to="/ajustes" aria-label={t("nav.settings")} title={t("nav.settings")} className="grid size-11 place-items-center rounded-xl text-muted hover:bg-bg hover:text-fg">
                <Settings className="size-5" />
              </Link>
            </nav>
          ) : (
            <>
          <div className="flex min-w-0 items-center gap-3 px-5 pt-6 pb-4">
            <BrandMark className="size-10 shrink-0" />
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 font-display text-lg font-semibold leading-none">{PRODUCT_NAME}</span>
              <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
              <EditableBrand name={businessName} quiet />
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3 pt-2">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} icon={item.icon} label={t(item.label)} />
            ))}
            <NotesDoor />
            <NavLink to="/ajustes" label={t("nav.settings")} icon={Settings} />
          </nav>
          <div className="p-3 pb-5">
            <AccountChip />
          </div>
            </>
          )}
        </aside>

        <div
          className={cn(
            "min-w-0",
            split && "grid h-dvh overflow-hidden",
          )}
          style={
            tunable
              ? flow === "stack"
                ? { gridTemplateRows: `${ratio}fr auto ${1 - ratio}fr` }
                : { gridTemplateColumns: `${ratio}fr auto ${1 - ratio}fr` }
              : undefined
          }
        >
        {split
          ? visible.map((path, index) => (
              <Fragment key={index}>
              <div
                className={cn(
                  "flex min-h-0 min-w-0 flex-col ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-primary)_34%,var(--color-border))]",

                )}
              >
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bg">
                  <PaneView
                    id={`split-${index}`}
                    path={path}
                    onPath={(tab) => {
                      setActivePane(index);
                      assignPane(index, tab);
                    }}
                  />
                </div>
                {phoneSplit ? (
                  <PaneBar
                    path={path}
                    low={index === 0}
                    onPick={(tab) => {
                      setActivePane(index);
                      assignPane(index, tab);
                    }}
                  />
                ) : null}
              </div>
              {tunable && index === 0 ? (
                <SplitHandle
                  vertical={flow === "side"}
                  ratio={ratio}
                  onRatio={setDragRatio}
                  onCommit={(next) => {
                    setDragRatio(null);
                    saveBoard(flow === "stack" ? { ...board, ratio: next } : { ...board, sideRatio: next });
                  }}
                />
              ) : null}
              </Fragment>
            ))
          : column(0)}
        </div>

        {tabletOn && !embedded && onBoard && !keyboard ? (
          wide ? (
          <TabletDock
            open={boardOpen}
            layout={board}
            floatOn={float.open}
            floatMin={Boolean(float.min)}
            onFloat={foldFloat}
            onFloatClose={closeFloat}
            onToggle={() => setBoardOpen((value) => !value)}
            onChange={(next) => {
              setBoard(next);
              writeTabletLayout(next);
            }}
          />
          ) : (
            <PhoneViewButton
              split={phoneSplit}
              floatOn={float.open}
              floatMin={Boolean(float.min)}
              onSplit={(on) => saveBoard({ ...board, phone: on })}
              onFloat={foldFloat}
              onFloatClose={closeFloat}
            />
          )
        ) : null}

        <nav ref={setDockEl} className={cn("pod-dock pointer-events-auto fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[color-mix(in_srgb,var(--color-primary)_32%,var(--color-border))] bg-surface px-0.5 pt-1 text-fg print:hidden lg:hidden pb-[env(safe-area-inset-bottom)]", (embedded || split || keyboard) && "hidden")}>
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} icon={item.icon} label={t(item.label)} compact />
          ))}
        </nav>
      </div>
    </RequireAuth>
  );
}

function PaneBar({
  path,
  low,
  onPick,
}: {
  path: TabletTab;
  low?: boolean;
  onPick: (tab: TabletTab) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("flex shrink-0 justify-center border-t border-[color-mix(in_srgb,var(--color-primary)_32%,var(--color-border))] bg-bg px-3", low ? "h-14 items-end pb-1.5" : "h-11 items-center")} data-no-swipe>
      <div className="grid h-8 w-full max-w-[16.5rem] grid-cols-5 rounded-full bg-surface-2 p-0.5 ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-primary)_24%,var(--color-border))]">
      {nav.map((item) => {
        const on = item.to === path;
        const Icon = item.icon;
        return (
          <button
            key={item.to}
            type="button"
            aria-label={t(item.label)}
            aria-pressed={on}
            onClick={() => onPick(item.to as TabletTab)}
            className={cn("grid place-items-center rounded-full", on ? "bg-surface text-primary shadow-sm ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-primary)_32%,var(--color-border))]" : "text-muted")}
          >
            <Icon className="size-4" strokeWidth={on ? 2.4 : 1.8} />
          </button>
        );
      })}
      </div>
    </div>
  );
}

function SplitHandle({
  ratio,
  onRatio,
  onCommit,
  vertical,
}: {
  ratio: number;
  onRatio: (next: number) => void;
  onCommit: (next: number) => void;
  /** Side by side: a vertical bar you drag left and right. */
  vertical?: boolean;
}) {
  const tx = useTx();
  const clamp = (value: number) => Math.min(vertical ? 0.8 : 0.93, Math.max(vertical ? 0.2 : 0.07, value));
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={tx("Ajustar la división", "Resize the split")}
      aria-valuemin={vertical ? 20 : 7}
      aria-valuemax={vertical ? 80 : 93}
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={0}
      data-no-swipe
      onPointerDown={(event) => {
        const el = event.currentTarget;
        const parent = el.parentElement;
        if (!parent) return;
        event.preventDefault();
        el.setPointerCapture(event.pointerId);
        const apply = (clientX: number, clientY: number) => {
          const rect = parent.getBoundingClientRect();
          return clamp(vertical ? (clientX - rect.left) / rect.width : (clientY - rect.top) / rect.height);
        };
        const move = (ev: PointerEvent) => onRatio(apply(ev.clientX, ev.clientY));
        const up = (ev: PointerEvent) => {
          const next = apply(ev.clientX, ev.clientY);
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", up);
          onCommit(next);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
      }}
      onDoubleClick={() => onCommit(0.5)}
      onKeyDown={(event) => {
        const back = vertical ? "ArrowLeft" : "ArrowUp";
        const fwd = vertical ? "ArrowRight" : "ArrowDown";
        if (event.key !== back && event.key !== fwd) return;
        event.preventDefault();
        onCommit(clamp(ratio + (event.key === fwd ? 0.04 : -0.04)));
      }}
      className={cn(
        "relative z-10 flex touch-none items-center justify-center bg-bg",
        vertical ? "w-4 cursor-col-resize flex-col" : "h-5 cursor-row-resize",
      )}
    >
      <span
        className={cn(
          "absolute bg-[color-mix(in_srgb,var(--color-primary)_42%,var(--color-border))]",
          vertical ? "inset-y-0 left-1/2 w-px -translate-x-1/2" : "inset-x-0 top-1/2 h-px -translate-y-1/2",
        )}
      />
      <span
        className={cn(
          "relative rounded-full bg-[color-mix(in_srgb,var(--color-primary)_55%,var(--color-border))]",
          vertical ? "h-10 w-1.5" : "h-1 w-8",
        )}
      />
    </div>
  );
}

function TabletDock({
  open,
  layout,
  floatOn,
  floatMin,
  onFloat,
  onFloatClose,
  onToggle,
  onChange,
}: {
  open: boolean;
  layout: TabletLayout;
  floatOn: boolean;
  floatMin: boolean;
  onFloat: () => void;
  onFloatClose: () => void;
  onToggle: () => void;
  onChange: (next: TabletLayout) => void;
}) {
  const tx = useTx();
  const [left, right] = layout.slots;
  return (
    <div className="fixed right-4 bottom-4 z-40 print:hidden" data-no-swipe>
      {open ? (
        <div className="mb-2 w-72 rounded-2xl bg-surface p-3 shadow-card">
          <p className="text-sm font-semibold">{tx("Vista", "View")}</p>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {([1, 2] as const).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onChange({ ...layout, count })}
                className={cn("h-11 rounded-full text-sm font-semibold", layout.count === count ? "bg-primary text-primary-fg" : "bg-bg text-muted")}
              >
                {count === 1 ? tx("1 pantalla", "1 screen") : tx("2 pantallas", "2 screens")}
              </button>
            ))}
          </div>
          {layout.count === 2 && left && right ? (
            <button
              type="button"
              onClick={() => onChange({ ...layout, slots: [right, left, ...layout.slots.slice(2)] })}
              className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-bg text-sm font-semibold text-muted"
            >
              <ArrowLeftRight className="size-4" />
              {tx("Cambiar de lado", "Swap sides")}
            </button>
          ) : null}
          <FloatRow on={floatOn} min={floatMin} onFloat={onFloat} onClose={onFloatClose} />
          <p className="mt-2 text-xs text-muted">
            {tx(
              "Con 2 pantallas, arrastra la barra del medio para dar más espacio a un lado (doble toque la centra). La ventana flotante se mueve desde su barra de arriba, cambia de tamaño desde las esquinas de abajo y se pliega en una burbuja con –. Alt+\\ parte o junta. Alt+F abre o cierra la ventana flotante. Alt+1 a Alt+5 cambia de pestaña.",
              "With 2 screens, drag the middle bar to give one side more room (double-tap centers it). Move the floating window by its top bar, resize it from the bottom corners, and fold it into a bubble with –. Alt+\\ splits or joins. Alt+F opens or closes the floating window. Alt+1 to Alt+5 switch tabs.",
            )}
          </p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        className="ml-auto grid size-12 place-items-center rounded-full bg-primary text-primary-fg shadow-card"
        aria-label={tx("Vista de tableta", "Tablet view")}
      >
        <LayoutGrid className="size-5" />
      </button>
    </div>
  );
}

function EditableBrand({ name, quiet, nowrap }: { name: string; quiet?: boolean; nowrap?: boolean }) {
  const tx = useTx();
  const qc = useQueryClient();
  const push = useUndo((s) => s.push);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const save = useMutation({
    mutationFn: (input: { next: string; prev: string }) => updateSettings({ data: { businessName: input.next } }),
    onSuccess: async (_, input) => {
      storeBusinessName(input.next);
      push({
        label: tx("Nombre del negocio", "Business name"),
        undo: async () => {
          await updateSettings({ data: { businessName: input.prev } });
          storeBusinessName(input.prev);
          await qc.invalidateQueries({ queryKey: ["settings"] });
        },
        redo: async () => {
          await updateSettings({ data: { businessName: input.next } });
          storeBusinessName(input.next);
          await qc.invalidateQueries({ queryKey: ["settings"] });
        },
      });
      await qc.invalidateQueries({ queryKey: ["settings"] });
      setEditing(false);
    },
  });

  useEffect(() => setDraft(name), [name]);

  if (editing) {
    return (
      <form
        className="min-w-0 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          const next = draft.trim() || DEFAULT_BUSINESS_NAME;
          if (next === name) return;
          save.mutate({ next, prev: name });
        }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const next = draft.trim() || DEFAULT_BUSINESS_NAME;
            if (next !== name) save.mutate({ next, prev: name });
            else setEditing(false);
          }}
          maxLength={60}
          className="h-10 w-full min-w-0 rounded-sm bg-surface px-2 font-display text-base font-semibold shadow-card"
          aria-label={tx("Nombre del negocio", "Business name")}
        />
      </form>
    );
  }

  if (quiet) {
    return (
      <button type="button" onClick={() => setEditing(true)} className={cn("text-left font-display font-medium leading-none tracking-tight text-muted", nowrap ? "shrink-0 whitespace-nowrap text-[15px]" : "min-w-0 flex-1 truncate text-base")} aria-label={tx("Nombre del negocio", "Business name")}>
        {name}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="block w-full min-w-0 text-left font-display text-lg font-semibold leading-tight tracking-tight sm:text-xl"
    >
      <span className="line-clamp-2 break-words">{name}</span>
    </button>
  );
}

function NotesDoor({ iconOnly }: { iconOnly?: boolean }) {
  const { t } = useI18n();
  const tx = useTx();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === "/notas" || pathname === "/fichero";
  const stamp = useRef(0);
  const timer = useRef<number | null>(null);

  function press() {
    const now = Date.now();
    if (timer.current != null && now - stamp.current < 320) {
      window.clearTimeout(timer.current);
      timer.current = null;
      stamp.current = 0;
      void navigate({ to: "/fichero" });
      return;
    }
    stamp.current = now;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void navigate({ to: "/notas" });
    }, 320);
  }

  return (
    <button
      type="button"
      onClick={press}
      title={tx("Doble toque abre el Fichero", "Double tap opens the cabinet")}
      aria-label={tx("Notas. Doble toque abre el Fichero.", "Notes. Double tap opens the cabinet.")}
      className={cn(
        iconOnly
          ? "grid size-10 place-items-center rounded-sm text-muted hover:bg-surface-2 hover:text-fg"
          : "flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-150",
        !iconOnly && (active ? "bg-sun text-primary" : "text-muted hover:bg-surface-2 hover:text-fg"),
        iconOnly && active && "text-primary",
      )}
    >
      <NotebookPen className={cn("size-5 shrink-0", active && "text-primary")} strokeWidth={active ? 2.3 : 1.9} />
      {iconOnly ? null : <span className="truncate">{t("nav.notes")}</span>}
    </button>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  compact,
}: {
  to: ShellTo;
  label: string;
  icon: typeof Home;
  compact?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
  return (
    <Link
      to={to}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors duration-150",
        compact ? "min-h-14 flex-col justify-center gap-1 px-1 py-2 text-xs" : "min-h-12 py-3",
        active ? "bg-sun text-primary" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon className={cn("size-5 shrink-0", active && "text-primary")} strokeWidth={active ? 2.3 : 1.9} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

const SIGNOUT_FLAG = "ols.signing-out";

export function SignOutControl({ className, full }: { className?: string; full?: boolean }) {
  const tx = useTx();
  const [ask, setAsk] = useState(false);
  const [pending, setPending] = useState(false);
  if (!authEnabled) return null;
  return (
    <>
      <button
        type="button"
        aria-label={tx("Cerrar sesión", "Sign out")}
        onClick={() => setAsk(true)}
        className={cn(
          full
            ? "flex h-12 w-full items-center justify-center gap-2 rounded-md bg-late-bg text-sm font-semibold text-late"
            : "grid size-11 shrink-0 place-items-center rounded-sm text-muted hover:bg-surface-2 hover:text-fg",
          className,
        )}
      >
        <LogOut className="size-5" />
        {full ? tx("Cerrar sesión", "Sign out") : null}
      </button>
      <ConfirmDialog
        open={ask}
        title={tx("¿Cerrar sesión?", "Sign out?")}
        description={tx(
          "Vuelves a la pantalla de entrar. Nadie más podrá ver tus clientes en este teléfono hasta que entres de nuevo.",
          "You return to the sign-in screen. Nobody else can see your clients on this phone until you sign in again.",
        )}
        confirmLabel={tx("Sí, salir", "Yes, sign out")}
        danger
        pending={pending}
        onConfirm={() => {
          setPending(true);
          void saveBackupNow()
            .catch(() => undefined)
            .finally(() => {
              try {
                sessionStorage.setItem(SIGNOUT_FLAG, "1");
                sessionStorage.removeItem("ols.had-user");
              } catch {
                /* ignore */
              }
              void signOut("/login").catch(() => {
                window.location.replace("/login");
              });
            });
        }}
        onCancel={() => setAsk(false)}
      />
    </>
  );
}

function AccountChip() {
  const tx = useTx();
  const user = useCurrentUser();
  if (!user) return <div className="h-12 rounded-md bg-surface-2" />;
  const label = user.isDevFallback
    ? tx("Solo en este equipo", "This device only")
    : (user.displayName ?? user.primaryEmail ?? tx("Cuenta", "Account"));
  const avatar = user.profileImageUrl ? (
    <img src={user.profileImageUrl} alt="" className="size-8 rounded-full object-cover" />
  ) : (
    <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-fg">
      {label.charAt(0).toUpperCase()}
    </span>
  );
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-bg px-2.5 py-2">
      {avatar}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
    </div>
  );
}

/** Faro-style floating-window row: opens it, then folds / unfolds it; the × closes it. */
function FloatRow({ on, min, onFloat, onClose }: { on: boolean; min: boolean; onFloat: () => void; onClose: () => void }) {
  const tx = useTx();
  return (
    <div className={cn("mt-1 flex min-h-11 items-center rounded-2xl border", on ? "border-primary" : "border-border")}>
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={on}
        onClick={onFloat}
        className="flex min-h-11 flex-1 items-center gap-2.5 px-3 text-left text-sm font-semibold"
      >
        <PictureInPicture2 className="size-4 text-primary" />
        <span className="flex-1">
          {on
            ? min ? tx("Desplegar ventana flotante", "Unfold floating window") : tx("Plegar en burbuja", "Fold into bubble")
            : tx("Ventana flotante", "Floating window")}
        </span>
      </button>
      {on ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={tx("Cerrar ventana flotante", "Close floating window")}
          className="mr-2 grid size-8 place-items-center rounded-lg text-muted hover:bg-bg hover:text-fg"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/** Phone: the split button opens a small View menu (one screen, top/bottom, floating window). */
function PhoneViewButton({
  split,
  floatOn,
  floatMin,
  onSplit,
  onFloat,
  onFloatClose,
}: {
  split: boolean;
  floatOn: boolean;
  floatMin: boolean;
  onSplit: (on: boolean) => void;
  onFloat: () => void;
  onFloatClose: () => void;
}) {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const tile = (on: boolean) =>
    cn(
      "grid justify-items-center gap-1.5 rounded-2xl border px-1 pt-2.5 pb-2 text-xs font-semibold leading-tight",
      on ? "border-primary bg-[color-mix(in_oklab,var(--color-primary)_14%,var(--color-bg))] text-fg" : "border-transparent bg-bg text-muted",
    );
  const glyph = (rows: number, on: boolean) => (
    <i aria-hidden className="flex h-10 w-[30px] flex-col gap-[3px] rounded-[7px] border-[1.5px] border-current p-[3px]">
      {Array.from({ length: rows }, (_, i) => (
        <b key={i} className={cn("flex-1 rounded-[3px]", on ? "bg-primary opacity-90" : "bg-current opacity-55")} />
      ))}
    </i>
  );
  return (
    <div ref={box} className="fixed bottom-24 left-3 z-40 print:hidden" data-no-swipe>
      {open ? (
        <div role="menu" aria-label={tx("Vista", "View")} className="absolute bottom-[calc(100%+8px)] left-0 grid w-64 gap-2.5 rounded-[20px] border border-border bg-surface p-3 shadow-[0_20px_50px_rgb(0_0_0/0.3)]">
          <p className="text-[0.68rem] font-bold tracking-[0.08em] text-muted uppercase">{tx("Vista", "View")}</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" role="menuitemradio" aria-checked={!split} onClick={() => { onSplit(false); setOpen(false); }} className={tile(!split)}>
              {glyph(1, !split)}
              <span>{tx("1 pantalla", "1 screen")}</span>
            </button>
            <button type="button" role="menuitemradio" aria-checked={split} onClick={() => { onSplit(true); setOpen(false); }} className={tile(split)}>
              {glyph(2, split)}
              <span>{tx("Arriba y abajo", "Top and bottom")}</span>
            </button>
          </div>
          <FloatRow on={floatOn} min={floatMin} onFloat={() => { onFloat(); setOpen(false); }} onClose={() => { onFloatClose(); setOpen(false); }} />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={tx("Vista: pantallas y ventana flotante", "View: screens and floating window")}
        className={cn(
          "grid size-10 place-items-center rounded-full border border-border bg-surface/90 text-muted shadow-card ring-1 ring-border",
          (split || floatOn) && "bg-sun text-primary",
        )}
      >
        {floatOn && !split ? <PictureInPicture2 className="size-5" /> : <Rows2 className="size-5" />}
      </button>
    </div>
  );
}
