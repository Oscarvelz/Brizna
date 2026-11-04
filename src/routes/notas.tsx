import { WideSplit } from "@/components/wide-layout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, Download, Pencil, Pin, Plus, Search, Share2, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Hint } from "@/components/hint";
import { PhotoPicker } from "@/components/photo-picker";
import { PHOTOS_ENABLED } from "@/lib/photos-flag";
import { CalcButton, QuickPad } from "@/components/money-calc";
import { noteReaderHtml, RichNotes } from "@/components/rich-notes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/lib/dates";
import { formatDay, money, weekdayOptions } from "@/lib/format";
import { useI18n, useTx } from "@/lib/i18n";
import { useUndo } from "@/lib/undo";
import { dropSavedDraft, holdPageDraft, readMainDraft, readSideDraft, rememberDraft } from "@/lib/note-draft";
import { mentionIds } from "@/lib/note-mentions";
import { downloadHref } from "@/lib/save-file";
import { readCabinet, readTrashDays, withLiveFolders, writeCabinet, type CabinetFolder } from "@/lib/pad-cabinet";
import { createPadPage, dropPadFolder, getPad, savePad, addPadPhoto, deletePadPhoto, listPadPhotos } from "@/lib/server/lawn";
import type { PadData, PadDay, PadPhoto } from "@/lib/types";
import { cn } from "@/lib/utils";

function folderFromBack(back?: string) {
  if (!back?.startsWith("c:")) return "";
  try {
    return decodeURIComponent(back.slice(2));
  } catch {
    return back.slice(2);
  }
}

function safeBack(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.slice(0, 120);
  if (value === "hoy" || value === "agenda" || value === "todo" || value === "home") return value;
  if (value.startsWith("cliente:") && /^\d+$/.test(value.slice(8))) return value;
  if (value.startsWith("c:") && value.length > 2) return value;
  return undefined;
}

export const Route = createFileRoute("/notas")({
  validateSearch: (search: Record<string, unknown>): { page?: number; back?: string; nueva?: string; editar?: "1" } => {
    const n = Number(search.page);
    const back = safeBack(search.back);
    const nueva = typeof search.nueva === "string" ? search.nueva.trim().slice(0, 40) : "";
    const editar = search.editar === "1" || search.editar === 1 || search.editar === true;
    return {
      ...(Number.isInteger(n) && n > 0 ? { page: n } : {}),
      ...(back ? { back } : {}),
      ...(nueva ? { nueva } : {}),
      ...(editar ? { editar: "1" as const } : {}),
    };
  },
  component: NotasPage,
});

