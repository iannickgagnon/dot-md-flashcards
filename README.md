# Markdown flashcards

A small, static **single-page app** for studying flashcards stored as plain **Markdown** (`.md`). Each card is a level-2 heading (`##`) plus a free-form Markdown answer. Edit cards in the browser, track **GOT IT** / **MISSED IT**, and—with a supporting browser—**write changes back to the same file** on disk.

No accounts, no server runtime: build output is static files you can host on any HTTPS-capable host or run locally.

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) (current LTS is fine)
- **npm** (bundled with Node)

### Fork or clone

1. Fork this repository on your Git host (GitHub, etc.) if you want your own copy to change.
2. Clone your fork (or this repo) to your machine:

   ```bash
   git clone https://github.com/YOUR_USERNAME/markdown_flashcards.git
   cd markdown_flashcards
   # or whatever you named the folder
   ```

3. Install dependencies and start the dev server:

   ```bash
   npm install
   npm run dev
   ```

4. Open the URL Vite prints (usually `http://localhost:5173`).

### Production build

```bash
npm run build
npm run preview   # optional: serve dist/ locally to verify
```

The `dist/` folder contains HTML, JS, and CSS only—deploy it to static hosting (GitHub Pages, Netlify, S3, etc.).

## How to use the app

### Loading a deck

- **Open** — Pick a `.md` file. In Chromium with the File System Access API, the app keeps a **file handle** so later saves can go **in place**.
- **New** — Choose where to save a new empty `.md` file, then use **Add** to create cards (requires a browser that supports the save picker; see [Browsers and saving](#browsers-and-saving)).
- **Tutorial** — Loads the bundled tutorial deck from [`public/tutorial-deck.md`](public/tutorial-deck.md).
- **Drag and drop** — Drop a `.md` file onto the drop zone. Chromium may attach a handle so saves can sync to that file.

### Header actions (compact labels)

| Control   | Purpose |
|-----------|---------|
| Theme     | Toggle light / dark (stored in `localStorage`; respects system preference on first visit). |
| Open      | Open a Markdown file from disk. |
| New       | Create a new deck via save dialog. |
| Tutorial  | Load the built-in tutorial. |
| Edit      | Edit the **current** card (needs at least one card). |
| Add       | Add a card at the end (enabled when a deck is “in session”—e.g. file loaded or **New** completed). |
| Delete    | Remove the current card (with confirmation). |

### Studying

- **Flip** — Click the card, or focus it and press **Enter** or **Space**. **Links** and **buttons** do not flip the card. With **prefers-reduced-motion**, flip becomes a short crossfade.
- **Navigation** — Side chevrons or **Arrow** keys (←/→/↑/↓) between cards.
- **GOT IT** / **MISSED IT** — Score the current card; first mark usually advances (except on the last card). Press the same control again to **clear** the mark. Keys: **G** and **M** (disabled while typing or when the edit dialog is open).
- **RESTART** — Appears when every card is marked; resets scores and marks. **R** when the button is visible.
- **Sidebar** — Lists all cards with status icons; click a row to jump. **Hide** / **Show** collapses the list (on small screens the layout stacks).

### Editing and saving

- Open the editor with **Edit**, **Add**, **right-click** the card surface (not a link), or **E** while the card is focused.
- **Save** in the dialog writes the **entire deck** Markdown (serialized from the in-memory model). If the app has a **writable file handle**, it saves **in place**. Otherwise it may prompt for a location (behavior depends on browser and how the deck was opened).

## Deck file format

- Each card starts with a line `## Your question` (level-2 heading only; `#` / `###` do **not** start cards).
- Everything until the next `##` or end of file is the **answer** (GitHub-flavored Markdown: code fences, lists, links, etc.).
- Optional **preamble** before the first `##` is kept in the file but not shown as a card.

Authoring rules, examples, and LLM-oriented prompts are in **`DECK_FORMAT.md`** and inside the in-app **Tutorial** deck.

## Browsers and saving

- **Reading** decks works broadly (open file picker or drag-and-drop text).
- **Writing** the same file back reliably needs a [**secure context**](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts): **`https://`** or **`http://localhost`** (or `127.0.0.1`).
- **Save-in-place** and **New** work best in **Chromium-based** browsers (Chrome, Edge, …) with the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API). Other browsers may still run the app but fall back to download-style flows or in-tab-only edits.

## Keyboard shortcuts (reference)

| Key | Action |
|-----|--------|
| Enter / Space | Flip card (when focused, not in a link). |
| E | Edit current card. |
| G | GOT IT |
| M | MISSED IT |
| R | Restart session (when **RESTART** is shown). |
| Arrow keys | Previous / next card. |

## Project layout

| Path | Role |
|------|------|
| [`src/main.ts`](src/main.ts) | App bootstrap, deck I/O wiring, shortcuts, drag-and-drop. |
| [`src/study/renderStudyUi.ts`](src/study/renderStudyUi.ts) | Main UI rendering and flashcard chrome. |
| [`src/app/context.ts`](src/app/context.ts) | Shared application state and DOM refs. |
| [`src/fs/markdownFileWriter.ts`](src/fs/markdownFileWriter.ts) | File System Access write helpers. |
| [`src/parseFlashcards.ts`](src/parseFlashcards.ts) | Parse / serialize `.md` decks. |
| [`src/renderMarkdown.ts`](src/renderMarkdown.ts) | Sanitized Markdown → HTML (Marked, DOMPurify, highlight.js). |
| [`public/tutorial-deck.md`](public/tutorial-deck.md) | Bundled tutorial and authoring hints. |
| [`DECK_FORMAT.md`](DECK_FORMAT.md) | Detailed format and study UX notes. |

## Tech stack

- [Vite](https://vitejs.dev/) — dev server and production bundling  
- [TypeScript](https://www.typescriptlang.org/)  
- [marked](https://marked.js.org/) + [DOMPurify](https://github.com/cure53/DOMPurify) + [highlight.js](https://highlightjs.org/) — Markdown and code blocks  
- [@fontsource/geist](https://fontsource.org/) — fonts  

## Contributing

Issues and pull requests are welcome. After changes, run:

```bash
npm run build
```

to confirm TypeScript and the production build succeed.

## License

This repository does not include a default **LICENSE** file. Add one in your fork if you need explicit terms for reuse.
