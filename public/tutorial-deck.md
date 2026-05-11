# Tutorial and authoring spec for `.md` flashcards

This top section is **preamble**: everything **before** the first real card line (`## Your question…` at **column 1**) is stored in the file but **never shown as a flashcard**. Use it for **deck titles**, **notes**, HTML comments (`<!-- … -->`), or **instructions for an LLM** that will generate more cards from a knowledge base. Only **`##` headings** and their **answer bodies** become flashcards.

### Deck file format (for authors and LLMs)

- **Delimiter** — Only **level-2 headings** start a card: one line matching `## Your question here` (**two hashes, one space**, then the question). **`#` (H1)** and **`###` (H3+)** do **not** start cards.
- **Question** — The text after `## ` is **trimmed** and becomes the question. **Empty** titles (`##` with nothing after) are **skipped**. **Inline** Markdown is OK: **bold**, *italic*, `code`, links—**not** lists or fenced code on the **question line**.
- **Answer** — Everything until the **next** `## …` line or **end of file** is the answer. Use **GitHub-flavored Markdown (GFM)**: paragraphs, lists, **fenced code** (` ``` ` or ` ```lang `), links, emphasis.
- **Order** — Cards appear in **file order** (top to bottom).
- **Between cards** — A **blank line** between answers and the next `##` is typical; extra newlines **inside** an answer are kept.

**Anti-patterns**

- **Do not** use `#` or `###` as card delimiters—**only** `## ` counts.
- Each **`## `** starts a **new card**; put shared intro text in the **preamble** or repeat briefly per card if needed.

### Minimal example (copy this shape)

In a **real deck**, each question line starts with `## ` at **column 1** (no leading spaces). The sketch below is **indented with four spaces** so **this** tutorial file does not parse extra cards from the example.

```
    ## First question?

    Answer as **Markdown** here.

    ## Second question?

    Another answer.
```

**Important:** When you write your own file, **remove those four leading spaces** so the lines begin with `## `.

### Suggested prompt to use with an LLM

Use the block below as a **system** or **user** message. Replace the **`KNOWLEDGE_BASE`** section with your source material.

```text
You are generating a flashcard deck as a single Markdown file for the ".md flashcards" web app.

Rules (strict):
- Optional preamble: any content BEFORE the first line that starts with "## " (two hashes and a space). Use it for a short deck title or source summary.
- Each card: one line "## <question>" then the answer in Markdown until the next "## " line or end of file.
- Only "## " starts a card, not "#" or "###".
- Do not leave empty "## " titles.
- Questions: concise; prefer one main idea per card. Answers: clear Markdown; use fenced code with a language id when helpful.
- Output ONLY the Markdown file content—no surrounding explanation.

KNOWLEDGE_BASE:
<paste your notes, article, transcript, or outline here>
```

### Markdown cheat sheet (answers)

- **Inline code**: `` `like this` ``
- **Fenced code**: line ` ``` ` or ` ```python `, then your code, then closing ` ``` `
- **Bold / italic**: `**bold**`, `*italic*`
- **Lists**: `-` or `1.` at line start (see example cards below)
- **Links**: `[text](https://example.com)`

The app **sanitizes** HTML for safety—stick to normal Markdown.

### Using this app (summary)

- **Reveal** — Click the card, or focus it and press **Enter** or **Space** (**links** and **buttons** don’t flip the card). **Reduced motion** → quick crossfade instead of 3D flip.
- **FLASHCARDS sidebar** — Lists **every** question; the **current** card is highlighted. **Hide** / **Show** collapses the list; on **narrow screens** it stacks **below** the card.
- **GOT IT** / **MISSED IT** — First mark usually **advances** (not from the **last** card). Pressing the **same** control again **clears** the mark. Keys: **G** = GOT, **M** = MISSED (disabled while **typing in fields** or if the **edit dialog** is open).
- **RESTART** — Shown only when **every** card has been marked. Key **R** when visible. **Ctrl/Cmd+R** (refresh) stays a **browser** shortcut.
- **Navigation** — Chevrons, or **Arrow** Left/Right/Up/Down.
- **New** — Save an empty linked `.md` deck, then use **Add** to build cards (needs **HTTPS** or **localhost** and a browser that supports **Save** from the app).
- **Edit** — **Right-click** the card (not a link), **Edit card** in the header, or **E** with focus on the card.
- **Add / delete** — **Add card** opens the same dialog (empty) and appends on save; **Delete card** removes the current card after confirmation.
- **Open / save** — **Open markdown file** or **drag** a **`.md`** file. Best **save-in-place** in **Chromium** with the **file picker** or a drag that yields a **file handle**; use **https** or **localhost**.
- **Theme** — **Light** / **Dark**; stored in the **browser** for next visit.

For developers, see **`DECK_FORMAT.md`** in the app repository.

## How do I reveal the answer?

**You probably know at this point :)** — you’ve basically **already been doing this**; clicking through this deck *is* the trick. **Click** the card, or focus it and press **Enter** or **Space**, to **flip** to the answer; **click** again to return to the question. (**Links** and **buttons** won’t trigger a flip.) With **reduced motion**, the app uses a quick **crossfade** instead of the 3D animation.

## What is a flashcard in this app?

Each flashcard is **one line** that starts with **`## `** (level-2 heading **and a space**). That line is the **question**. Everything below it until the next **`## `** (or **end of file**) is the **answer**, as **Markdown**.

## How do I write code?

Use **single backticks** around short **inline code**, e.g. `print("hi")` or `const x = 1`.

For **multiple lines**, use a **fenced code block**: a line with **three backticks**, your code, then a closing line with **three backticks**:

```
def greet():
    return "Hello"
```

Add a **language id** after the opening backticks (e.g. **`python`**) for **syntax highlighting**:

```python
def greet():
    return "Hello"
```

## How do I emphasize text?

In the **answer**, `**double asterisks**` → **bold**; `*single asterisks*` → *italic*. The **question** line (after `##`) allows **inline** Markdown only—**not** block quotes, lists, or **fenced code** on that same line.

## How do I make lists?

**Bullet** list (hyphen at line start):

- First item
- Second item

**Numbered** list:

1. Step one
2. Step two

## How do I add a link?

In the **answer**, use `[link text](https://example.com)`. Example: [Markdown basics](https://commonmark.org/help/).

## What do GOT IT, MISSED IT, and RESTART do?

**GOT IT** and **MISSED IT** record your result on the **current** card. The **first** mark usually **moves you forward** (except from the **last** card). Pressing the **same** control or **G** / **M** again **removes** the mark. You can switch **GOT** ↔ **MISSED** from any card. **RESTART** appears only after **all** cards are marked; it **resets** tallies and returns to **card 1**. Key **R** triggers **RESTART** when it’s shown.

## What is the FLASHCARDS sidebar for?

It lists **all** questions **in order**. The **active** card is **highlighted**; a small icon can show **GOT** or **MISSED** after you mark. **Click** a row to **jump** there. **Hide** collapses the panel.

## How do I edit a card?

**Right-click** the card surface (**not** on a link), use **Edit card** in the header, or press **E** with the card focused. Change the **question** and **Markdown** answer, then **Save**. **Save-in-place** works best in **Chrome** or **Edge** when the deck came from the **file picker** or **drag-and-drop** with a **file handle**.

## How do I open my own deck?

Use **Open markdown file** or **drag and drop** a **`.md`** file onto the page. Use a **secure** context (**`https`** or **`http://localhost`**) if the browser should **write** the file back.

## How do I change the theme?

Use **Light** / **Dark** in the header. Your choice is **remembered** for the next visit.
