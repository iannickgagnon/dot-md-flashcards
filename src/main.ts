import "@fontsource/geist/latin-300.css";
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist-mono/latin-400.css";
import hljsGithubDarkUrl from "highlight.js/styles/github-dark.css?url";
import hljsGithubUrl from "highlight.js/styles/github.css?url";
import "./styles.css";
import { editCardDialog, el, registerDomRefs, state, type DomRefs, type Outcome } from "./app/context";
import { EMPTY_HINT_NO_DECK } from "./app/deckCopy";
import {
  MARKDOWN_PICKER_TYPES,
  WindowWithFileSystemAccess,
  writeTextToFileHandle,
} from "./fs/markdownFileWriter";
import { parseFlashcards, serializeDeck } from "./parseFlashcards";
import {
  applyFlashcardViewportHeightFromSession,
  clampFlashcardViewportHeightForWindow,
  getFlashcardViewportHeightPx,
  render,
  setFlashcardViewportHeightPx,
} from "./study/renderStudyUi";

// --- Theme & syntax highlighting -------------------------------------------------

const THEME_KEY = "markdown-flashcards-theme";
const HLJS_THEME_LINK_ID = "hljs-syntax-theme";

function syncHljsThemeLink(): void {
  let link = document.getElementById(HLJS_THEME_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = HLJS_THEME_LINK_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  const documentTheme = document.documentElement.dataset.theme;
  link.href = documentTheme === "light" ? hljsGithubUrl : hljsGithubDarkUrl;
}

syncHljsThemeLink();

function getTheme(): "light" | "dark" {
  const documentTheme = document.documentElement.dataset.theme;
  return documentTheme === "light" ? "light" : "dark";
}

function syncThemeButton(): void {
  const theme = getTheme();
  el.btnTheme.textContent = theme === "dark" ? "Light" : "Dark";
  el.btnTheme.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
  );
}

function setTheme(nextTheme: "light" | "dark"): void {
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
  syncHljsThemeLink();
  syncThemeButton();
}

// --- App shell (static HTML injected once) --------------------------------------

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("#app missing");

