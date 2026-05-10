# Tutorial deck

This introduction sits **before** the first `##` heading. It is stored in the file but does not appear as a flashcard—only the headings and their bodies do. Use it for notes to yourself; this deck explains the app from basics to more advanced features.

## What is a flashcard in this app?

Each flashcard is one line that starts with `##` (a level-2 heading). That line is the **question**. Everything below it until the next `##` (or the end of the file) is the **answer**, written in normal Markdown.

## How do I write code?

Use **single backticks** around short inline code, like `print("hi")` or `const x = 1`.

For multiple lines, use a **fenced code block**: a line with three backticks, your code, then a line with three backticks again:

```
def greet():
    return "Hello"
```

You can add a **language name** after the opening backticks so highlighting matches (GitHub-flavored Markdown):

```python
def greet():
    return "Hello"
```

## How do I emphasize text?

In the **answer**, use `**double asterisks**` for bold and `*single asterisks*` for italic. The **question** line (after `##`) only supports **inline** Markdown—bold, italic, `code`, and links—not whole paragraphs or big blocks.

## How do I make lists?

Bullet list:

- First item
- Second item

Numbered list:

1. Step one
2. Step two

## How do I add a link?

Use `[link text](https://example.com)` in the answer. Example: read [Markdown basics](https://commonmark.org/help/).

## How do I reveal the answer?

Click the card, or focus it and press **Enter** or **Space**, to **flip** it in 3D. Click again to see the question. If your system prefers reduced motion, the flip becomes a quick crossfade instead.

## What do GOT IT and MISSED IT do?

Use **GOT IT** or **MISSED IT** after you’ve checked yourself. The first time you choose on a card, you usually move to the next one (except on the **last** card). You can go **back** with the arrows and **change** your mark; counts update. After the last card is marked, **RESTART** appears to study the same deck again.

## What is the Missed panel?

When you have at least one **MISSED** card, a list appears on the side (below on small screens). Click a row to jump to that card. Use **Hide** / **Show** to collapse the list.

## How do I edit a card?

**Right-click** the card (not on a link), use **Edit card** in the header, or press **E** while the card is focused. Edit the question line and the Markdown answer, then **Save**. Saving back to a real file works best in Chrome or Edge when you opened the deck with the file picker or dropped a file that gives the app a file handle.

## How do I open my own deck?

Use **Open markdown file** or **drag and drop** a `.md` file onto the page. For editing and saving in place, prefer opening with the native file dialog in a **secure** context (`https` or `http://localhost`).

## How do I change the theme?

Use the **Light** / **Dark** button in the header. Your choice is remembered for the next visit.
