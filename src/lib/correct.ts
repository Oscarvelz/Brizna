/**
 * 1.5.70 — «Corregir» with real teeth (Oscar: the corner button «no hace gran cosa, ni siquiera sé
 * qué hace»). The free public LanguageTool service (api.languagetool.org, no key) checks spelling,
 * accents, capitalization and punctuation in Spanish and English. Only HIGH-PRECISION fixes are
 * applied on their own: capitalization/casing, punctuation and whitespace rules, and spelling when
 * the service offers exactly ONE candidate (an accent, a clear typo). Anything debatable is left
 * untouched — the button reports how many fixes it made, or that the text already looks good.
 * Offline or service down → null, and the composer falls back to its local polish as before.
 * Only the box's text is sent, when Oscar taps the button himself.
 */
type LtMatch = {
  offset: number;
  length: number;
  replacements?: { value: string }[];
  rule?: { id?: string; category?: { id?: string } };
};

const ES_WORDS = ["el", "la", "los", "las", "de", "que", "en", "un", "una", "mañana", "hoy", "voy", "llegar", "cortar", "gracias", "por", "para", "con", "su", "casa", "estoy", "estará", "puedo", "quiero"];
const EN_WORDS = ["the", "you", "your", "will", "tomorrow", "today", "arrive", "cut", "lawn", "please", "thanks", "thank", "morning", "and", "but", "if", "want", "would", "could", "there", "here", "i'll", "won't"];

/** Which language the box's text is in — accents and ñ settle it; otherwise word evidence. */
export function guessTextLang(text: string): "es" | "en" {
  if (/[áéíóúñ¿¡]/i.test(text)) return "es";
  const words = text.toLowerCase().split(/[^a-záéíóúñ']+/).filter(Boolean);
  const es = words.filter((w) => ES_WORDS.includes(w)).length;
  const en = words.filter((w) => EN_WORDS.includes(w)).length;
  return en > es ? "en" : "es";
}

function safeFix(m: LtMatch): boolean {
  const value = m.replacements?.[0]?.value;
  if (value === undefined) return false;
  const id = m.rule?.id ?? "";
  const cat = m.rule?.category?.id ?? "";
  // spelling: only when the service is sure — exactly one candidate (an accent, a clear typo)
  if (cat === "TYPOS" || /MORFOLOGIK|SPELLER/.test(id)) return (m.replacements?.length ?? 0) === 1;
  // capitalization, punctuation and whitespace: the top suggestion is deterministic
  if (cat === "CASING" || cat === "PUNCTUATION") return true;
  if (/UPPERCASE_SENTENCE_START|WHITESPACE|DOUBLE_PUNCTUATION|UNPAIRED|FINAL_PUNCTUATION/.test(id)) return true;
  return false;
}

export async function correctOnline(text: string, lang: "es" | "en"): Promise<{ text: string; fixes: number } | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  try {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), 15_000);
    const res = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      signal: ctl.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text, language: lang === "es" ? "es" : "en-US" }).toString(),
    });
    window.clearTimeout(t);
    if (!res.ok) return null;
    const body = (await res.json()) as { matches?: LtMatch[] };
    const matches = (body.matches ?? []).filter(safeFix).sort((a, b) => b.offset - a.offset);
    let out = text;
    let fixes = 0;
    for (const m of matches) {
      const value = m.replacements?.[0]?.value;
      if (value === undefined) continue;
      const before = out.slice(m.offset, m.offset + m.length);
      if (before === value) continue;
      out = out.slice(0, m.offset) + value + out.slice(m.offset + m.length);
      fixes += 1;
    }
    return { text: out, fixes };
  } catch {
    return null;
  }
}