appRoot.innerHTML = `
  <header class="app-header">
    <h1 class="app-title">.md flashcards</h1>
    <div class="header-tools">
      <button type="button" class="btn-theme" id="btn-theme">Light</button>
      <button type="button" class="btn-secondary" id="btn-open" aria-controls="file-input" aria-label="Open markdown file">
        Open
      </button>
      <input class="hidden-input" id="file-input" type="file" accept=".md,.markdown,text/markdown,text/x-markdown" />
      <button type="button" class="btn-secondary" id="btn-new" aria-label="Create new deck and save as markdown file">
        New
      </button>
      <button type="button" class="btn-secondary" id="btn-tutorial" aria-label="Load tutorial deck">
        Tutorial
      </button>
      <button
        type="button"
        class="btn-secondary"
        id="btn-edit-card"
        disabled
        aria-controls="edit-card-dialog"
        aria-label="Edit current flashcard"
      >
        Edit
      </button>
      <button
        type="button"
        class="btn-secondary"
        id="btn-add-card"
        disabled
        aria-controls="edit-card-dialog"
        aria-label="Add flashcard at end of deck"
      >
        Add
      </button>
      <button
        type="button"
        class="btn-secondary"
        id="btn-delete-card"
        disabled
        aria-label="Delete current flashcard"
      >
        Delete
      </button>
      <span class="mono-label" id="session-readout" aria-live="polite">Card 0 / 0</span>
      <span class="tally mono-label" id="tally" aria-live="polite">
        <span class="tally__part">GOT <strong id="tally-got">0</strong></span>
        <span class="tally__part">MISSED <strong id="tally-missed">0</strong></span>
      </span>
    </div>
    <p class="file-meta" id="file-meta"></p>
  </header>
  <main class="app-layout">
    <div class="app-layout__main">
      <div class="drop-zone" id="drop-zone" tabindex="-1">
        <p class="empty-hint" id="empty-hint">${EMPTY_HINT_NO_DECK}</p>
        <div class="flashcard-wrap" id="flashcard-wrap" hidden>
          <article class="flashcard" aria-label="Flashcard deck">
            <button type="button" class="nav-strip nav-strip--prev" id="btn-prev" aria-label="Previous flashcard">‹</button>
            <div
              class="flashcard-flip"
              id="flashcard-flip"
              tabindex="0"
              role="button"
              aria-pressed="false"
              aria-label="Showing question. Click or press Enter to reveal the answer."
            >
              <div class="flashcard-flip__viewport" id="flashcard-viewport">
                <div class="flashcard-flip__panel" id="flip-panel">
                  <div class="flashcard-face flashcard-face--front">
                    <h2 id="question-title"></h2>
                    <p class="flashcard-hint">Click to reveal answer</p>
                  </div>
                  <div class="flashcard-face flashcard-face--back">
                    <div class="answer prose" id="answer"></div>
                  </div>
                </div>
                <div
                  class="flashcard-resize-handle"
                  aria-label="Resize flashcard height"
                  role="presentation"
                ></div>
              </div>
            </div>
            <button type="button" class="nav-strip nav-strip--next" id="btn-next" aria-label="Next flashcard">›</button>
          </article>
        </div>
        <div class="actions">
          <button type="button" class="btn-outline" id="btn-got" disabled hidden>
            <span class="btn-outline__key">G</span>OT IT
          </button>
          <button type="button" class="btn-outline" id="btn-missed" disabled hidden>
            <span class="btn-outline__key">M</span>ISSED IT
          </button>
          <button type="button" class="btn-outline" id="btn-restart" hidden>
            <span class="btn-outline__key">R</span>ESTART
          </button>
        </div>
      </div>
    </div>
    <aside class="missed-panel" id="missed-panel" hidden>
      <div class="missed-panel__head">
        <span class="missed-panel__title" id="missed-panel-title">Flashcards</span>
        <button
          type="button"
          class="missed-panel__toggle"
          id="btn-missed-panel-toggle"
          aria-expanded="true"
          aria-controls="missed-list"
        >
          Hide
        </button>
      </div>
      <ul class="missed-panel__list" id="missed-list"></ul>
    </aside>
  </main>
  <dialog class="edit-card-dialog" id="edit-card-dialog" aria-labelledby="edit-card-dialog-title">
    <form class="edit-card-dialog__form" id="edit-card-form">
      <div class="edit-card-dialog__header">
        <h2 class="edit-card-dialog__title" id="edit-card-dialog-title">Edit card</h2>
      </div>
      <div class="edit-card-dialog__body">
        <label class="edit-card-dialog__label">
          <span class="edit-card-dialog__label-text">Question (heading text, no ##)</span>
          <input
            class="edit-card-dialog__input"
            type="text"
            id="edit-card-title"
            name="title"
            autocomplete="off"
            required
          />
        </label>
        <label class="edit-card-dialog__label">
          <span class="edit-card-dialog__label-text">Answer (Markdown)</span>
          <textarea class="edit-card-dialog__textarea" id="edit-card-body" name="body" rows="10"></textarea>
        </label>
      </div>
      <div class="edit-card-dialog__actions">
        <button type="button" class="btn-outline" id="edit-card-cancel" value="cancel">Cancel</button>
        <button type="submit" class="btn-primary" id="edit-card-save" value="save">Save</button>
      </div>
    </form>
  </dialog>
`;