function NotasPage() {
  const { t } = useI18n();
  const tx = useTx();
  const search = Route.useSearch();
  const folderTitle = search.page ? folderFromBack(search.back) : "";
  const shellTitle = folderTitle || (search.page && search.back === "home" ? tx("Fichero", "Cabinet") : search.page && search.back === "todo" ? tx("Ver todo", "See all") : t("notes.title"));
  const [trashDays, setTrashDays] = useState(30);
  useEffect(() => {
    setTrashDays(readTrashDays());
  }, []);
  const q = useQuery({
    queryKey: ["pad", trashDays],
    queryFn: () => getPad({ data: { trashDays } }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const data = q.data;

  return (
    <AppShell title={shellTitle} titleFull>
      {q.isLoading || !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
      ) : (
        <PadBody data={data} initialPage={search.nueva ? undefined : search.page} back={search.back} fresh={search.nueva} edit={search.editar === "1"} trashDays={trashDays} />
      )}
    </AppShell>
  );
}

function notePlain(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function PadBody({
  data,
  initialPage,
  back,
  fresh,
  edit,
  trashDays,
}: {
  data: PadData;
  initialPage?: number;
  back?: string;
  fresh?: string;
  edit?: boolean;
  trashDays: number;
}) {
  const { t } = useI18n();
  const tx = useTx();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = todayISO();
  const [openDay, setOpenDay] = useState(today);
  const live = data.pages.filter((page) => !page.deletedAt);
  const composing = useRef(!initialPage);
  const readTap = useRef(0);
  const [pageId, setPageId] = useState(initialPage ?? 0);
  const page = data.pages.find((item) => item.id === pageId && !item.deletedAt) ?? null;
  const [title, setTitle] = useState(page?.title ?? "Nota");
  const [saved, setSaved] = useState(true);
  const [askDel, setAskDel] = useState(false);
  const [askUnpin, setAskUnpin] = useState(false);
  const [askSave, setAskSave] = useState(false);
  const [noteFindOn, setNoteFindOn] = useState(false);
  const [noteFind, setNoteFind] = useState("");
  const [calcOn, setCalcOn] = useState(false);
  const [reading, setReading] = useState(Boolean(initialPage) && !edit);
  const [cabinet, setCabinet] = useState<CabinetFolder[]>(() => readCabinet());
  const bodyRef = useRef(page?.body ?? "");
  const hydrated = useRef<number | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [draftOn, setDraftOn] = useState(!initialPage);
  const [draftTitle, setDraftTitle] = useState("Nota nueva");
  const draftBody = useRef("");
  const [dupFolder, setDupFolder] = useState<string | null>(null);
  const [dupName, setDupName] = useState("");
  const [shots, setShots] = useState<string[]>([]);
  const shotsRef = useRef<string[]>([]);
  const [draftStamp, setDraftStamp] = useState(0);
  const [afterFolder, setAfterFolder] = useState<string | null>(null);

  useEffect(() => {
    if (initialPage) return;
    const note = fresh ? readSideDraft() : readMainDraft();
    const plain = note?.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";
    if (note && (plain.length > 0 || (note.shots?.length ?? 0) > 0)) {
      draftBody.current = note.html;
      setDraftTitle(note.title || "Nota nueva");
      setShots(note.shots ?? []);
      shotsRef.current = note.shots ?? [];
      setSaved(false);
    } else {
      draftBody.current = "";
      setDraftTitle("Nota nueva");
      setShots([]);
      shotsRef.current = [];
      setSaved(true);
    }
    setDraftStamp((n) => n + 1);
  }, [fresh, initialPage]);

  const activeFolders = cabinet.filter((folder) => !folder.trashedAt);
  useEffect(() => {
    if (!draftOn) return;
    const timer = window.setTimeout(() => document.querySelector<HTMLElement>("[data-note-editor]")?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(timer);
  }, [draftOn, draftStamp]);

  const chips = [...live].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.sortOrder - b.sortOrder);
  const pinned = chips.filter((item) => item.pinned);

  function remember(next: CabinetFolder[]) {
    setCabinet(next);
    writeCabinet(next);
  }

  useEffect(() => {
    if (composing.current || !pageId) return;
    const next = data.pages.find((item) => item.id === pageId && !item.deletedAt);
    if (!next) return;
    if (hydrated.current === next.id) return;
    hydrated.current = next.id;
    if (next.id !== pageId) setPageId(next.id);
    let htmlNext = next.body ?? "";
    let titleNext = next.title ?? "Nota";
    try {
      const raw = sessionStorage.getItem(`ols-pad-${next.id}`);
      if (typeof raw === "string") htmlNext = raw;
    } catch {
      /* ignore */
    }
    bodyRef.current = htmlNext;
    setTitle(titleNext);
    const dirty = htmlNext !== (next.body ?? "");
    setSaved(!dirty);
    if (dirty) setReading(false);
    if (dirty) {
      holdPageDraft({
        pageId: next.id,
        title: titleNext.trim() || "Nota",
        html: htmlNext,
        folder: next.folder || "No especificada",
        slot: "page",
      });
    }
  }, [data.pages, pageId]);

  useEffect(() => {
    if (live.length > 0 || fresh) return;
    setDraftOn(true);
    setReading(false);
  }, [live.length, fresh]);

  useEffect(() => {
    const days = readTrashDays();
    const cutoff = Date.now() - days * 86_400_000;
    const expired = readCabinet().filter((folder) => folder.trashedAt != null && folder.trashedAt < cutoff);
    if (expired.length === 0) return;
    void Promise.all(expired.map((folder) => dropPadFolder({ data: { name: folder.name } }))).then(async () => {
      const left = readCabinet().filter((folder) => !expired.some((item) => item.id === folder.id));
      writeCabinet(left);
      setCabinet(left);
      await qc.invalidateQueries({ queryKey: ["pad"] });
    });
  }, [qc, trashDays]);

  useEffect(() => {
    setCabinet((current) => withLiveFolders(current, live.map((item) => item.folder)));
    // live is derived from this page payload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.pages]);

  function stash(html: string, titleText?: string) {
    const slot = fresh && draftOn ? "side" : draftOn ? "main" : "page";
    const pageIdForSlot = slot === "page" ? page?.id ?? 0 : 0;
    rememberDraft({
      pageId: pageIdForSlot,
      title: (titleText ?? (draftOn ? draftTitle : title)).trim() || "Nota",
      html,
      folder: slot === "side" ? fresh || "No especificada" : page?.folder || fresh || "No especificada",
      draft: slot !== "page",
      slot,
      shots: slot === "page" ? undefined : shotsRef.current,
    });
  }

  function startBlank() {
    const current = page;
    const keepPrevious = !draftOn && current != null && bodyRef.current !== (current.body ?? "");
    composing.current = true;
    setDraftOn(true);
    setReading(false);
    setShots([]);
    shotsRef.current = [];
    setDraftTitle("Nota nueva");
    draftBody.current = "";
    setSaved(true);
    setNoteFind("");
    try {
      sessionStorage.removeItem("ols-pad-draft");
    } catch {
      /* ignore */
    }
    if (keepPrevious && current) {
      holdPageDraft({
        pageId: current.id,
        title: title.trim() || "Nota",
        html: bodyRef.current,
        folder: current.folder || fresh || "No especificada",
        slot: "page",
      });
    }
    if (fresh) dropSavedDraft("side");
    else dropSavedDraft("main");
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["pad"] });
    await qc.invalidateQueries({ queryKey: ["pad-pins"] });
  }

  function leave() {
    if (!back) return false;
    if (back === "hoy") void navigate({ to: "/" });
    else if (back === "agenda") void navigate({ to: "/agenda" });
    else if (back === "todo") void navigate({ to: "/fichero", search: { vista: "todo" } });
    else if (back === "home") void navigate({ to: "/fichero" });
    else if (back.startsWith("c:")) void navigate({ to: "/fichero", search: { carpeta: decodeURIComponent(back.slice(2)) } });
    else if (back.startsWith("cliente:")) void navigate({ to: "/clientes/$id", params: { id: back.slice(8) } });
    return true;
  }

  async function commit(folder: string, force = false) {
    const html = draftOn ? draftBody.current : bodyRef.current;
    const noteTitle = (draftOn ? draftTitle : title).trim() || "Nota";
    if (!draftOn && !page) return;
    if (!folder.trim()) return;
    if (!force) {
      const twin = data.pages.find((item) => {
        if (item.deletedAt || (!draftOn && item.id === page?.id)) return false;
        const other = notePlain(item.body || "");
        const mine = notePlain(html);
        return mine.length > 0 && other === mine;
      });
      if (twin) {
        setDupName(twin.title || "Nota");
        setDupFolder(folder);
        return;
      }
    }
    const clientIds = mentionIds(html, data.clients);
    setAskSave(false);
    setDupFolder(null);
    try {
      let id = draftOn ? 0 : page?.id ?? 0;
      if (draftOn || !id) {
        const created = await createPadPage({ data: { title: noteTitle, folder } });
        id = created.id;
      }
      await savePad({
        data: { pageId: id, html, title: noteTitle, folder, clientIds },
      });
      try {
        sessionStorage.removeItem(`ols-pad-${id}`);
        sessionStorage.removeItem("ols-pad-0");
      } catch {
        /* ignore */
      }
      bodyRef.current = html;
      hydrated.current = id;
      setTitle(noteTitle);
      setPageId(id);
      setDraftOn(false);
      setReading(true);
      const extra = shotsRef.current;
      shotsRef.current = [];
      setShots([]);
      setSaved(true);
      dropSavedDraft(fresh ? "side" : draftOn ? "main" : "page", id);
      toast.success(tx(`Guardada en ${folder}`, `Saved in ${folder}`));
      if (extra.length) {
        await Promise.all(extra.map((data) => addPadPhoto({ data: { pageId: id, data } }).catch(() => undefined)));
        await qc.invalidateQueries({ queryKey: ["pad-photos", id] });
      }
      await refresh();
      setAfterFolder(folder);
    } catch {
      toast.error(t("notes.saveFail"));
    }
  }

  async function togglePin(next: boolean) {
    if (!page) return;
    const html = bodyRef.current;
    try {
      await savePad({
        data: { pageId: page.id, html, title: title.trim() || "Nota", pinned: next },
      });
      setSaved(true);
      dropSavedDraft("page", page.id);
      setAskUnpin(false);
      toast(next ? tx("Fijada en Hoy y en el bloc.", "Pinned on Today and in the notepad.") : tx("Ya no está fijada", "Unpinned"));
      await refresh();
    } catch {
      toast.error(t("notes.saveFail"));
    }
  }

  async function trashPage() {
    if (!page) return;
    try {
      await savePad({ data: { pageId: page.id, trashed: true } });
      setAskDel(false);
      toast(tx("Nota en la papelera", "Note moved to trash"));
      hydrated.current = null;
      const next = live.find((item) => item.id !== page.id);
      if (next) setPageId(next.id);
      await refresh();
    } catch {
      toast.error(t("notes.saveFail"));
    }
  }

  function placeCursor(x?: number, y?: number) {
    const el = document.querySelector<HTMLElement>("[data-note-editor]");
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    let range: Range | null = null;
    if (typeof x === "number" && typeof y === "number") {
      const hit = document.caretRangeFromPoint?.(x, y);
      if (hit && el.contains(hit.startContainer)) range = hit;
    }
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function editNow(x?: number, y?: number) {
    flushSync(() => setReading(false));
    placeCursor(x, y);
  }

  function openNote(id: number, writing = false) {
    composing.current = false;
    setDraftOn(false);
    const next = data.pages.find((item) => item.id === id);
    let htmlNext = next?.body ?? "";
    try {
      const raw = sessionStorage.getItem(`ols-pad-${id}`);
      if (typeof raw === "string") htmlNext = raw;
    } catch {
      /* ignore */
    }
    bodyRef.current = htmlNext;
    hydrated.current = id;
    setTitle(next?.title ?? "Nota");
    setSaved(htmlNext === (next?.body ?? ""));
    setPageId(id);
    setNoteFind("");
    setReading(!writing);
    window.setTimeout(() => editorRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 40);
  }

  function addCabinetFolder(name: string) {
    const nextName = name.trim().slice(0, 40);
    if (!nextName) return;
    if (cabinet.some((item) => item.name.toLowerCase() === nextName.toLowerCase())) return;
    remember([...cabinet, { id: `new-${Date.now()}`, name: nextName, color: "", trashedAt: null }]);
  }

  return (
    <>
      <WideSplit
        sideFirst={false}
        side={
      <div className="mt-6">
        <WeekAccordion
          days={data.weekDays}
          openDay={openDay}
          onToggle={(date) => setOpenDay((prev) => (prev === date ? "" : date))}
        />
      </div>
        }
      >
      <section ref={editorRef} data-spot="notas" className="note-halo p-3">
        <div className="mb-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (!leave()) void navigate({ to: "/fichero" });
            }}
            aria-label={tx("Abrir bloc", "Open pad")}
            className="inline-flex h-10 shrink-0 items-center gap-0.5 rounded-full pr-1 font-display text-sm font-semibold text-fg"
          >
            <ChevronLeft className="size-5 shrink-0" />
            <span>{tx("Abrir bloc", "Open pad")}</span>
          </button>
          <Hint topic="notas" />
          <span className="min-w-0 flex-1" />
          <CalcButton pressed={calcOn} onClick={() => setCalcOn((value) => !value)} />
          {!draftOn && page ? (
            <button
              type="button"
              data-note-edit={reading ? "" : undefined}
              aria-pressed={!reading}
              aria-label={reading ? tx("Editar nota", "Edit note") : tx("Leer nota", "Read note")}
              onClick={() => {
                if (reading) editNow();
                else setReading(true);
              }}
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full",
                reading ? "text-fg" : "bg-soil-bg text-soil",
              )}
            >
              <Pencil className="size-5" />
            </button>
          ) : null}
          <button
            type="button"
            disabled={!page}
            aria-pressed={Boolean(page?.pinned)}
            aria-label={page?.pinned ? t("notes.unpin") : t("notes.pin")}
            onClick={() => {
              if (!page) return;
              if (page.pinned) setAskUnpin(true);
              else void togglePin(true);
            }}
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full",
              page?.pinned ? "bg-soil-bg text-soil" : "text-muted",
            )}
          >
            <Pin className={cn("size-5", page?.pinned && "fill-current")} />
          </button>
          {noteFindOn ? (
            <Input
              value={noteFind}
              autoFocus
              onChange={(e) => setNoteFind(e.target.value)}
              placeholder={tx("Buscar en esta nota", "Search this note")}
              aria-label={tx("Buscar en esta nota", "Search this note")}
              className="h-10 w-[9.5rem] max-w-[42vw]"
            />
          ) : null}
          <button
            type="button"
            aria-pressed={noteFindOn}
            aria-label={tx("Buscar en esta nota", "Search this note")}
            onClick={() => setNoteFindOn((value) => !value)}
            className="grid size-10 shrink-0 place-items-center rounded-full text-fg"
          >
            <Search className="size-5" />
          </button>
        </div>
        {calcOn ? <QuickPad onClose={() => setCalcOn(false)} /> : null}
        {pinned.length > 0 ? (
          <div className="mb-3">
            <p className="mb-1 text-xs font-semibold text-muted">{tx("Fijadas", "Pinned")}</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pinned.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNote(item.id, true)}
                  className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-surface px-3.5 text-sm font-semibold text-muted shadow-card"
                >
                  <Pin className="size-3.5 fill-current" />
                  {item.title || "Nota"}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {reading && !draftOn && page ? (
          <article
            onPointerUp={(e) => {
              if (e.button !== 0) return;
              const now = Date.now();
              if (now - readTap.current < 320) {
                readTap.current = 0;
                editNow(e.clientX, e.clientY);
                return;
              }
              readTap.current = now;
            }}
          >
            <h2 className="mb-2 font-display text-lg font-semibold">{title.trim() || tx("Nota", "Note")}</h2>
            {notePlain(bodyRef.current) ? (
              <div
                className="note-body min-h-36 rounded-md bg-surface px-3 py-3 text-sm leading-relaxed shadow-card"
                dangerouslySetInnerHTML={{ __html: noteReaderHtml(bodyRef.current) }}
              />
            ) : (
              <p className="rounded-md bg-surface px-3 py-4 text-sm text-muted shadow-card">{tx("Sin texto.", "No text.")}</p>
            )}
          </article>
        ) : (
        <>
        <Input
          value={draftOn ? draftTitle : title}
          onChange={(e) => {
            const next = e.target.value;
            if (draftOn) {
              setDraftTitle(next);
              const text = draftBody.current;
              if (notePlain(text).length > 0) {
                setSaved(false);
                stash(text, next);
              }
              return;
            }
            setTitle(next);
            setSaved(false);
            if (page) stash(bodyRef.current, next);
          }}
          className="mb-2"
          aria-label={t("notes.titleLabel")}
        />
        {draftOn || page ? (
          <RichNotes
            key={draftOn ? `fresh-note-${draftStamp}` : page?.id}
            value={draftOn ? draftBody.current : bodyRef.current}
            draftKey={draftOn ? "ols-pad-draft" : `ols-pad-${page?.id ?? 0}`}
            find={noteFindOn ? noteFind : ""}
            clients={data.clients}
            cornerUndo
            placeholder={tx("Escribe… @ y el nombre del cliente lo deja en su ficha.", "Write… @ and the client name saves it on their file.")}
            onDraft={(text) => {
              if (draftOn) {
                draftBody.current = text;
                const dirty = notePlain(text).length > 0 || shotsRef.current.length > 0;
                setSaved(!dirty);
                stash(text);
                return;
              }
              bodyRef.current = text;
              setSaved(false);
              if (page) stash(text);
            }}
            onChange={(text) => {
              if (draftOn) draftBody.current = text;
              else bodyRef.current = text;
            }}
          />
        ) : (
          <p className="rounded-md bg-sun px-3 py-4 text-sm text-muted">{tx("No hay una nota abierta.", "No note is open.")}</p>
        )}
        {reading && !draftOn && page ? null : (
        <>
        <NotePhotos
          pageId={draftOn ? 0 : (page?.id ?? 0)}
          title={draftOn ? draftTitle : title}
          pending={shots}
          onPending={(next) => {
            shotsRef.current = next;
            setShots(next);
            stash(draftOn ? draftBody.current : bodyRef.current);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!draftOn && !page}
            onClick={() => {
              if (draftOn) {
                const folder = fresh || (back?.startsWith("c:") ? decodeURIComponent(back.slice(2)) : "") || "No especificada";
                void commit(folder);
                return;
              }
              if (!page) return;
              if (back?.startsWith("c:")) {
                const folder = decodeURIComponent(back.slice(2)) || page.folder || "No especificada";
                void commit(folder);
                return;
              }
              setAskSave(true);
            }}
          >
            {tx("Guardar", "Save")}
          </Button>
          {page ? (
            <Button variant="ghost" className="text-late" size="sm" onClick={() => setAskDel(true)}>
              <Trash2 className="size-4" />
              {t("notes.delete")}
            </Button>
          ) : null}
          <p className="text-xs text-muted">{saved ? t("notes.saved") : tx("Sin guardar", "Not saved")}</p>
        </div>
        </>
        )}
        </>
        )}
        {!draftOn && page && reading ? <NotePhotos pageId={page.id} title={title} canAdd={false} /> : null}
      </section>

      <ConfirmDialog
        front
        stack
        open={dupFolder != null}
        title={tx("Esto ya está guardado", "This is already saved")}
        description={tx(
          `El texto es el mismo que en «${dupName}». Si sigues, quedarán dos notas iguales.`,
          `The text is the same as in “${dupName}”. If you continue, there will be two identical notes.`,
        )}
        confirmLabel={tx("Guardar de todos modos", "Save anyway")}
        cancelLabel={tx("No guardar", "Don't save")}
        onConfirm={() => {
          const folder = dupFolder;
          setDupFolder(null);
          if (folder) void commit(folder, true);
        }}
        onCancel={() => setDupFolder(null)}
      />
      <ConfirmDialog
        front
        stack
        open={afterFolder != null}
        title={tx("Nota guardada", "Note saved")}
        description={tx(
          `Quedó en ${afterFolder}. Puedes ir a esa carpeta o empezar otra nota limpia.`,
          `It is in ${afterFolder}. You can open that folder or start another clean note.`,
        )}
        confirmLabel={tx("Vuelve a la carpeta", "Back to the folder")}
        extraLabel={tx("Nota nueva", "New note")}
        cancelLabel={tx("Quedarme", "Stay")}
        onConfirm={() => {
          const folder = afterFolder;
          setAfterFolder(null);
          if (folder) void navigate({ to: "/fichero", search: { carpeta: folder } });
        }}
        onExtra={() => {
          startBlank();
          setAfterFolder(null);
        }}
        onCancel={() => setAfterFolder(null)}
      />

      </WideSplit>
      <ConfirmDialog
        open={askUnpin}
        title={tx("¿Quitar esta nota de fijadas?", "Unpin this note?")}
        description={tx(
          "Deja de salir en Hoy y arriba del bloc. La nota no se borra.",
          "It leaves Today and the top of the notepad. The note is not deleted.",
        )}
        confirmLabel={tx("Sí, quitar", "Yes, unpin")}
        onConfirm={() => void togglePin(false)}
        onCancel={() => setAskUnpin(false)}
      />
      <ConfirmDialog
        open={askDel}
        title={t("notes.deleteAsk")}
        description={tx(
          "Pasa a la papelera de la carpeta madre. Se borra del todo cuando pase el tiempo que elegiste.",
          "It goes to the main folder trash. It is deleted for good after the time you chose.",
        )}
        confirmLabel={t("common.delete")}
        danger
        onConfirm={() => void trashPage()}
        onCancel={() => setAskDel(false)}
      />
      {askSave ? (
        <SaveSheet
          folders={activeFolders}
          current={page?.folder ?? ""}
          onPick={(folder) => void commit(folder)}
          onCreate={addCabinetFolder}
          onClose={() => setAskSave(false)}
        />
      ) : null}
      <button
        type="button"
        onClick={() => startBlank()}
        className="fixed right-4 bottom-[calc(5.25rem+var(--bz-chin))] z-20 grid size-14 place-items-center rounded-full bg-primary text-primary-fg shadow-card md:bottom-6"
        aria-label={t("notes.new")}
      >
        <Plus className="size-6" />
      </button>
    </>
  );
}

