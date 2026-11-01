import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Lightbulb, ListOrdered, Printer, SearchX } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppShell, TitleSearch } from "@/components/app-shell";
import { richText } from "@/components/hint";
import { fold } from "@/lib/fuzzy";
import { useI18n } from "@/lib/i18n";
import { canGoBack, glow, justPopped, readOrigin, rememberScroll, requestFocus, screenName } from "@/lib/manual/nav";
import { alphaIndex, findTopic, MANUAL_CHAPTERS, MANUAL_TOPICS, pick, topicText, type L, type Numbered } from "@/lib/manual/topics";
import { cn } from "@/lib/utils";
import "@/manual.css";

export const Route = createFileRoute("/manual")({
  validateSearch: (s: Record<string, unknown>): { t?: string } => (typeof s.t === "string" && s.t ? { t: s.t } : {}),
  component: ManualPage,
});

function reduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Wraps every match of the query words in <mark>, accent- and case-blind. */
function marked(text: string, words: string[]): ReactNode {
  if (!words.length) return text;
  const base = Array.from(text, (ch) => fold(ch).charAt(0) || ch).join("");
  const hits: [number, number][] = [];
  for (const w of words) {
    let i = base.indexOf(w);
    while (i >= 0) {
      hits.push([i, i + w.length]);
      i = base.indexOf(w, i + w.length);
    }
  }
  if (!hits.length) return text;
  hits.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const h of hits) {
    const last = merged[merged.length - 1];
    if (last && h[0] <= last[1]) last[1] = Math.max(last[1], h[1]);
    else merged.push([...h]);
  }
  const chars = Array.from(text);
  const out: ReactNode[] = [];
  let at = 0;
  merged.forEach(([a, b], i) => {
    if (a > at) out.push(chars.slice(at, a).join(""));
    out.push(<mark key={i}>{chars.slice(a, b).join("")}</mark>);
    at = b;
  });
  if (at < chars.length) out.push(chars.slice(at).join(""));
  return out;
}

function snippet(text: string, words: string[], size = 120): string {
  const base = fold(text);
  const hit = words.map((w) => base.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (hit == null || text.length <= size) return text.length <= size ? text : `${text.slice(0, size).trimEnd()}…`;
  let start = Math.max(0, hit - 40);
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space > 0 && space < hit) start = space + 1;
  }
  let end = Math.min(text.length, start + size);
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space > hit) end = space;
  }
  const piece = text.slice(start, end).trim().replace(/[,;:]$/, "");
  return `${start > 0 ? "…" : ""}${piece}${end < text.length ? "…" : ""}`;
}

const plain = (s: string) => s.replace(/\[\[|\]\]/g, "");

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = a[i - 1] === b[j - 1] ? prev : Math.min(prev, row[j - 1]!, row[j]!) + 1;
      prev = row[j]!;
      row[j] = next;
    }
  }
  return row[b.length]!;
}

/** Manual search: every word must appear (accents and case aside); longer words forgive one typo. */
function manualHit(words: string[], text: string): boolean {
  if (!words.length) return true;
  const base = fold(text);
  const tokens = base.split(/[^a-z0-9ñ$]+/).filter(Boolean);
  return words.every((w) => {
    if (base.includes(w)) return true;
    if (w.length < 5) return false;
    const limit = w.length >= 8 ? 2 : 1;
    return tokens.some((tok) => Math.abs(tok.length - w.length) <= limit && editDistance(w, tok) <= limit);
  });
}

/** Scroll an element to the top of the view: a long way jumps most of it, the last stretch glides. */
function bringIn(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  // Going down the header slides away; going up it comes back and needs room.
  const room = rect.top < 0 ? 92 : 14;
  const target = Math.max(0, window.scrollY + rect.top - room);
  if (reduced()) {
    window.scrollTo({ top: target, behavior: "auto" });
    return;
  }
  if (Math.abs(rect.top) > 2200) {
    window.scrollTo({ top: target - Math.sign(rect.top) * 420, behavior: "auto" });
  }
  window.scrollTo({ top: target, behavior: "smooth" });
}