registerDomRefs({
  fileInput: appRoot.querySelector<HTMLInputElement>("#file-input")!,
  btnOpen: appRoot.querySelector<HTMLButtonElement>("#btn-open")!,
  btnNew: appRoot.querySelector<HTMLButtonElement>("#btn-new")!,
  btnTutorial: appRoot.querySelector<HTMLButtonElement>("#btn-tutorial")!,
  btnTheme: appRoot.querySelector<HTMLButtonElement>("#btn-theme")!,
  sessionReadout: appRoot.querySelector<HTMLSpanElement>("#session-readout")!,
  tallyGot: appRoot.querySelector<HTMLSpanElement>("#tally-got")!,
  tallyMissed: appRoot.querySelector<HTMLSpanElement>("#tally-missed")!,
  fileMeta: appRoot.querySelector<HTMLParagraphElement>("#file-meta")!,
  emptyHint: appRoot.querySelector<HTMLParagraphElement>("#empty-hint")!,
  flashcardWrap: appRoot.querySelector<HTMLDivElement>("#flashcard-wrap")!,
  flipCard: appRoot.querySelector<HTMLDivElement>("#flashcard-flip")!,
  flashcardViewport: appRoot.querySelector<HTMLDivElement>("#flashcard-viewport")!,
  flipPanel: appRoot.querySelector<HTMLDivElement>("#flip-panel")!,
  flashcardResizeHandle: appRoot.querySelector<HTMLDivElement>(".flashcard-resize-handle")!,
  questionTitle: appRoot.querySelector<HTMLHeadingElement>("#question-title")!,
  answer: appRoot.querySelector<HTMLDivElement>("#answer")!,
  btnPrev: appRoot.querySelector<HTMLButtonElement>("#btn-prev")!,
  btnNext: appRoot.querySelector<HTMLButtonElement>("#btn-next")!,
  btnGot: appRoot.querySelector<HTMLButtonElement>("#btn-got")!,
  btnMissed: appRoot.querySelector<HTMLButtonElement>("#btn-missed")!,
  btnRestart: appRoot.querySelector<HTMLButtonElement>("#btn-restart")!,
  dropZone: appRoot.querySelector<HTMLDivElement>("#drop-zone")!,
  missedPanel: appRoot.querySelector<HTMLElement>("#missed-panel")!,
  missedList: appRoot.querySelector<HTMLUListElement>("#missed-list")!,
  btnMissedPanelToggle: appRoot.querySelector<HTMLButtonElement>("#btn-missed-panel-toggle")!,
  missedPanelTitle: appRoot.querySelector<HTMLSpanElement>("#missed-panel-title")!,
  editDialog: appRoot.querySelector<HTMLDialogElement>("#edit-card-dialog")!,
  editForm: appRoot.querySelector<HTMLFormElement>("#edit-card-form")!,
  editTitle: appRoot.querySelector<HTMLInputElement>("#edit-card-title")!,
  editBody: appRoot.querySelector<HTMLTextAreaElement>("#edit-card-body")!,
  btnEditCard: appRoot.querySelector<HTMLButtonElement>("#btn-edit-card")!,
  btnAddCard: appRoot.querySelector<HTMLButtonElement>("#btn-add-card")!,
  btnDeleteCard: appRoot.querySelector<HTMLButtonElement>("#btn-delete-card")!,
  editDialogTitle: appRoot.querySelector<HTMLHeadingElement>("#edit-card-dialog-title")!,
  btnEditSave: appRoot.querySelector<HTMLButtonElement>("#edit-card-save")!,
  btnEditCancel: appRoot.querySelector<HTMLButtonElement>("#edit-card-cancel")!,
} satisfies DomRefs);

el.btnTheme.addEventListener("click", () => {
  setTheme(getTheme() === "dark" ? "light" : "dark");
});

// --- Study interactions: flip, resize, context menu -------------------------------

function toggleFlip(): void {
  const cardCount = state.cards.length;
  if (cardCount === 0) return;
  state.isFlipped = !state.isFlipped;
  render();
}

function flashcardFlipClick(event: MouseEvent): void {
  const target = event.target as Element;
  if (target.closest(".flashcard-resize-handle") || target.closest("a") || target.closest("button")) return;
  toggleFlip();
}

function flashcardFlipKeydown(event: KeyboardEvent): void {
  if ((event.key === "e" || event.key === "E") && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (state.cards.length === 0) return;
    event.preventDefault();
    openEditCardDialog();
    return;
  }
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target as Element;
  if (target.closest("a")) return;
  event.preventDefault();
  toggleFlip();
}

el.flipCard.addEventListener("click", flashcardFlipClick);
el.flipCard.addEventListener("keydown", flashcardFlipKeydown);

let resizeDragStartY = 0;
let resizeDragStartHeightPx = 0;

function endFlashcardResizePointer(event: PointerEvent): void {
  if (el.flashcardResizeHandle.hasPointerCapture(event.pointerId)) {
    el.flashcardResizeHandle.releasePointerCapture(event.pointerId);
  }
  if (getFlashcardViewportHeightPx() !== null) {
    setFlashcardViewportHeightPx(
      clampFlashcardViewportHeightForWindow(getFlashcardViewportHeightPx()!),
    );
    applyFlashcardViewportHeightFromSession();
  }
}

el.flashcardResizeHandle.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const rect = el.flashcardViewport.getBoundingClientRect();
  resizeDragStartY = event.clientY;
  resizeDragStartHeightPx = getFlashcardViewportHeightPx() ?? rect.height;
  el.flashcardResizeHandle.setPointerCapture(event.pointerId);
});

