# Flashcard deck format

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

- **Reveal the answer** — The card shows the question first. Click the card (or focus it and press Enter or Space) to flip and reveal the Markdown answer. Click again to return to the question. Links in the answer behave normally and do not flip the card.
- **One score per card** — **GOT IT** and **MISSED IT** each count at most once per card for the current session. After you choose one, the app advances to the next card. If you go back to a card you already marked, those buttons stay disabled so the tally does not change again.
- **Navigation** — Use the **←** / **→** controls (or the Left / Right arrow keys) to move between cards. The deck **wraps**: after the last card, **next** goes to the first; before the first, **previous** goes to the last.
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

Then open the URL printed in the terminal (usually `http://localhost:5173`). Use **Open markdown file** or **Load sample deck**, or drop a `.md` file onto the dashed area.

## Build for production

```bash
npm run build
npm run preview
```

The `dist/` output is static files you can host anywhere.