function SaveSheet({
  folders,
  current,
  onPick,
  onCreate,
  onClose,
}: {
  folders: CabinetFolder[];
  current: string;
  onPick: (folder: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const tx = useTx();
  const [name, setName] = useState("");
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-end p-4 sm:place-items-center">
      <button type="button" aria-label={tx("Cerrar", "Close")} className="absolute inset-0 bz-scrim" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative max-h-[88dvh] w-full max-w-md overflow-auto rounded-xl bg-surface p-5 shadow-card">
        <h2 className="font-display text-xl font-semibold">{tx("¿En qué carpeta?", "Which folder?")}</h2>
        <p className="mt-1 text-sm text-muted">
          {tx(
            "Toda nota se guarda en una carpeta. No especificada es para lo que no encaja en las otras.",
            "Every note is saved in a folder. Unspecified is for what does not fit the others.",
          )}
        </p>
        <div className="mt-4 grid gap-2">
          {folders.map((folder) => (
            <Button
              key={folder.id}
              type="button"
              variant={folder.name === current ? "primary" : "outline"}
              onClick={() => onPick(folder.name)}
            >
              {folder.name}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tx("Nueva carpeta", "New folder")}
            aria-label={tx("Nueva carpeta", "New folder")}
            className="h-11"
          />
          <Button
            type="button"
            size="sm"
            disabled={!name.trim()}
            onClick={() => {
              const next = name.trim().slice(0, 40);
              if (!next) return;
              onCreate(next);
              onPick(next);
            }}
          >
            {tx("Crear", "Create")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NotePhotos({
  pageId,
  title,
  canAdd = true,
  pending = [],
  onPending,
}: {
  pageId: number;
  title: string;
  canAdd?: boolean;
  pending?: string[];
  onPending?: (next: string[]) => void;
}) {
  if (!PHOTOS_ENABLED) return null;
  const tx = useTx();
  const qc = useQueryClient();
  const push = useUndo((s) => s.push);
  const [open, setOpen] = useState<PadPhoto | null>(null);
  const [dropId, setDropId] = useState<number | null>(null);
  const photos = useQuery({
    queryKey: ["pad-photos", pageId],
    queryFn: () => listPadPhotos({ data: { pageId } }),
    enabled: pageId > 0,
    staleTime: 30_000,
  });
  const local = pageId <= 0;
  const list: PadPhoto[] = local
    ? pending.map((data, index) => ({ id: index + 1, data, createdAt: "" }))
    : (photos.data ?? []);
  function pick(data: string) {
    if (!local) {
      add.mutate(data);
      return;
    }
    if (pending.length >= 6) {
      toast.error(tx("No se pudo guardar la foto. Máximo 6 por nota.", "Could not save the photo. Six per note."));
      return;
    }
    onPending?.([...pending, data]);
  }
  const add = useMutation({
    mutationFn: (data: string) => addPadPhoto({ data: { pageId, data } }),
    onSuccess: async (res) => {
      if (!res.ok) toast.error(tx("No se pudo guardar la foto. Máximo 6 por nota.", "Could not save the photo. Six per note."));
      else toast.success(tx("Foto guardada en la nota.", "Photo saved on the note."));
      await qc.invalidateQueries({ queryKey: ["pad-photos", pageId] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => deletePadPhoto({ data: { id } }),
    onSuccess: async () => {
      setDropId(null);
      setOpen(null);
      await qc.invalidateQueries({ queryKey: ["pad-photos", pageId] });
    },
  });

  async function share(src: string, name: string) {
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], `${name}.jpg`, { type: blob.type || "image/jpeg" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: name });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
    const link = document.createElement("a");
    link.href = src;
    link.download = `${name}.jpg`;
    link.click();
    toast(tx("La foto se descargó para enviarla desde el teléfono.", "The photo downloaded so you can send it from the phone."));
  }

  async function savePhoto(src: string, name: string) {
    const file = `${name.replace(/[^\w\s.-]+/g, "").trim().slice(0, 40) || "nota"}.jpg`;
    try {
      await downloadHref(file, src);
      toast(tx("Foto guardada en el teléfono.", "Photo saved on the phone."));
    } catch {
      toast.error(tx("No se pudo descargar la foto.", "Could not download the photo."));
    }
  }

  if (!canAdd && list.length === 0) return null;

  return (
    <div className="mt-3">
      {canAdd && list.length < 6 ? <PhotoPicker bare onPick={pick} /> : null}
      {canAdd && list.length >= 6 ? (
        <p className="text-sm text-muted">{tx("Esta nota ya tiene 6 fotos.", "This note already has 6 photos.")}</p>
      ) : null}
      {list.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {list.map((photo) => (
            <li key={photo.id}>
              <button type="button" className="block w-full" onClick={() => setOpen(photo)}>
                <img src={photo.data} alt={title || tx("Nota", "Note")} className="aspect-square w-full rounded-md object-cover" />
              </button>
              <div className="mt-1 flex items-center justify-between">
                <button
                  type="button"
                  aria-label={tx("Compartir", "Share")}
                  className="grid size-8 place-items-center rounded-full text-fg"
                  onClick={() => void share(photo.data, title || "nota")}
                >
                  <Share2 className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={tx("Descargar", "Download")}
                  className="grid size-8 place-items-center rounded-full text-fg"
                  onClick={() => void savePhoto(photo.data, title || "nota")}
                >
                  <Download className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={tx("Quitar", "Remove")}
                  className="grid size-8 place-items-center rounded-full text-late"
                  onClick={() => setDropId(photo.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[85] grid place-items-center bz-scrim bz-scrim-deep p-4">
              <button type="button" className="absolute inset-0" aria-label={tx("Cerrar", "Close")} onClick={() => setOpen(null)} />
              <div className="relative w-full max-w-lg">
                <img src={open.data} alt={title || tx("Nota", "Note")} className="max-h-[70vh] w-full rounded-xl bg-surface object-contain" />
                <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  aria-label={tx("Cerrar", "Close")}
                  className="grid size-11 shrink-0 place-items-center rounded-md bg-surface text-fg"
                  onClick={() => setOpen(null)}
                >
                  <X className="size-5" />
                </button>
                  <button
                    type="button"
                    aria-label={tx("Compartir", "Share")}
                    className="grid size-11 shrink-0 place-items-center rounded-md bg-surface text-fg"
                    onClick={() => void share(open.data, title || "nota")}
                  >
                    <Share2 className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={tx("Descargar", "Download")}
                    className="grid size-11 shrink-0 place-items-center rounded-md bg-surface text-fg"
                    onClick={() => void savePhoto(open.data, title || "nota")}
                  >
                    <Download className="size-5" />
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <ConfirmDialog
        open={dropId != null}
        title={tx("¿Quitar esta foto?", "Remove this photo?")}
        description={tx("Se borra de la nota. El texto se queda.", "It leaves the note. The text stays.")}
        confirmLabel={tx("Quitar", "Remove")}
        danger
        pending={remove.isPending}
        onConfirm={() => {
          if (local) {
            const index = (dropId ?? 0) - 1;
            const shot = pending[index];
            if (shot == null || !onPending) return;
            const before = pending;
            const next = before.filter((_, i) => i !== index);
            onPending(next);
            setDropId(null);
            setOpen(null);
            push({
              label: tx("Quitar foto", "Remove photo"),
              undo: async () => onPending(before),
              redo: async () => onPending(next),
            });
            return;
          }
          const photo = list.find((item) => item.id === dropId);
          if (!photo) return;
          const shot = photo.data;
          const pid = pageId;
          remove.mutate(photo.id, {
            onSuccess: () => {
              push({
                label: tx("Quitar foto", "Remove photo"),
                undo: async () => {
                  await addPadPhoto({ data: { pageId: pid, data: shot } });
                  await qc.invalidateQueries({ queryKey: ["pad-photos", pid] });
                },
                redo: async () => {
                  const again = await listPadPhotos({ data: { pageId: pid } });
                  const hit = [...again].reverse().find((item) => item.data === shot);
                  if (hit) await deletePadPhoto({ data: { id: hit.id } });
                  await qc.invalidateQueries({ queryKey: ["pad-photos", pid] });
                },
              });
            },
          });
        }}
        onCancel={() => setDropId(null)}
      />
    </div>
  );
}

function WeekAccordion({
  days,
  openDay,
  onToggle,
}: {
  days: PadDay[];
  openDay: string;
  onToggle: (date: string) => void;
}) {
  const { t } = useI18n();
  const tx = useTx();
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem("ols-week-pin") === "1";
    } catch {
      return false;
    }
  });
  const [sectionOpen, setSectionOpen] = useState(() => {
    try {
      return localStorage.getItem("ols-week-open") !== "0";
    } catch {
      return true;
    }
  });
  const shown = pinned || sectionOpen;
  return (
    <section className="rounded-xl bg-surface p-2 shadow-card">
      <div className="flex items-center gap-1 px-2 pt-2">
        <button
          type="button"
          aria-expanded={shown}
          onClick={() => {
            if (pinned) return;
            const next = !sectionOpen;
            setSectionOpen(next);
            try {
              localStorage.setItem("ols-week-open", next ? "1" : "0");
            } catch {
              /* ignore */
            }
          }}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-1 text-left"
        >
          <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", !shown && "-rotate-90")} />
          <h2 className="truncate font-display text-lg font-semibold">{t("notes.week")}</h2>
        </button>
        <Hint topic="esta-semana" />
        <button
          type="button"
          aria-pressed={pinned}
          aria-label={pinned ? tx("Quitar el pin de esta semana", "Unpin this week") : tx("Fijar esta semana abierta", "Pin this week open")}
          onClick={() => {
            const next = !pinned;
            setPinned(next);
            if (next) setSectionOpen(true);
            try {
              localStorage.setItem("ols-week-pin", next ? "1" : "0");
              if (next) localStorage.setItem("ols-week-open", "1");
            } catch {
              /* ignore */
            }
          }}
          className={cn("grid size-10 shrink-0 place-items-center rounded-full", pinned ? "text-primary" : "text-muted")}
        >
          <Pin className="size-4" />
        </button>
      </div>
      {shown ? (
      <ul className="mt-2 grid gap-1">
        {days.map((d) => {
          const open = openDay === d.date;
          const label = weekdayOptions().find((w) => w.value === d.weekday)?.label ?? d.date;
          return (
            <li key={d.date} className="rounded-md bg-bg">
              <button
                type="button"
                onClick={() => onToggle(d.date)}
                className="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left"
              >
                <span className="min-w-0 truncate font-semibold first-letter:uppercase">
                  {label}
                  <span className="ml-2 text-sm font-medium text-muted">{formatDay(d.date, "d MMM")}</span>
                </span>
                <span className="flex items-center gap-2 text-sm text-muted">
                  {d.items.length} {d.items.length === 1 ? t("notes.yard") : t("notes.yards")}
                  <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
                </span>
              </button>
              {open ? (
                d.items.length === 0 ? (
                  <p className="px-3 pb-3 text-sm text-muted">{t("notes.noneDay")}</p>
                ) : (
                  <ul className="grid gap-0.5 px-1 pb-2">
                    {d.items.map((j) => (
                      <li key={j.id}>
                        <Link
                          to="/clientes/$id"
                          params={{ id: String(j.clientId) }}
                          className="flex min-h-11 items-center justify-between gap-2 rounded-sm px-2 text-sm hover:bg-sun"
                        >
                          <span className="min-w-0 truncate font-semibold">{j.clientName}</span>
                          <span className={cn("shrink-0 tabular-nums", j.status === "done" ? "text-done" : "font-semibold")}>
                            {money(j.amount)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      ) : null}
    </section>
  );
}