el.flashcardResizeHandle.addEventListener("pointermove", (event) => {
  if (!el.flashcardResizeHandle.hasPointerCapture(event.pointerId)) return;
  const deltaY = event.clientY - resizeDragStartY;
  setFlashcardViewportHeightPx(
    clampFlashcardViewportHeightForWindow(resizeDragStartHeightPx + deltaY),
  );
  applyFlashcardViewportHeightFromSession();
});

el.flashcardResizeHandle.addEventListener("pointerup", endFlashcardResizePointer);
el.flashcardResizeHandle.addEventListener("pointercancel", endFlashcardResizePointer);

window.addEventListener("resize", () => {
  if (getFlashcardViewportHeightPx() === null) return;
  setFlashcardViewportHeightPx(
    clampFlashcardViewportHeightForWindow(getFlashcardViewportHeightPx()!),
  );
  applyFlashcardViewportHeightFromSession();
});

el.flipCard.addEventListener("contextmenu", (event) => {
  const target = event.target as Element;
  if (target.closest(".flashcard-resize-handle") || target.closest("a") || target.closest("button")) return;
  if (state.cards.length === 0) return;
  event.preventDefault();
  openEditCardDialog();
});

// --- Deck persistence (FS Access, serialization) ---------------------------------

function deckDownloadFilename(): string {
  const label = state.fileLabel;
  if (label && /\.(md|markdown)$/i.test(label)) return label;
  return "edited-deck.md";
}

/**
 * Writes the in-memory deck to the linked handle when possible; otherwise opens a save picker.
 * AbortError: user canceled picker — surface in `fileMeta` instead of throwing so the session stays usable.
 */
