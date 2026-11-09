import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages, MessageSquare, Mic, NotebookPen, Type } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { smsHref, waHref } from "@/lib/format";
import { useTx, useI18n } from "@/lib/i18n";
import { getPad, getSettings, polishYardText, updateSettings } from "@/lib/server/lawn";
import { translateToEnglish } from "@/lib/translate";
import { dictMessage, openDictationSettings, startDictation, type DictSession } from "@/lib/dictate";
import { DEFAULT_MESSAGE_PRESETS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { chipsetStyle } from "@/lib/chipset";

function punctuate(raw: string): string {
  let t = raw.trim().replace(/\s+/g, " ");
  if (!t) return t;
  t = t.charAt(0).toLocaleUpperCase("es") + t.slice(1);
  if (/[.?!…]$/.test(t)) return t;
  if (
    /^(qué|que|cómo|como|cuándo|cuando|dónde|donde|por qué|cuál|cual|quién|quien|cuánto|cuanto|what|how|when|where|why|who|which|is |are |do |does )/i.test(
      t,
    )
  ) {
    return `${t}?`;
  }
  if (/^(oye|wow|guau|cuidado|hey|mira|ay|ojo|alto|stop|bravo)\b/i.test(t)) return `${t}!`;
  return `${t}.`;
}

function htmlToText(html: string): string {
  const box = document.createElement("div");
  box.innerHTML = html;
  return (box.innerText || "").replace(/\n{3,}/g, "\n\n").trim();
}

export function MessageComposer({
  phone,
  name,
  compact,
  tight,
  wide,
  channel = "sms",
  initialText,
  label,
  className,
}: {
  phone: string;
  name: string;
  compact?: boolean;
  tight?: boolean;
  /** 1.5.12 (spec 2026-11-04): a wide band-shaped button that shares a row with call/map (work card). */
  wide?: boolean;
  channel?: "sms" | "whatsapp";
  initialText?: string;
  /** Text on the full-width button (default: Mensaje / WhatsApp). */
  label?: string;
  className?: string;
}) {
  const tx = useTx();
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  const [text, setText] = useState(initialText ?? "");
  const [mode, setMode] = useState<"type" | "dict" | "tr">("type");
  const [listening, setListening] = useState(false);
  const [translating, setTranslating] = useState(false);
  // 1.5.04: the first translation on the phone downloads its translator once (one line under the text)
  const [trDownload, setTrDownload] = useState(false);
  // 1.5.05: the first time in the Android app, one line says why the microphone is asked for
  const [micWhy, setMicWhy] = useState(false);
  const recRef = useRef<DictSession | null>(null);
  const textRef = useRef(text);
  textRef.current = text;
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    return () => recRef.current?.cancel();
  }, []);

  function listen(translate: boolean) {
    recRef.current?.cancel();
    const join = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b).trim();
    const base = textRef.current.trim();
    setListening(true);
    let session: DictSession | null = null;
    session = startDictation(locale === "en" ? "en-US" : "es-US", {
      onState: (st) => setMicWhy(st === "asking"),
      onPartial: (piece) => { setMicWhy(false); setText(join(base, piece)); },
      onFinal: (piece) => {
        setMicWhy(false);
        if (translate) {
          setText(base);
          setTranslating(true);
          void translateToEnglish(piece, (st) => { if (st === "download") setTrDownload(true); })
            .then((res) => {
              if (res.ok) setText((prev) => join(prev, res.text));
              else toast.error(res.error);
            })
            .catch(() => toast.error(tx("No se pudo traducir", "Could not translate")))
            .finally(() => { setTranslating(false); setTrDownload(false); });
          return;
        }
        const local = punctuate(piece);
        setText(join(base, local));
        void polishYardText({ data: { text: local, lang: locale } }).then((res) => {
          if (!res.ok || !res.text) return;
          setText((prev) => (prev.endsWith(local) ? `${prev.slice(0, -local.length)}${res.text}` : prev));
        });
      },
      onError: (e, code, attempts) => {
        setMicWhy(false);
        const m = dictMessage(e);
        if (e === "none" || e === "update") {
          setMode("type");
          window.setTimeout(() => areaRef.current?.focus(), 30);
        }
        // 1.5.19 (android-7): when the phone's recognizer reports its own error code, the notice carries it —
        // a bare "No se pudo dictar" taught us nothing about which service failed or why.
        // 1.5.24 (android-8): the whole chain rides along — every service tried, in order, with its code.
        const codes = attempts
          ? attempts.split(",").map((a) => a.split(":")[1]).filter(Boolean).join(" · ")
          : "";
        if (attempts || code) { try { window.localStorage.setItem("bz-dict-error", attempts ?? `${e}:${code}`); } catch { /* ignore */ } }
        toast.error(codes ? `${m.text} (códigos ${codes})` : code ? `${m.text} (código ${code})` : m.text, m.action
          ? {
              duration: 8000,
              action: {
                label: m.action === "settings" ? tx("Abrir ajustes", "Open settings") : tx("Permitir", "Allow"),
                onClick: () => (m.action === "settings" ? openDictationSettings() : listen(translate)),
              },
            }
          : undefined);
      },
      onEnd: () => {
        setMicWhy(false);
        setListening(false);
        if (recRef.current === session) recRef.current = null;
      },
    });
    recRef.current = session;
  }

  function translateText() {
    recRef.current?.cancel();
    setListening(false);
    const current = text.trim();
    if (!current) {
      setMode("tr");
      listen(true);
      return;
    }
    setMode("tr");
    setTranslating(true);
    void translateToEnglish(current, (st) => { if (st === "download") setTrDownload(true); })
      .then((res) => {
        if (res.ok) setText(res.text);
        else toast.error(res.error);
      })
      .catch(() => toast.error(tx("No se pudo traducir", "Could not translate")))
      .finally(() => { setTranslating(false); setTrDownload(false); });
  }

  function send() {
    setAsk(false);
    setOpen(false);
    if (channel === "whatsapp") {
      const href = waHref(phone, text);
      if (href) window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    // 1.5.50 (C3): an implausible number has no sms: link — send() simply does not go.
    const sms = smsHref(phone, text);
    if (sms) window.location.href = sms;
  }

  function openSheet(event?: { preventDefault: () => void; stopPropagation: () => void }) {
    event?.preventDefault();
    event?.stopPropagation();
    if (initialText) setText(initialText);
    setOpen(true);
  }

  const sheet = open ? (
    <ComposerSheet
      name={name}
      text={text}
      setText={setText}
      mode={mode}
      listening={listening}
      translating={translating}
      trDownload={trDownload}
      micWhy={micWhy}
      areaRef={areaRef}
      channel={channel}
      onType={() => {
        recRef.current?.cancel();
        setMode("type");
        setListening(false);
        window.requestAnimationFrame(() => {
          const el = areaRef.current;
          el?.focus();
          if (!el) return;
          const n = el.value.length;
          el.setSelectionRange(n, n);
        });
      }}
      onListen={() => {
        // a second tap while listening ends the line (what was said is kept)
        if (listening && mode === "dict" && recRef.current) { recRef.current.stop(); return; }
        setMode("dict");
        listen(false);
      }}
      onTranslate={translateText}
      onClose={() => {
        recRef.current?.cancel();
        setOpen(false);
        setListening(false);
      }}
      onSend={() => setAsk(true)}
    />
  ) : null;

  const confirm = (
    <ConfirmDialog
      open={ask}
      title={
        channel === "whatsapp"
          ? tx(`¿Abrir WhatsApp de ${name}?`, `Open WhatsApp for ${name}?`)
          : tx(`¿Escribir a ${name}?`, `Text ${name}?`)
      }
      description={
        channel === "whatsapp"
          ? tx(
              "Se abre el WhatsApp de este cliente con el texto listo. Tú lo envías allí. Si no usa WhatsApp, el mensaje no llega.",
              "This client's WhatsApp opens with the text ready. You send it there. If they do not use WhatsApp, the message does not arrive.",
            )
          : tx(
              "Se abre Mensajes de Google (o la app de SMS del teléfono) con el texto listo.",
              "Google Messages (or the phone's texting app) opens with the text ready.",
            )
      }
      confirmLabel={
        channel === "whatsapp"
          ? tx("Sí, abrir WhatsApp", "Yes, open WhatsApp")
          : tx("Sí, abrir mensajes", "Yes, open messages")
      }
      onConfirm={send}
      onCancel={() => setAsk(false)}
    />
  );

  if (channel === "whatsapp" && !waHref(phone)) return null;
  // 1.5.50 (C3): same honesty for SMS — no plausible number, no message button.
  if (channel === "sms" && !smsHref(phone)) return null;

  if (compact) {
    return (
      <>
        <button
          type="button"
          aria-label={
            channel === "whatsapp"
              ? tx(`WhatsApp a ${name}`, `WhatsApp to ${name}`)
              : tx(`Mensaje a ${name}`, `Message to ${name}`)
          }
          onClick={(e) => openSheet(e)}
          className={cn(
            "grid place-items-center font-bold tracking-tight",
            channel === "whatsapp" ? "bz-tone bz-tone-wa" : "bz-tone bz-tone-msg",
            wide
              ? tight
                ? "h-9 min-w-0 flex-1 rounded-md text-[11px]"
                : "h-11 min-w-0 flex-1 rounded-md text-xs"
              : cn("shrink-0 rounded-sm", tight ? "size-8 text-[10px]" : "size-11 text-[11px]"),
          )}
        >
          {channel === "whatsapp" ? "WA" : <MessageSquare className={wide && !tight ? "size-[18px]" : tight ? "size-3.5" : "size-4"} />}
        </button>
        {sheet}
        {confirm}
      </>
    );
  }

  return (
    <>
      <Button type="button" variant="outline" className={cn("w-full", className)} onClick={() => openSheet()}>
        {channel === "whatsapp" ? "WA" : <MessageSquare className="size-4" />}
        {label ?? (channel === "whatsapp" ? "WhatsApp" : tx("Mensaje", "Message"))}
      </Button>
      {sheet}
      {confirm}
    </>
  );
}

