# Flashcard deck format

A **bundled tutorial and LLM-oriented authoring spec** ships with the app as [`public/tutorial-deck.md`](public/tutorial-deck.md), including copy-paste rules and a suggested prompt for generating new decks from a knowledge base.

This app loads **Markdown** files. Each flashcard is one level-2 heading (`##`) followed by its answer body (any Markdown) until the next `##` or end of file.

## Rules

1. **Question** — The line `## Your question text` sets the card title (shown as the question).
2. **Answer** — Everything after that heading until the next `##` is the answer. Use normal Markdown: paragraphs, lists, **bold**, `inline code`, links, etc.
3. **Optional preamble** — Any text *before* the first `##` is not shown as a card; it’s only in the source file for your own notes.

## Markdown in questions and answers

- **Answer (full GFM)** — Everything under a card heading is rendered as **GitHub-flavored Markdown**: paragraphs, lists, **bold**, `inline code`, fenced code blocks, links, etc. Use triple backticks for multi-line code, for example:

  ````markdown
  ```python
  def foo():
      return "bar"
  ```
  ````

  Inline snippets use single backticks: `` `def foo()` ``.

- **Question line (inline only)** — The text after `##` is rendered with **inline** Markdown only: `` `code` ``, **bold**, *italic*, [links](https://example.com). Block features (headings, lists, fences) belong in the answer body, not on the `##` line.

- Output is **sanitized** for safety when turning Markdown into HTML.

## Studying in the app

- **Reveal the answer** — The card shows the question first. Click the card (or focus it and press Enter or Space) to **flip** it in 3D and reveal the Markdown answer; click again to flip back. With reduced motion, the flip becomes a quick crossfade. Links in the answer behave normally and do not toggle the reveal.
- **Edit cards** — Right-click the flashcard surface (not on a link or button) to open the editor, or use **Edit card** in the header, or focus the card and press **E**. Enter the question as plain heading text (do not type `##`); the answer field is Markdown. **Save** updates the card and writes the **whole deck** to the linked Markdown file **in place** when the app holds a file handle from **Open markdown file** (Chromium file picker) or from **drag-and-drop** of a local `.md` file in Chromium—no extra save dialog. If write permission fails, you get a save dialog seeded to **that file’s folder** when the browser supports it. If you opened the deck via the legacy file chooser (no handle), **tutorial deck**, or a drag without a path, **Save** may ask where to save; **Open markdown file** starts in the **current deck’s folder** when a file handle is already linked. Requires a **secure context** (HTTPS or localhost) for file writes in supporting browsers.
- **Scoring** — **GOT IT** and **MISSED IT** apply to the current card. Your first choice on a card moves you forward to the next card (except on the **last** card—see below). You can use **←** / **→** to go back and **change** a card from GOT to MISSED or the reverse; the tallies update accordingly.
- **End of deck** — Navigation is **linear**: there is no wrap from last to first. After you mark the **last** card, **RESTART** appears. It resets scores, clears marks, and starts again from card 1. Loading a new file also starts a fresh session.
- **Missed list** — When you have at least one **MISSED** card, a panel on the **right** (below the main area on narrow screens) lists those cards. Click a row to jump to that card. Use **Hide** / **Show** to collapse the list.
- **Navigation** — Use **←** / **→** or the Left / Right arrow keys. **Previous** is disabled on the first card; **next** is disabled on the last.
- **Appearance** — Use the **Light** / **Dark** control in the header to switch themes. The UI follows the light/dark palettes described in `DESIGN_LIGHT.md` and `DESIGN_DARK.md`. Your choice is saved in the browser (`localStorage`) and reused on the next visit; if you have not chosen before, the app follows your system light/dark preference.

## Example

```markdown
## What is a closure?

A **closure** is a function that retains access to its outer scope.

## Capital of France?

Paris.
```

## Run the app

```bash
npm install
npm run dev
```

Then open the URL printed in the terminal (usually `http://localhost:5173`). Use **New** (save an empty deck), **Open markdown file** or **Load tutorial deck**, or drop a `.md` file onto the dashed area.

## Build for production

```bash
npm run build
npm run preview
```

The `dist/` output is static files you can host anywhere.