async function syncDeckToDisk(): Promise<void> {
  const win = window as WindowWithFileSystemAccess;
  const markdown = serializeDeck(state.deckPreamble, state.cards);

  async function pickSaveAndWrite(): Promise<void> {
    if (!win.showSaveFilePicker) {
      const cardCount = state.cards.length;
      const label = state.fileLabel;
      if (label) {
        el.fileMeta.textContent = `${label} · ${cardCount} card${cardCount === 1 ? "" : "s"} — this browser cannot write the file; changes stay in this tab only.`;
      }
      return;
    }
    const startIn = state.deckFolderHint ?? state.deckFileHandle ?? undefined;
    let fileHandle: FileSystemFileHandle;
    try {
      fileHandle = await win.showSaveFilePicker({
        suggestedName: deckDownloadFilename(),
        types: MARKDOWN_PICKER_TYPES,
        ...(startIn ? { startIn } : {}),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        const cardCount = state.cards.length;
        const label = state.fileLabel;
        el.fileMeta.textContent = label
          ? `${label} · ${cardCount} card${cardCount === 1 ? "" : "s"} — save to file was canceled; changes are only in this tab.`
          : "";
        return;
      }
      throw error;
    }
    state.deckFileHandle = fileHandle;
    state.deckFolderHint = fileHandle;
    state.fileLabel = fileHandle.name;
    await writeTextToFileHandle(fileHandle, markdown);
  }

  if (state.deckFileHandle) {
    try {
      await writeTextToFileHandle(state.deckFileHandle, markdown);
      return;
    } catch {
      await pickSaveAndWrite();
      return;
    }
  }

  await pickSaveAndWrite();
}

/**
 * Save-picker-first empty deck: do not mutate `state` until the initial write succeeds so we never
 * show a linked filename without a real file on disk.
 */
async function createNewDeck(): Promise<void> {
  const win = window as WindowWithFileSystemAccess;
  if (!win.showSaveFilePicker) {
    el.fileMeta.textContent =
      "This browser cannot save a new deck file here. Use HTTPS or localhost with a supported browser, or Open an existing file.";
    return;
  }
  const startIn = state.deckFolderHint ?? state.deckFileHandle ?? undefined;
  let fileHandle: FileSystemFileHandle;
  try {
    fileHandle = await win.showSaveFilePicker({
      suggestedName: "new-deck.md",
      types: MARKDOWN_PICKER_TYPES,
      ...(startIn ? { startIn } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    el.fileMeta.textContent = "Could not create new deck.";
    return;
  }
  const markdown = serializeDeck(null, []);
  try {
    await writeTextToFileHandle(fileHandle, markdown);
  } catch {
    el.fileMeta.textContent = "Could not write new deck file.";
    return;
  }
  state.cards = [];
  state.deckPreamble = null;
  state.deckFileHandle = fileHandle;
  state.deckFolderHint = fileHandle;
  state.fileLabel = fileHandle.name;
  state.index = 0;
  state.got = 0;
  state.missed = 0;
  state.outcomes = new Map();
  state.sessionComplete = false;
  state.isFlipped = false;
  state.missedPanelCollapsed = false;
  render();
}

async function openMarkdownDeck(): Promise<void> {
  const win = window as WindowWithFileSystemAccess;
  if (win.showOpenFilePicker) {
    try {
      const startIn = state.deckFolderHint ?? state.deckFileHandle ?? undefined;
      const [fileHandle] = await win.showOpenFilePicker({
        types: MARKDOWN_PICKER_TYPES,
        multiple: false,
        ...(startIn ? { startIn } : {}),
      });
      const file = await fileHandle.getFile();
      const text = await file.text();
      loadDeck(text, file.name, fileHandle);
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  el.fileInput.click();
}

/** Strip accidental heading markers so authors can paste `## Title` into the dialog safely. */
function normalizeEditTitle(raw: string): string {
  let normalized = raw.replace(/\s+/g, " ").trim();
  normalized = normalized.replace(/^#{1,6}\s*/, "");
  return normalized;
}

/**
 * True when a linked deck has no cards but we still want Add enabled (preamble-only or new-deck flow).
 */
function canAddCard(): boolean {
  return state.fileLabel !== null || state.cards.length > 0;
}

function openEditCardDialog(): void {
  if (state.cards.length === 0) return;
  editCardDialog.mode = "edit";
  el.editDialogTitle.textContent = "Edit card";
  el.btnEditSave.textContent = "Save";
  const card = state.cards[state.index]!;
  el.editTitle.value = card.title;
  el.editBody.value = card.bodyMd;
  el.editDialog.showModal();
  queueMicrotask(() => {
    el.editTitle.focus();
    el.editTitle.select();
  });
}

function openAddCardDialog(): void {
  if (!canAddCard()) return;
  editCardDialog.mode = "create";
  el.editDialogTitle.textContent = "Add card";
  el.btnEditSave.textContent = "Add card";
  el.editTitle.value = "";
  el.editBody.value = "";
  el.editDialog.showModal();
  queueMicrotask(() => {
    el.editTitle.focus();
  });
}

function closeEditCardDialog(): void {
  if (el.editDialog.open) el.editDialog.close();
}

/**
 * Removes the current card and rebuilds `outcomes` so list indices stay aligned with `state.cards`
 * (keys above the deleted index shift down by one).
 */
function deleteCurrentCard(): void {
  const cardCount = state.cards.length;
  if (cardCount === 0) return;
  if (!window.confirm("Delete this flashcard? This cannot be undone.")) return;

  const deletedIndex = state.index;
  state.cards.splice(deletedIndex, 1);

  const nextOutcomes = new Map<number, Outcome>();
  for (const [index, outcome] of state.outcomes) {
    if (index < deletedIndex) nextOutcomes.set(index, outcome);
    else if (index > deletedIndex) nextOutcomes.set(index - 1, outcome);
  }
  state.outcomes = nextOutcomes;

  let got = 0;
  let missed = 0;
  for (const outcome of nextOutcomes.values()) {
    if (outcome === "got") got += 1;
    else missed += 1;
  }
  state.got = got;
  state.missed = missed;

  if (state.cards.length === 0) {
    state.index = 0;
  } else if (deletedIndex >= state.cards.length) {
    state.index = state.cards.length - 1;
  } else {
    state.index = deletedIndex;
  }
  state.isFlipped = false;
  syncSessionComplete();
  render();
  void (async () => {
    try {
      await syncDeckToDisk();
      render();
    } catch {
      const remaining = state.cards.length;
      const label = state.fileLabel;
      el.fileMeta.textContent = label
        ? `${label} · ${remaining} card${remaining === 1 ? "" : "s"} — could not write file.`
        : "Could not write file.";
    }
  })();
}

el.btnEditCard.addEventListener("click", () => openEditCardDialog());
el.btnAddCard.addEventListener("click", () => openAddCardDialog());
el.btnDeleteCard.addEventListener("click", () => deleteCurrentCard());

el.editForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = normalizeEditTitle(el.editTitle.value);
  if (!title) {
    el.editTitle.focus();
    return;
  }
  const bodyMd = el.editBody.value;
  if (editCardDialog.mode === "create") {
    state.cards.push({ title, bodyMd });
    state.index = state.cards.length - 1;
    state.isFlipped = false;
  } else {
    const card = state.cards[state.index];
    if (!card) return;
    card.title = title;
    card.bodyMd = bodyMd;
  }
  closeEditCardDialog();
  render();
  void (async () => {
    try {
      await syncDeckToDisk();
      render();
    } catch {
      const cardCount = state.cards.length;
      const label = state.fileLabel;
      el.fileMeta.textContent = label
        ? `${label} · ${cardCount} card${cardCount === 1 ? "" : "s"} — could not write file.`
        : "Could not write file.";
    }
  })();
});

el.btnEditCancel.addEventListener("click", () => closeEditCardDialog());

function loadDeck(text: string, label: string, fileHandle: FileSystemFileHandle | null = null): void {
  const { cards, deckPreamble } = parseFlashcards(text);
  state.cards = cards;
  state.deckPreamble = deckPreamble;
  state.deckFileHandle = fileHandle;
  state.deckFolderHint = fileHandle;
  state.index = 0;
  state.got = 0;
  state.missed = 0;
  state.fileLabel = label;
  state.isFlipped = false;
  state.outcomes = new Map();
  state.sessionComplete = false;
  state.missedPanelCollapsed = false;
  render();
}

async function loadTutorialDeck(): Promise<void> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}tutorial-deck.md`,
  );
  if (!response.ok) throw new Error("Could not load tutorial deck");
  const text = await response.text();
  loadDeck(text, "tutorial-deck.md", null);
}

// --- Navigation, outcomes, session reset ------------------------------------------

function go(delta: number): void {
  const cardCount = state.cards.length;
  if (cardCount === 0) return;
  const nextIndex = state.index + delta;
  if (nextIndex < 0 || nextIndex >= cardCount) return;
  state.index = nextIndex;
  state.isFlipped = false;
  render();
}

function syncSessionComplete(): void {
  const cardCount = state.cards.length;
  state.sessionComplete = cardCount > 0 && state.outcomes.size === cardCount;
}

/**
 * GOT/MISSED: first mark on a card usually advances; clicking the same control again clears the mark.
 * Tally counts stay consistent when switching between got and missed on the same card.
 */
function markOutcome(kind: Outcome): void {
  const cardCount = state.cards.length;
  if (cardCount === 0) return;
  const currentCardIndex = state.index;
  const previousOutcome = state.outcomes.get(currentCardIndex);

  if (previousOutcome === kind) {
    state.outcomes.delete(currentCardIndex);
    if (kind === "got") state.got -= 1;
    else state.missed -= 1;
    state.isFlipped = false;
    syncSessionComplete();
    render();
    return;
  }

  if (previousOutcome !== undefined) {
    if (previousOutcome === "got") state.got -= 1;
    else state.missed -= 1;
    if (kind === "got") state.got += 1;
    else state.missed += 1;
    state.outcomes.set(currentCardIndex, kind);
    state.isFlipped = false;
    syncSessionComplete();
    render();
    return;
  }

  state.outcomes.set(currentCardIndex, kind);
  if (kind === "got") state.got += 1;
  else state.missed += 1;
  if (currentCardIndex < cardCount - 1) {
    state.index = currentCardIndex + 1;
  }
  state.isFlipped = false;
  syncSessionComplete();
  render();
}

function restartSession(): void {
  state.got = 0;
  state.missed = 0;
  state.outcomes = new Map();
  state.index = 0;
  state.isFlipped = false;
  state.sessionComplete = false;
  state.missedPanelCollapsed = false;
  render();
}

// --- Sidebar list wiring ----------------------------------------------------------

el.missedList.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest("button[data-index]");
  if (!target || !(target instanceof HTMLButtonElement)) return;
  const listIndex = parseInt(target.dataset.index ?? "", 10);
  if (Number.isNaN(listIndex) || listIndex < 0 || listIndex >= state.cards.length) return;
  state.index = listIndex;
  state.isFlipped = false;
  render();
});

el.btnMissedPanelToggle.addEventListener("click", () => {
  state.missedPanelCollapsed = !state.missedPanelCollapsed;
  render();
});

// --- Header & file input ----------------------------------------------------------

el.btnRestart.addEventListener("click", restartSession);

el.btnOpen.addEventListener("click", () => {
  void openMarkdownDeck();
});

el.btnNew.addEventListener("click", () => {
  void createNewDeck();
});

el.fileInput.addEventListener("change", () => {
  const file = el.fileInput.files?.[0];
  el.fileInput.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === "string" ? reader.result : "";
    loadDeck(text, file.name, null);
  };
  reader.readAsText(file);
});

el.btnTutorial.addEventListener("click", () => {
  void loadTutorialDeck().catch(() => {
    el.fileMeta.textContent = "Could not load tutorial deck.";
  });
});

// stopPropagation: nav chevrons sit inside the article; without it, click would bubble to the flip control.
el.btnPrev.addEventListener("click", (event) => {
  event.stopPropagation();
  go(-1);
});
el.btnNext.addEventListener("click", (event) => {
  event.stopPropagation();
  go(1);
});

el.btnGot.addEventListener("click", () => markOutcome("got"));
el.btnMissed.addEventListener("click", () => markOutcome("missed"));

// --- Global shortcuts -------------------------------------------------------------

function shouldIgnoreGotMissedShortcut(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  if (el.editDialog.open) return true;
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) {
    return true;
  }
  if (active instanceof HTMLElement && active.isContentEditable) return true;
  return false;
}

function canMarkOutcomeFromShortcut(): boolean {
  return (
    state.cards.length > 0 && !el.btnGot.disabled && !el.btnGot.hidden && !el.btnMissed.disabled && !el.btnMissed.hidden
  );
}

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    if (state.cards.length > 0 && state.index > 0) {
      event.preventDefault();
      go(-1);
    }
  } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    const cardCount = state.cards.length;
    if (cardCount > 0 && state.index < cardCount - 1) {
      event.preventDefault();
      go(1);
    }
  } else if ((event.key === "g" || event.key === "G") && !shouldIgnoreGotMissedShortcut(event)) {
    if (canMarkOutcomeFromShortcut()) {
      event.preventDefault();
      markOutcome("got");
    }
  } else if ((event.key === "m" || event.key === "M") && !shouldIgnoreGotMissedShortcut(event)) {
    if (canMarkOutcomeFromShortcut()) {
      event.preventDefault();
      markOutcome("missed");
    }
  } else if ((event.key === "r" || event.key === "R") && !shouldIgnoreGotMissedShortcut(event)) {
    if (state.sessionComplete && state.cards.length > 0) {
      event.preventDefault();
      restartSession();
    }
  }
});

// --- Drag and drop ----------------------------------------------------------------

/** Block default so the browser doesn’t navigate away or open the file in-tab. */
function preventDefaults(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

["dragenter", "dragover", "dragleave", "drop"].forEach((evt) => {
  el.dropZone.addEventListener(evt, preventDefaults, false);
});

el.dropZone.addEventListener("dragenter", () => {
  el.dropZone.classList.add("is-dragover");
});
el.dropZone.addEventListener("dragleave", (event) => {
  const related = event.relatedTarget as Node | null;
  if (!related || !el.dropZone.contains(related)) {
    el.dropZone.classList.remove("is-dragover");
  }
});
el.dropZone.addEventListener("drop", (event) => {
  el.dropZone.classList.remove("is-dragover");
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".md") && !lower.endsWith(".markdown") && file.type !== "text/markdown") {
    el.fileMeta.textContent = "Please drop a Markdown (.md) file.";
    return;
  }
  void loadDeckFromDroppedFile(event.dataTransfer!, file);
});

/**
 * Chromium can attach a real `FileSystemFileHandle` on drop for save-in-place; other sources throw
 * and we fall back to in-memory-only `loadDeck`.
 */
async function loadDeckFromDroppedFile(dataTransfer: DataTransfer, file: File): Promise<void> {
  let handle: FileSystemFileHandle | null = null;
  const item = dataTransfer.items[0];
  if (item?.kind === "file") {
    const withFs = item as DataTransferItem & {
      getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
    };
    if (typeof withFs.getAsFileSystemHandle === "function") {
      try {
        const maybeHandle = await withFs.getAsFileSystemHandle();
        if (maybeHandle !== null && maybeHandle.kind === "file") handle = maybeHandle as FileSystemFileHandle;
      } catch {
        /* e.g. drag from browser UI — no host path / handle */
      }
    }
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    el.fileMeta.textContent = "Could not read file.";
    return;
  }
  loadDeck(text, file.name, handle);
}

syncThemeButton();
render();
