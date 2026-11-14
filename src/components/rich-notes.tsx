import { Bold, Eraser, Italic, List, ListOrdered, Palette, Redo, Underline, Undo } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Plain text for search and lists. The editor itself keeps the formatting. */
export function htmlToNote(raw: string) {
  const amp = "&";
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|li|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(new RegExp(amp + "nbsp;", "g"), " ")
    .replace(new RegExp(amp + "amp;", "g"), amp)
    .replace(new RegExp(amp + "lt;", "g"), "<")
    .replace(new RegExp(amp + "gt;", "g"), ">")
    .replace(new RegExp(amp + "quot;", "g"), '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitize(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+=("[^"]*"|'[^']*')/gi, "");
}

function toEditorHtml(raw: string) {
  if (!raw) return "";
  if (/<[a-z][\s\S]*>/i.test(raw)) return sanitize(raw);
  return raw
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/\n/g, "<br>");
}

export function noteReaderHtml(raw: string) {
  return toEditorHtml(raw);
}

function textOf(root: ParentNode) {
  let out = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    out += node.textContent ?? "";
    node = walker.nextNode();
  }
  return out;
}

function textOfHtml(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  return textOf(root);
}

function pointAt(root: HTMLElement, index: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let last: Text | null = null;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (index < seen + len) return { node, offset: index - seen };
    seen += len;
    last = node;
    node = walker.nextNode() as Text | null;
  }
  if (last && index === seen) return { node: last, offset: last.textContent?.length ?? 0 };
  return null;
}