function Meadow() {
  // A strip of grass blades along the cover's foot. Pure decoration.
  const blades = Array.from({ length: 46 }, (_, i) => {
    const x = i * 9 + ((i * 37) % 7);
    const h = 10 + ((i * 53) % 15);
    const lean = ((i * 29) % 9) - 4;
    return <path key={i} d={`M${x} 30 Q${x + lean * 0.6} ${30 - h * 0.6} ${x + lean} ${30 - h} Q${x + 2 + lean * 0.4} ${30 - h * 0.5} ${x + 4} 30 Z`} />;
  });
  return (
    <svg className="mn-meadow" viewBox="0 0 420 30" preserveAspectRatio="none" aria-hidden>
      {blades}
    </svg>
  );
}

function ManualPage() {
  const { t: urlTopic } = Route.useSearch();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const tx = (es: string, en: string) => (locale === "en" ? en : es);
  const say = (pair: L) => pick(locale, pair);
  const [findOn, setFindOn] = useState(false);
  const [needle, setNeedle] = useState("");
  const [printing, setPrinting] = useState<string | null>(null);
  const [openCh, setOpenCh] = useState<string[]>(() => [findTopic(urlTopic)?.chapter.id ?? MANUAL_CHAPTERS[0]!.id]);
  const quiet = useRef(false);
  const origin = useMemo(() => readOrigin(), []);
  const back = canGoBack();
  const originName = screenName(origin, locale);
  const query = needle.trim();
  const words = useMemo(
    () => fold(query).split(/\s+/).filter((w) => w.length >= 2),
    [query],
  );
  const results = useMemo(
    () => {
      if (!query) return [];
      const rank = (tp: Numbered) => {
        const title = fold(pick(locale, tp.title));
        if (words.every((w) => title.includes(w))) return 0;
        if (words.some((w) => title.includes(w))) return 1;
        if (words.some((w) => fold(pick(locale, tp.sum)).includes(w))) return 2;
        return 3;
      };
      return MANUAL_TOPICS.filter((tp) => manualHit(words, topicText(tp, locale)))
        .map((tp, i) => ({ tp, i, r: rank(tp) }))
        .sort((a, b) => a.r - b.r || a.i - b.i)
        .map((x) => x.tp);
    },
    [query, words, locale],
  );
  const alpha = useMemo(() => alphaIndex(locale), [locale]);
  const searching = Boolean(query);
  useEffect(() => {
    if (searching) window.scrollTo({ top: 0 });
  }, [searching]);

  /* Arrive at the entry the (?) came from: scroll to it and let it glow for a moment. */
  useEffect(() => {
    if (!urlTopic) return;
    if (quiet.current) {
      quiet.current = false;
      return;
    }
    const entry = findTopic(urlTopic);
    if (!entry) return;
    if (justPopped()) return; // back/forward: the screen comes back where you left it
    let tries = 0;
    let timer = 0;
    const go = () => {
      const el = document.getElementById(`mn-${entry.id}`);
      if (!el) {
        if (tries++ < 40) timer = window.setTimeout(go, 50);
        return;
      }
      bringIn(el);
      window.setTimeout(() => glow(el, "mn-glow", 3200), reduced() ? 0 : 420);
    };
    timer = window.setTimeout(go, 30);
    return () => window.clearTimeout(timer);
  }, [urlTopic]);

  function jump(id: string) {
    setNeedle("");
    setFindOn(false);
    if (id === urlTopic) {
      const el = document.getElementById(`mn-${id}`);
      if (el) {
        bringIn(el);
        window.setTimeout(() => glow(el, "mn-glow", 3200), reduced() ? 0 : 420);
      }
      return;
    }
    void navigate({ to: "/manual", search: { t: id }, replace: true, resetScroll: false });
  }

  function jumpTo(elementId: string) {
    setNeedle("");
    setFindOn(false);
    window.setTimeout(() => {
      const el = document.getElementById(elementId);
      if (el) bringIn(el);
    }, 30);
  }

  async function openInApp(topic: Numbered) {
    const go = topic.go;
    if (!go) return;
    // Keep this spot in the manual: back from the app lands here, on this entry.
    if (urlTopic !== topic.id) {
      quiet.current = true;
      await navigate({ to: "/manual", search: { t: topic.id }, replace: true, resetScroll: false });
    }
    rememberScroll();
    if (go.view) {
      try {
        localStorage.setItem("bz-estudio-view", go.view);
      } catch {
        /* private mode */
      }
    }
    const path = go.to;
    requestFocus({ topic: topic.id, id: go.focus, path });
    void navigate({ to: path, search: (go.search ?? {}) as never });
  }

  function goBack() {
    if (canGoBack()) window.history.back();
    else void navigate({ to: "/ajustes" });
  }

  function print(target: string) {
    setNeedle("");
    setFindOn(false);
    setPrinting(target);
    const done = () => {
      document.body.classList.remove("mn-printing");
      setPrinting(null);
    };
    window.setTimeout(() => {
      document.body.classList.add("mn-printing");
      window.addEventListener("afterprint", () => window.setTimeout(done, 300), { once: true });
      window.print();
      // phones that return from print() early and never fire afterprint
      window.setTimeout(() => {
        if (document.body.classList.contains("mn-printing") && !document.hasFocus()) return;
        done();
      }, 60000);
    }, 60);
  }

  // Esc inside the manual's search clears it first.
  useEffect(() => {
    if (!findOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setNeedle("");
      setFindOn(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [findOn]);

  const label = {
    what: tx("Qué es", "What it is"),
    how: tx("Cómo se usa", "How to use it"),
    tip: tx("Consejo", "Tip"),
  };

  return (
    <AppShell
      title={tx("Manual", "Manual")}
      action={
        <TitleSearch
          open={findOn}
          onToggle={() => {
            setFindOn((v) => !v);
            setNeedle("");
          }}
          value={needle}
          onChange={setNeedle}
          placeholder={tx("Buscar en el manual", "Search the manual")}
          label={tx("Buscar en el manual", "Search the manual")}
        />
      }
    >
      <div
        id="mn-doc"
        className={cn("mn", printing && "is-print", printing && printing !== "all" && "is-print-one")}
        lang={locale === "en" ? "en" : "es"}
      >
        <div className="mn-backrow print-hide">
          <button type="button" className="mn-back" onClick={goBack}>
            <ArrowLeft aria-hidden />
            {back
              ? originName
                ? tx(`Volver a ${originName}`, `Back to ${originName}`)
                : tx("Volver", "Back")
              : tx("Ir a Ajustes", "Go to Settings")}
            <kbd className="mn-esc" aria-hidden>
              Esc
            </kbd>
          </button>
        </div>

        {query ? (
          <section className="mn-results print-hide" aria-live="polite">
            <p className="mn-results-count">
              {results.length === 0
                ? tx("Nada con esas palabras.", "Nothing with those words.")
                : tx(
                    `${results.length} ${results.length === 1 ? "resultado" : "resultados"}`,
                    `${results.length} ${results.length === 1 ? "result" : "results"}`,
                  )}
            </p>
            {results.length === 0 ? (
              <div className="mn-empty">
                <SearchX aria-hidden />
                <span>{tx("Prueba otra palabra, como cobro, meta o huella.", "Try another word, like payment, goal, or fingerprint.")}</span>
              </div>
            ) : (
              <ul className="mn-hits">
                {results.map((tp) => {
                  const body = [tp.sum, tp.what, tp.how, tp.tip].filter(Boolean).map((p) => plain(say(p as L)));
                  const hitText = body.find((b) => words.some((w) => fold(b).includes(w))) ?? body[0]!;
                  return (
                    <li key={tp.id}>
                      <button type="button" className="mn-hit" onClick={() => jump(tp.id)}>
                        <span className="mn-hit-num">{tp.num}</span>
                        <span className="mn-hit-main">
                          <span className="mn-hit-title">{marked(say(tp.title), words)}</span>
                          <span className="mn-hit-text">{marked(snippet(hitText, words), words)}</span>
                          <span className="mn-hit-ch">{say(tp.chapter.title)}</span>
                        </span>
                        <ArrowRight className="mn-hit-arrow" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        <div className={cn("mn-body", query && "is-hidden")}>
          <header className="mn-cover">
            <p className="mn-kicker">
              <BookOpen aria-hidden />
              {tx("Brizna · Manual de uso", "Brizna · User manual")}
            </p>
            <h2 className="mn-cover-title">{tx("Todo lo que hace Brizna, en corto.", "Everything Brizna does, in short.")}</h2>
            <p className="mn-cover-sub">
              {tx(
                "Cada idea empieza con una línea. Si te basta, sigue con tu día. Si quieres más, debajo está el detalle.",
                "Each idea starts with one line. If that is enough, get on with your day. If you want more, the detail is below.",
              )}
            </p>
            <div className="mn-cover-actions print-hide">
              <button type="button" className="mn-btn is-solid" onClick={() => print("all")}>
                <Printer aria-hidden />
                {tx("Imprimir todo", "Print all")}
              </button>
              <button type="button" className="mn-btn" onClick={() => jumpTo("mn-alfabetico")}>
                <ListOrdered aria-hidden />
                {tx("Índice A–Z", "A–Z index")}
              </button>
            </div>
            <p className="mn-cover-foot">
              {MANUAL_CHAPTERS.length} {tx("capítulos", "chapters")} · {MANUAL_TOPICS.length} {tx("temas", "topics")} ·{" "}
              {tx("toca un título para ir", "tap a title to go there")}
            </p>
            <Meadow />
          </header>

          <nav className="mn-toc" id="mn-indice" aria-label={tx("Índice", "Contents")}>
            <h2 className="mn-toc-title">{tx("Índice", "Contents")}</h2>
            <ol className="mn-toc-list">
              {MANUAL_CHAPTERS.map((ch, ci) => {
                const isOpen = openCh.includes(ch.id) || Boolean(printing);
                return (
                  <li key={ch.id} className={cn("mn-toc-ch", isOpen && "is-open")}>
                    <div className="mn-toc-chrow">
                      <button
                        type="button"
                        className="mn-toc-chbtn"
                        aria-expanded={isOpen}
                        aria-controls={`mn-toc-${ch.id}`}
                        onClick={() => setOpenCh((list) => (list.includes(ch.id) ? list.filter((x) => x !== ch.id) : [...list, ch.id]))}
                      >
                        <span className="mn-toc-chnum">{ci + 1}</span>
                        <span className="mn-toc-chname">{say(ch.title)}</span>
                        <span className="mn-toc-count">{ch.topics.length}</span>
                        <ChevronDown className="mn-toc-chev print-hide" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="mn-icon print-hide"
                        aria-label={tx(`Imprimir el capítulo ${ci + 1}`, `Print chapter ${ci + 1}`)}
                        title={tx("Imprimir este capítulo", "Print this chapter")}
                        onClick={() => print(ch.id)}
                      >
                        <Printer aria-hidden />
                      </button>
                    </div>
                    <ol className={cn("mn-toc-secs", !isOpen && "is-shut")} id={`mn-toc-${ch.id}`}>
                      <li className="print-hide">
                        <button type="button" onClick={() => jumpTo(`mn-ch-${ch.id}`)}>
                          <span className="mn-toc-num">
                            <ArrowRight aria-hidden className="mn-toc-go" />
                          </span>
                          <span className="mn-toc-name is-go">{tx("Ir al capítulo", "Go to the chapter")}</span>
                        </button>
                      </li>
                      {ch.topics.map((tp, ti) => (
                        <li key={tp.id}>
                          <button type="button" onClick={() => jump(tp.id)}>
                            <span className="mn-toc-num">
                              {ci + 1}.{ti + 1}
                            </span>
                            <span className="mn-toc-name">{say(tp.title)}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </li>
                );
              })}
              <li className="mn-toc-ch">
                <div className="mn-toc-chrow">
                  <button type="button" className="mn-toc-chbtn" onClick={() => jumpTo("mn-alfabetico")}>
                    <span className="mn-toc-chnum is-az">A–Z</span>
                    <span className="mn-toc-chname">{tx("Índice alfabético", "A–Z index")}</span>
                  </button>
                </div>
              </li>
            </ol>
          </nav>

          {MANUAL_CHAPTERS.map((ch, ci) => (
            <section key={ch.id} id={`mn-ch-${ch.id}`} className={cn("mn-ch", printing === ch.id && "is-print-target")}>
              <header className="mn-ch-head">
                <span className="mn-ch-num" aria-hidden>
                  {ci + 1}
                </span>
                <div className="mn-ch-text">
                  <p className="mn-ch-kicker">{tx(`Capítulo ${ci + 1}`, `Chapter ${ci + 1}`)}</p>
                  <h2 className="mn-ch-title">{say(ch.title)}</h2>
                  <p className="mn-ch-intro">{say(ch.intro)}</p>
                </div>
                <button
                  type="button"
                  className="mn-icon print-hide"
                  aria-label={tx(`Imprimir el capítulo ${ci + 1}`, `Print chapter ${ci + 1}`)}
                  title={tx("Imprimir este capítulo", "Print this chapter")}
                  onClick={() => print(ch.id)}
                >
                  <Printer aria-hidden />
                </button>
              </header>
              {ch.topics.map((tp, ti) => {
                const num = `${ci + 1}.${ti + 1}`;
                return (
                  <article key={tp.id} id={`mn-${tp.id}`} className={cn("mn-entry", urlTopic && findTopic(urlTopic)?.id === tp.id && "is-current")}>
                    <h3 className="mn-entry-title">
                      <span className="mn-num">{num}</span>
                      <span>{say(tp.title)}</span>
                    </h3>
                    <p className="mn-sum">{say(tp.sum)}</p>
                    <dl className="mn-parts">
                      <div>
                        <dt>{label.what}</dt>
                        <dd>
                          {richText(say(tp.what))}
                          {tp.whatAlt ? (
                            <>
                              {" "}
                              {richText(say(tp.whatAlt))}
                            </>
                          ) : null}
                        </dd>
                      </div>
                      {tp.how ? (
                        <div>
                          <dt>{label.how}</dt>
                          <dd>{richText(say(tp.how))}</dd>
                        </div>
                      ) : null}
                      {tp.tip ? (
                        <div className="mn-tip">
                          <dt>
                            <Lightbulb aria-hidden />
                            {label.tip}
                          </dt>
                          <dd>{richText(say(tp.tip))}</dd>
                        </div>
                      ) : null}
                    </dl>
                    {tp.go ? (
                      <div className="mn-go-row">
                        <button
                          type="button"
                          className="mn-go print-hide"
                          onClick={() => void openInApp(MANUAL_TOPICS.find((x) => x.id === tp.id)!)}
                        >
                          {tx("Ver en la app", "See it in the app")}
                          <ArrowRight aria-hidden />
                        </button>
                        <span className="mn-where">{say(tp.go.where)}</span>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ))}

          <section id="mn-alfabetico" className="mn-alpha">
            <h2 className="mn-toc-title">{tx("Índice alfabético", "A–Z index")}</h2>
            <p className="mn-alpha-note">{tx("Cada palabra lleva a su tema.", "Each word takes you to its topic.")}</p>
            <div className="mn-alpha-cols">
              {alpha.map((group) => (
                <Fragment key={group.letter}>
                  <div className="mn-alpha-group">
                    <p className="mn-alpha-letter">{group.letter}</p>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.term} className="mn-alpha-row">
                          {item.topics.length === 1 ? (
                            <button type="button" className="mn-alpha-line" onClick={() => jump(item.topics[0]!.id)}>
                              <span className="mn-alpha-term">{item.term}</span>
                              <span className="mn-alpha-dots" aria-hidden />
                              <span className="mn-alpha-num">{item.topics[0]!.num}</span>
                            </button>
                          ) : (
                            <div className="mn-alpha-line">
                              <span className="mn-alpha-term">{item.term}</span>
                              <span className="mn-alpha-dots" aria-hidden />
                              <span className="mn-alpha-nums">
                                {item.topics.map((tp) => (
                                  <button key={tp.id} type="button" className="mn-alpha-num" onClick={() => jump(tp.id)} aria-label={`${item.term}, ${tp.num}`}>
                                    {tp.num}
                                  </button>
                                ))}
                              </span>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Fragment>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
