export type Flashcard = {
  title: string;
  bodyMd: string;
};

export type ParsedDeck = {
  /** Text before the first `##` heading, if any (optional deck intro). */
  deckPreamble: string | null;
  cards: Flashcard[];
};

const HEADING_RE = /^## (.+)$/gm;

/**
 * Each `## Heading` starts a card; the heading text is the question title.
 * Everything until the next `##` (or EOF) is the answer body (Markdown).
 */
export function parseFlashcards(markdown: string): ParsedDeck {
  const trimmed = markdown.replace(/^\uFEFF/, "");

  const matches = [...trimmed.matchAll(HEADING_RE)];
  if (matches.length === 0) {
    const p = trimmed.trim();
    return { deckPreamble: p || null, cards: [] };
  }

  const firstMatchIndex = matches[0].index ?? 0;
  const preambleRaw = firstMatchIndex > 0 ? trimmed.slice(0, firstMatchIndex).trim() : "";
  const deckPreamble = preambleRaw || null;

  const cards: Flashcard[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const title = m[1].trim();
    const blockStart = (m.index ?? 0) + m[0].length;
    const blockEnd =
      i + 1 < matches.length
        ? (matches[i + 1].index ?? trimmed.length)
        : trimmed.length;
    const bodyMd = trimmed.slice(blockStart, blockEnd).trim();
    if (!title) continue;
    cards.push({ title, bodyMd });
  }

  return { deckPreamble, cards };
}

/** Rebuild deck markdown (optional preamble + `##` cards). */
export function serializeDeck(deckPreamble: string | null, cards: Flashcard[]): string {
  const chunks: string[] = [];
  const pre = deckPreamble?.trim();
  if (pre) chunks.push(pre.replace(/\n+$/, ""));
  for (const c of cards) {
    chunks.push(`## ${c.title}\n\n${c.bodyMd.trim()}`);
  }
  return chunks.join("\n\n").replace(/\n+$/, "") + "\n";
}