/** One history step per letter, so a click can walk back a single character. */
function charSteps(beforeHtml: string, afterHtml: string) {
  if (beforeHtml === afterHtml) return [];
  const before = document.createElement("div");
  before.innerHTML = beforeHtml;
  const after = document.createElement("div");
  after.innerHTML = afterHtml;
  const a = textOf(before);
  const b = textOf(after);
  if (a === b) return [afterHtml];
  let start = 0;
  const max = Math.min(a.length, b.length);
  while (start < max && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const removed = a.slice(start, endA);
  const inserted = b.slice(start, endB);
  if (removed.length + inserted.length > 400) return [afterHtml];
  const root = document.createElement("div");
  root.innerHTML = beforeHtml;
  const steps: string[] = [];
  for (let k = removed.length - 1; k >= 0; k -= 1) {
    const pos = pointAt(root, start + k);
    if (pos) pos.node.deleteData(pos.offset, 1);
    steps.push(root.innerHTML);
  }
  for (let k = 0; k < inserted.length; k += 1) {
    const pos = pointAt(root, start + k);
    if (pos) pos.node.insertData(pos.offset, inserted[k] ?? "");
    else root.appendChild(document.createTextNode(inserted[k] ?? ""));
    steps.push(root.innerHTML);
  }
  if (steps.length === 0) return [afterHtml];
  steps[steps.length - 1] = afterHtml;
  return steps.filter((html, index) => html !== (index === 0 ? beforeHtml : steps[index - 1]));
}

function oneChar(from: string, to: string) {
  if (from === to) return null;
  let start = 0;
  const max = Math.min(from.length, to.length);
  while (start < max && from[start] === to[start]) start += 1;
  let endFrom = from.length;
  let endTo = to.length;
  while (endFrom > start && endTo > start && from[endFrom - 1] === to[endTo - 1]) {
    endFrom -= 1;
    endTo -= 1;
  }
  const removed = from.slice(start, endFrom);
  const inserted = to.slice(start, endTo);
  if (removed.length + inserted.length !== 1) return null;
  return removed || inserted;
}

type MentionClient = { id: number; name: string; phone?: string | null; cue?: string | null };

export function RichNotes({
  value,
  onChange,
  onDraft,
  draftKey,
  placeholder = "Escribe aquí",
  className,
  find = "",
  clients,
  cornerUndo,
  present,
}: {
  value: string;
  onChange: (text: string) => void;
  /** Called while typing. The box is not rewritten until it loses focus. */
  onDraft?: (text: string) => void;
  draftKey?: string;
  placeholder?: string;
  className?: string;
  clients?: MentionClient[];
  find?: string;
  cornerUndo?: boolean;
  /** Presentación (B6): data-present anchor for this editor, minted by the caller. */
  present?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const focused = useRef(false);
  const htmlRef = useRef("");
  const [mention, setMention] = useState<string | null>(null);
  const [empty, setEmpty] = useState(() => htmlToNote(value).length === 0);
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [colorsOpen, setColorsOpen] = useState(false);
  const [ink, setInk] = useState("");
  const line = useRef<string[]>([""]);
  const at = useRef(0);
  const applying = useRef(false);
  const holdTimer = useRef(0);
  const holdRepeat = useRef(0);
  const holdFired = useRef(false);
  const holding = useRef(false);
  const [hist, setHist] = useState({ undo: false, redo: false });
  const [askClear, setAskClear] = useState(false);
  const tx = useTx();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || focused.current) return;
    const next = toEditorHtml(value);
    if (el.innerHTML !== next) el.innerHTML = next;
    htmlRef.current = el.innerHTML;
    if (at.current === 0 && line.current.length === 1 && line.current[0] === "") {
      line.current = [el.innerHTML];
    }
    setEmpty(htmlToNote(el.innerHTML).length === 0);
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    const needle = find.trim().toLowerCase();
    if (!el || !needle) return;
    const text = el.innerText.toLowerCase();
    const idx = text.indexOf(needle);
    if (idx < 0) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let seen = 0;
    let node = walker.nextNode();
    while (node) {
      const chunk = node.textContent ?? "";
      if (seen + chunk.length > idx) {
        const start = idx - seen;
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, Math.min(chunk.length, start + needle.length));
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        el.focus({ preventScroll: true });
        break;
      }
      seen += chunk.length;
      node = walker.nextNode();
    }
  }, [find]);

  function readCaret() {
    const root = ref.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) return "";
    const range = sel.getRangeAt(0).cloneRange();
    range.selectNodeContents(root);
    range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
    return range.toString();
  }

  function look() {
    const upto = readCaret();
    const match = /@([^\s@]{0,40})$/.exec(upto);
    setMention(match ? match[1] : null);
  }

  function remember() {
    const el = ref.current;
    if (!el) return;
    htmlRef.current = el.innerHTML;
    setEmpty(htmlToNote(el.innerHTML).length === 0);
    onDraft?.(el.innerHTML);
    if (draftKey) {
      try {
        sessionStorage.setItem(draftKey, el.innerHTML);
      } catch {
        /* ignore */
      }
    }
    look();
    if (applying.current) return;
    const html = el.innerHTML;
    const base = line.current[at.current] ?? "";
    if (html === base) return;
    const steps = charSteps(base, html);
    if (steps.length === 0) return;
    const merged = [...line.current.slice(0, at.current + 1), ...steps];
    const overflow = Math.max(0, merged.length - 800);
    line.current = overflow > 0 ? merged.slice(overflow) : merged;
    at.current = line.current.length - 1;
    setHist({ undo: at.current > 0, redo: false });
  }

  function wipeNote() {
    const previous = line.current[at.current] ?? "";
    if (htmlToNote(previous).length === 0) {
      setAskClear(false);
      return;
    }
    line.current = [...line.current.slice(0, at.current + 1), ""];
    at.current = line.current.length - 1;
    applyHtml("");
    setAskClear(false);
  }

  function applyHtml(html: string) {
    const el = ref.current;
    if (!el) return;
    applying.current = true;
    el.innerHTML = html;
    htmlRef.current = html;
    setEmpty(htmlToNote(html).length === 0);
    onDraft?.(html);
    onChange(html);
    applying.current = false;
    setHist({ undo: at.current > 0, redo: at.current < line.current.length - 1 });
  }

  function wordSteps(dir: -1 | 1) {
    let count = 0;
    let index = at.current;
    let sawLetter = false;
    while (count < 24) {
      const next = index + dir;
      if (next < 0 || next >= line.current.length) break;
      const ch = oneChar(textOfHtml(line.current[index] ?? ""), textOfHtml(line.current[next] ?? ""));
      if (ch == null) return count === 0 ? 1 : count;
      if (/\s/.test(ch)) {
        if (sawLetter) return count + 1;
      } else sawLetter = true;
      count += 1;
      index = next;
    }
    return Math.max(1, count);
  }

  function move(dir: -1 | 1, count: number) {
    let moved = 0;
    while (moved < count) {
      const next = at.current + dir;
      if (next < 0 || next >= line.current.length) break;
      at.current = next;
      moved += 1;
    }
    if (moved === 0) {
      stopHold();
      return;
    }
    applyHtml(line.current[at.current] ?? "");
  }

  function stopHold() {
    window.clearTimeout(holdTimer.current);
    window.clearInterval(holdRepeat.current);
    holdTimer.current = 0;
    holdRepeat.current = 0;
  }

  function startHold(dir: -1 | 1) {
    stopHold();
    holding.current = true;
    holdFired.current = false;
    holdTimer.current = window.setTimeout(() => {
      holdFired.current = true;
      move(dir, wordSteps(dir));
      holdRepeat.current = window.setInterval(() => move(dir, wordSteps(dir)), 160);
    }, 320);
  }

  function endHold(dir: -1 | 1) {
    if (!holding.current) return;
    holding.current = false;
    const fired = holdFired.current;
    stopHold();
    if (!fired) move(dir, 1);
  }

  useEffect(() => stopHold, []);

  function syncMarks() {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || !el.contains(sel.anchorNode) || !focused.current) {
      setMarks({});
      return;
    }
    const block = document.queryCommandValue("formatBlock").replace(/[<>]/g, "").toLowerCase();
    setMarks({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
      insertOrderedList: document.queryCommandState("insertOrderedList"),
      h2: block === "h2",
    });
  }

  useEffect(() => {
    const onSel = () => syncMarks();
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  function format(command: string, arg?: string) {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    document.execCommand(command, false, arg);
    if (command === "foreColor" && arg) setInk(arg);
    remember();
    syncMarks();
  }

  function pick(client: MentionClient) {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    const upto = readCaret();
    const match = /@([^\s@]{0,40})$/.exec(upto);
    if (!match) return;
    const range = sel.getRangeAt(0);
    const drop = match[0].length;
    const node = range.endContainer;
    if (node.nodeType === Node.TEXT_NODE && (node.textContent?.length ?? 0) >= drop) {
      const end = range.endOffset;
      range.setStart(node, Math.max(0, end - drop));
      range.deleteContents();
      const insert = `@${client.name.trim()} `;
      range.insertNode(document.createTextNode(insert));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    setMention(null);
    remember();
  }

  const query = (mention ?? "").trim().toLowerCase();
  const suggestions =
    mention == null
      ? []
      : (clients ?? [])
          .filter((client) => client.name.trim())
          .map((client) => ({ client, name: client.name.trim().toLowerCase() }))
          .filter((row) => !query || row.name.startsWith(query) || row.name.includes(query))
          .sort((a, b) => Number(b.name.startsWith(query)) - Number(a.name.startsWith(query)) || a.name.localeCompare(b.name, "es"))
          .slice(0, 6)
          .map((row) => row.client);

  useEffect(() => {
    if (suggestions.length === 0) {
      setMenuBox(null);
      return;
    }
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuBox({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    place();
    document.body.setAttribute("data-mention-guard", "");
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.setTimeout(() => document.body.removeAttribute("data-mention-guard"), 450);
    };
  }, [suggestions.length, mention]);

  const colors = [
    { id: "ink", label: "Negro", value: "#1c1917" },
    { id: "blue", label: "Azul oscuro", value: "#1e3a8a" },
    { id: "green", label: "Verde oscuro", value: "#14532d" },
    { id: "red", label: "Rojo oscuro", value: "#7f1d1d" },
    { id: "gold", label: "Amarillo oscuro", value: "#854d0e" },
  ];
  const tools = [
    { label: "Negrita", command: "bold", icon: Bold },
    { label: "Cursiva", command: "italic", icon: Italic },
    { label: "Subrayado", command: "underline", icon: Underline },
    { label: "Lista", command: "insertUnorderedList", icon: List },
    { label: "Lista numerada", command: "insertOrderedList", icon: ListOrdered },
  ];

  return (
    <div className="bz-rt relative z-30">
      <div className="bz-rt-bar mb-1.5 flex flex-wrap gap-1">
        {tools.map((tool) => (
          <button
            key={tool.command}
            type="button"
            aria-label={tool.label}
            title={tool.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => format(tool.command)}
            className={cn(
              "bz-rt-tool grid size-10 place-items-center rounded-sm bg-surface text-fg shadow-card",
              marks[tool.command] && "format-on",
            )}
          >
            <tool.icon className="size-4" />
          </button>
        ))}
        <button
          type="button"
          aria-label={tx("Título", "Heading")}
          title={tx("Título", "Heading")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => format("formatBlock", "h2")}
          className={cn(
            "bz-rt-tool h-10 rounded-sm bg-surface px-2.5 text-sm font-semibold shadow-card",
            marks.h2 && "format-on",
          )}
        >
          {tx("Título", "Heading")}
        </button>
        <span className="inline-flex items-center">
          <button
            type="button"
            aria-expanded={colorsOpen}
            aria-label={tx("Color del texto", "Text color")}
            title={tx("Color del texto", "Text color")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setColorsOpen((open) => !open)}
            className={cn("bz-rt-tool grid size-10 place-items-center rounded-sm bg-surface text-fg shadow-card", colorsOpen && "format-on")}
          >
            <Palette className="size-4" />
          </button>
          {colorsOpen
            ? colors.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  aria-label={color.label}
                  title={color.label}
                  aria-pressed={ink === color.value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => format("foreColor", color.value)}
                  className={cn(
                    "bz-rt-tool grid size-10 place-items-center rounded-sm bg-surface shadow-card",
                    ink === color.value && "ring-2 ring-primary ring-offset-2 ring-offset-bg",
                  )}
                >
                  <span className="size-4 rounded-full ring-1 ring-border" style={{ backgroundColor: color.value }} />
                </button>
              ))
            : null}
        </span>
      </div>
      <div ref={anchorRef} className="relative z-30">
        {empty ? (
          <p className="bz-rt-ph pointer-events-none absolute top-2 left-3 z-10 text-sm text-subtle">{placeholder}</p>
        ) : null}
        <div
          ref={ref}
          data-note-editor="1"
          data-present={present ?? "nota-texto"}
          contentEditable
          role="textbox"
          aria-multiline="true"
          spellCheck
          suppressContentEditableWarning
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            const html = ref.current?.innerHTML ?? "";
            htmlRef.current = html;
            onChange(html);
            window.setTimeout(() => setMention(null), 180);
          }}
          onInput={remember}
          onKeyUp={look}
          onMouseUp={look}
          className={cn(
            "note-body bz-rt-page min-h-36 w-full rounded-md bg-surface px-3 py-2 text-sm leading-relaxed shadow-card focus:outline-none",
            cornerUndo && !empty && "pr-10",
            cornerUndo && (hist.undo || hist.redo) && "pb-10",
            className,
          )}
        />
        {cornerUndo && !empty ? (
          <button
            type="button"
            aria-label={tx("Limpiar nota", "Clear note")}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setAskClear(true)}
            className="absolute top-1.5 right-1.5 z-20 grid size-8 place-items-center rounded-full bg-surface/95 text-muted shadow-card ring-1 ring-border"
          >
            <Eraser className="size-3.5" />
          </button>
        ) : null}
        {cornerUndo && (hist.undo || hist.redo) ? (
          <div className="absolute right-1.5 bottom-1.5 z-20 flex items-center rounded-full bg-surface/95 px-0.5 shadow-card ring-1 ring-border">
            <button
              type="button"
              aria-label="Deshacer"
              disabled={!hist.undo}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!hist.undo) return;
                startHold(-1);
              }}
              onPointerUp={() => endHold(-1)}
              onPointerLeave={() => endHold(-1)}
              onPointerCancel={() => endHold(-1)}
              className="grid size-8 touch-none place-items-center rounded-full text-muted disabled:opacity-30"
            >
              <Undo className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Rehacer"
              disabled={!hist.redo}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!hist.redo) return;
                startHold(1);
              }}
              onPointerUp={() => endHold(1)}
              onPointerLeave={() => endHold(1)}
              onPointerCancel={() => endHold(1)}
              className="grid size-8 touch-none place-items-center rounded-full text-muted disabled:opacity-30"
            >
              <Redo className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        front
        open={askClear}
        title={tx("¿Limpiar esta nota?", "Clear this note?")}
        description={tx("Se borra el texto. Puedes deshacerlo.", "The text is cleared. You can undo it.")}
        confirmLabel={tx("Limpiar", "Clear")}
        danger
        onConfirm={wipeNote}
        onCancel={() => setAskClear(false)}
      />
      {suggestions.length > 0 && menuBox && typeof document !== "undefined"
        ? createPortal(
            <ul
              data-mention-open=""
              className="fixed z-[80] max-h-52 overflow-auto rounded-md bg-surface shadow-card"
              style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
              onPointerDown={(e) => e.preventDefault()}
            >
              {suggestions.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center px-3 text-left text-sm font-semibold"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      pick(client);
                    }}
                  >
                    @{client.name.trim()}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