function ComposerSheet({
  name,
  text,
  setText,
  mode,
  listening,
  translating,
  trDownload,
  micWhy,
  areaRef,
  onType,
  onListen,
  onTranslate,
  onClose,
  onSend,
  channel,
}: {
  name: string;
  text: string;
  setText: (v: string) => void;
  mode: "type" | "dict" | "tr";
  listening: boolean;
  translating: boolean;
  trDownload: boolean;
  micWhy: boolean;
  areaRef: RefObject<HTMLTextAreaElement | null>;
  onType: () => void;
  onListen: () => void;
  onTranslate: () => void;
  onClose: () => void;
  onSend: () => void;
  channel: "sms" | "whatsapp";
}) {
  const tx = useTx();
  const { locale } = useI18n();
  const [fixing, setFixing] = useState(false);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-end overflow-y-auto p-3 sm:place-items-center sm:p-4">
      <button type="button" aria-label={tx("Cerrar", "Close")} className="absolute inset-0 bz-scrim" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative my-auto w-full min-w-0 max-w-md rounded-xl bg-surface p-4 shadow-card sm:p-5"
      >
        <h2 className="font-display text-xl font-semibold">{tx(`Mensaje a ${name}`, `Message to ${name}`)}</h2>
        <p className="mt-1 text-sm text-muted">
          {channel === "whatsapp"
            ? tx(
                "Escribe, dicta o traduce aquí. Al enviar se pregunta si abrir el WhatsApp con el texto listo.",
                "Type, dictate, or translate here. Sending asks whether to open WhatsApp with the text ready.",
              )
            : tx(
                "Dictar corrige preguntas y exclamaciones. A inglés traduce lo escrito. Traer una nota pega lo del bloc.",
                "Dictate fixes questions and exclamations. To English translates what you wrote. Bring a note pastes from the notepad.",
              )}
        </p>
        <PresetRow onPick={setText} />
        {/* 1.5.18 (Oscar): no dead band under the text. Corregir used to own a whole right-aligned row —
            a tall empty gap between the box and Escribir/Dictar/A inglés. Now Corregir sits small at the
            text box's own bottom-right corner, and the translator/microphone status line takes room only
            while it has something to say. */}
        <div className="relative mt-3">
          <textarea
            ref={areaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            spellCheck
            lang={locale}
            placeholder={tx("Hoy llego a las 10. El corte queda en 40.", "I arrive at 10 today. The cut is 40.")}
            className="w-full rounded-md bg-bg px-3 py-2 pb-9 text-sm shadow-card focus:outline-none"
          />
          <button
            type="button"
            className="absolute right-2 bottom-2 px-1 py-0.5 text-xs font-semibold text-soil"
            onClick={() => {
              const current = text.trim();
              if (!current) return;
              setFixing(true);
              void polishYardText({ data: { text: current, lang: locale } })
                .then((res) => {
                  if (res.text) setText(res.text);
                })
                .finally(() => setFixing(false));
            }}
          >
            {fixing ? tx("Corrigiendo…", "Fixing…") : tx("Corregir", "Fix")}
          </button>
        </div>
        {trDownload || micWhy ? (
          <p role="status" className="mt-2 min-w-0 text-xs font-semibold text-muted">
            {trDownload
              ? tx("Descargando el traductor", "Downloading the translator")
              : tx("El micrófono se usa solo mientras dictas", "The microphone is used only while you dictate")}
          </p>
        ) : null}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onType}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md bg-sun text-xs font-semibold",
              mode === "type" && "ring-2 ring-primary",
            )}
          >
            <Type className="size-4" />
            {tx("Escribir", "Type")}
          </button>
          <button
            type="button"
            onClick={onListen}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md bg-sun text-xs font-semibold",
              mode === "dict" && "ring-2 ring-primary",
            )}
          >
            <Mic className="size-4" />
            {listening && mode === "dict" ? tx("Oyendo…", "Listening…") : tx("Dictar", "Dictate")}
          </button>
          <button
            type="button"
            onClick={onTranslate}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md bg-sun text-xs font-semibold",
              mode === "tr" && "ring-2 ring-primary",
            )}
          >
            <Languages className="size-4" />
            {translating ? tx("Traduciendo…", "Translating…") : tx("A inglés", "To English")}
          </button>
        </div>
        <NotePicker
          onInsert={(block) => setText(text.trim() ? `${text.trim()}\n${block}` : block)}
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {tx("Atrás", "Back")}
          </Button>
          <Button type="button" disabled={!text.trim()} onClick={onSend}>
            {tx("Enviar", "Send")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NotePicker({ onInsert }: { onInsert: (block: string) => void }) {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  const pad = useQuery({
    queryKey: ["pad"],
    queryFn: () => getPad(),
    enabled: open,
    staleTime: 60_000,
  });
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-sun text-sm font-semibold"
      >
        <NotebookPen className="size-4" />
        {open ? tx("Cerrar notas", "Close notes") : tx("Traer una nota", "Bring a note")}
      </button>
      {open ? (
        <ul className="mt-2 max-h-40 overflow-auto rounded-md bg-bg">
          {(pad.data?.pages ?? [])
            .filter((page) => !page.deletedAt)
            .map((page) => (
            <li key={page.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center px-3 text-left text-sm font-semibold"
                onClick={() => {
                  const body = htmlToText(page.body);
                  const block = [page.title || "Nota", body].filter(Boolean).join("\n");
                  if (!block.trim()) return;
                  onInsert(block);
                  setOpen(false);
                }}
              >
                {page.title || tx("Nota", "Note")}
              </button>
            </li>
          ))}
          {pad.isLoading ? <li className="px-3 py-2 text-sm text-muted">{tx("Cargando notas…", "Loading notes…")}</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

export function WhatsAppButton({
  phone,
  name,
  tight,
  wide,
  initialText,
}: {
  phone: string;
  name: string;
  tight?: boolean;
  wide?: boolean;
  initialText?: string;
}) {
  return (
    <MessageComposer
      phone={phone}
      name={name}
      compact
      tight={tight}
      wide={wide}
      channel="whatsapp"
      initialText={initialText}
    />
  );
}

function PresetRow({ onPick }: { onPick: (text: string) => void }) {
  const tx = useTx();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const presets = q.data?.messagePresets?.length ? q.data.messagePresets : DEFAULT_MESSAGE_PRESETS;
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<string[]>(presets);
  const save = useMutation({
    mutationFn: (next: string[]) => updateSettings({ data: { messagePresets: next } }),
    onSuccess: async () => {
      toast.success(tx("Mensajes guardados", "Messages saved"));
      setEdit(false);
      await qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">{tx("Mensajes listos", "Ready messages")}</p>
        <button
          type="button"
          className="text-xs font-semibold text-primary"
          onClick={() => {
            setDraft(presets);
            setEdit((v) => !v);
          }}
        >
          {edit ? tx("Cerrar", "Close") : tx("Editar", "Edit")}
        </button>
      </div>
      {edit ? (
        <div className="grid gap-2">
          {draft.map((line, i) => (
            <input
              key={i}
              value={line}
              maxLength={180}
              onChange={(e) => setDraft((prev) => prev.map((item, idx) => (idx === i ? e.target.value : item)))}
              className="h-10 w-full rounded-sm bg-bg px-2 text-sm"
            />
          ))}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDraft((prev) => (prev.length >= 12 ? prev : [...prev, "Hola."]))}
            >
              {tx("Añadir", "Add")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={save.isPending}
              onClick={() => {
                const next = draft.map((s) => s.trim()).filter(Boolean);
                if (!next.length) return;
                save.mutate(next);
              }}
            >
              {tx("Guardar", "Save")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="bz-chipset" style={chipsetStyle(presets)}>
          {presets.map((line) => (
            <button
              key={line}
              type="button"
              onClick={() => onPick(line)}
              className="bz-chip bz-chip-free bg-sun"
            >
              {line}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
