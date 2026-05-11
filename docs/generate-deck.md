# Deck file format

Follow these rules exactly. Output **must** be **only** the deck file: one Markdown document. Do not wrap it in commentary, labels, or an outer code fence unless the user explicitly asked for that wrapper. The deck **may** start with an optional **deck preamble** (see below); that preamble is part of the file, not meta-instructions to you.

## Document shape

1. **Optional preamble** — Any text from the start of the file **up to but not including** the first **card delimiter line** (defined below). If there is no card delimiter line, the entire file is preamble and produces **zero** cards.
2. **Cards** — Zero or more cards in **file order**. Each card has one **question line** and one **answer body**.

## Card delimiter / question line

- A **card delimiter line** is a line that matches this pattern (regular expression, multiline): start of line, two `#` characters (U+0023), then **one or more** of any character through end of line: `^## (.+)$`
- The line must start at **column 1** (no leading spaces or tabs before the first `#`).
- The **question** is the substring captured by `(.+)`, **trimmed** of leading/trailing whitespace. If that trimmed string is **empty**, the card is **omitted** (skipped).
- **Accidental delimiters:** Because the pattern only requires the first two characters to be `##`, a line intended as an ATX heading with **three** hashes (e.g. `### Section`) still begins with `##`; the parser will treat it as a card question whose title starts with `#`. **Do not** place `###` (or more) at column 1 unless that line is meant to be a new card whose title begins with `#`. Use normal Markdown inside **answer bodies** without starting answer lines at column 1 with `##` unless starting a **new card**.

## Answer body

- The **answer** is all text **after** the card delimiter line up to (but not including) the **next** card delimiter line, or up to **end of file**.
- Leading and trailing whitespace of the answer block is **trimmed** when stored.
- **Markdown:** The answer body is interpreted as **GitHub-flavored Markdown**. Use standard constructs (paragraphs, lists, fenced code with optional language tag, links, emphasis, etc.) as needed.

## Serialization reference

When emitting or normalizing a deck, the following shape is consistent with the app's serializer: optional preamble, then for each card a block `## {title}\n\n{body}`. Blank lines between cards are conventional; newlines **inside** a body are preserved after trim.

## Output check

Before finishing, confirm:

- No text appears **outside** the deck Markdown itself.
- Every intended card has exactly one delimiter line `## …` at column 1 with a **non-empty** title after trim.
- No unintended `##` at column 1 appears inside an answer (unless it starts a new card).
