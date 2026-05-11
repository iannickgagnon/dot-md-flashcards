import "@fontsource/geist/latin-300.css";
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist-mono/latin-400.css";
import hljsGithubDarkUrl from "highlight.js/styles/github-dark.css?url";
import hljsGithubUrl from "highlight.js/styles/github.css?url";
import "./styles.css";
import { parseFlashcards, serializeDeck, type Flashcard } from "./parseFlashcards";
import { renderAnswerHtml, renderTitleHtml } from "./renderMarkdown";

const THEME_KEY = "markdown-flashcards-theme";

/** User-chosen flashcard area height for this tab session only (no localStorage). */
let flashcardViewportHeightPx: number | null = null;

const FLASHCARD_VIEWPORT_MIN_PX = 220;

function flashcardViewportMaxPx(): number {
  return Math.max(FLASHCARD_VIEWPORT_MIN_PX, Math.floor(window.innerHeight * 0.92));
}

function clampFlashcardViewportHeight(h: number): number {
  return Math.min(flashcardViewportMaxPx(), Math.max(FLASHCARD_VIEWPORT_MIN_PX, h));
}

const HLJS_THEME_LINK_ID = "hljs-syntax-theme";

function syncHljsThemeLink(): void {
  let link = document.getElementById(HLJS_THEME_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = HLJS_THEME_LINK_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  const t = document.documentElement.dataset.theme;
  link.href = t === "light" ? hljsGithubUrl : hljsGithubDarkUrl;
}

syncHljsThemeLink();

function getTheme(): "light" | "dark" {
  const t = document.documentElement.dataset.theme;
  return t === "light" ? "light" : "dark";
}

type Outcome = "got" | "missed";

let editDialogMode: "edit" | "create" = "edit";

type AppState = {
  cards: Flashcard[];
  deckPreamble: string | null;
  /** When set, Save writes here; from showOpenFilePicker, drop, or after showSaveFilePicker. */
  deckFileHandle: FileSystemFileHandle | null;
  /** Same directory as the linked deck for picker `startIn` (file or dir handle per FS Access). */
  deckFolderHint: FileSystemHandle | null;
  index: number;
  got: number;
  missed: number;
  fileLabel: string | null;
  isFlipped: boolean;
  outcomes: Map<number, Outcome>;
  sessionComplete: boolean;
  missedPanelCollapsed: boolean;
};

const state: AppState = {
  cards: [],
  deckPreamble: null,
  deckFileHandle: null,
  deckFolderHint: null,
  index: 0,
  got: 0,
  missed: 0,
  fileLabel: null,
  isFlipped: false,
  outcomes: new Map(),
  sessionComplete: false,
  missedPanelCollapsed: false,
};

function titlePlainForList(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim();
  return s.length > 100 ? `${s.slice(0, 97)}…` : s;
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app missing");

app.innerHTML = `
  <header class="app-header">
    <h1 class="app-title">.md flashcards</h1>
    <div class="header-tools">
      <button type="button" class="btn-theme" id="btn-theme">Light</button>
      <button type="button" class="btn-secondary" id="btn-open" aria-controls="file-input">
        Open markdown file
      </button>
      <input class="hidden-input" id="file-input" type="file" accept=".md,.markdown,text/markdown,text/x-markdown" />
      <button type="button" class="btn-secondary" id="btn-tutorial">Load tutorial deck</button>
      <button
        type="button"
        class="btn-secondary"
        id="btn-edit-card"
        disabled
        aria-controls="edit-card-dialog"
        aria-label="Edit current flashcard"
      >
        Edit card
      </button>
      <button
        type="button"
        class="btn-secondary"
        id="btn-add-card"
        disabled
        aria-controls="edit-card-dialog"
        aria-label="Add flashcard at end of deck"
      >
        Add card
      </button>
      <button
        type="button"
        class="btn-secondary"
        id="btn-delete-card"
        disabled
        aria-label="Delete current flashcard"
      >
        Delete card
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
        <p class="empty-hint" id="empty-hint">Drop a .md file here, use Open markdown file, or load the tutorial deck.</p>
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

const el = {
  fileInput: app.querySelector<HTMLInputElement>("#file-input")!,
  btnOpen: app.querySelector<HTMLButtonElement>("#btn-open")!,
  btnTutorial: app.querySelector<HTMLButtonElement>("#btn-tutorial")!,
  btnTheme: app.querySelector<HTMLButtonElement>("#btn-theme")!,
  sessionReadout: app.querySelector<HTMLSpanElement>("#session-readout")!,
  tallyGot: app.querySelector<HTMLSpanElement>("#tally-got")!,
  tallyMissed: app.querySelector<HTMLSpanElement>("#tally-missed")!,
  fileMeta: app.querySelector<HTMLParagraphElement>("#file-meta")!,
  emptyHint: app.querySelector<HTMLParagraphElement>("#empty-hint")!,
  flashcardWrap: app.querySelector<HTMLDivElement>("#flashcard-wrap")!,
  flipCard: app.querySelector<HTMLDivElement>("#flashcard-flip")!,
  flashcardViewport: app.querySelector<HTMLDivElement>("#flashcard-viewport")!,
  flipPanel: app.querySelector<HTMLDivElement>("#flip-panel")!,
  flashcardResizeHandle: app.querySelector<HTMLDivElement>(".flashcard-resize-handle")!,
  questionTitle: app.querySelector<HTMLHeadingElement>("#question-title")!,
  answer: app.querySelector<HTMLDivElement>("#answer")!,
  btnPrev: app.querySelector<HTMLButtonElement>("#btn-prev")!,
  btnNext: app.querySelector<HTMLButtonElement>("#btn-next")!,
  btnGot: app.querySelector<HTMLButtonElement>("#btn-got")!,
  btnMissed: app.querySelector<HTMLButtonElement>("#btn-missed")!,
  btnRestart: app.querySelector<HTMLButtonElement>("#btn-restart")!,
  dropZone: app.querySelector<HTMLDivElement>("#drop-zone")!,
  missedPanel: app.querySelector<HTMLElement>("#missed-panel")!,
  missedList: app.querySelector<HTMLUListElement>("#missed-list")!,
  btnMissedPanelToggle: app.querySelector<HTMLButtonElement>("#btn-missed-panel-toggle")!,
  missedPanelTitle: app.querySelector<HTMLSpanElement>("#missed-panel-title")!,
  editDialog: app.querySelector<HTMLDialogElement>("#edit-card-dialog")!,
  editForm: app.querySelector<HTMLFormElement>("#edit-card-form")!,
  editTitle: app.querySelector<HTMLInputElement>("#edit-card-title")!,
  editBody: app.querySelector<HTMLTextAreaElement>("#edit-card-body")!,
  btnEditCard: app.querySelector<HTMLButtonElement>("#btn-edit-card")!,
  btnAddCard: app.querySelector<HTMLButtonElement>("#btn-add-card")!,
  btnDeleteCard: app.querySelector<HTMLButtonElement>("#btn-delete-card")!,
  editDialogTitle: app.querySelector<HTMLHeadingElement>("#edit-card-dialog-title")!,
  btnEditSave: app.querySelector<HTMLButtonElement>("#edit-card-save")!,
  btnEditCancel: app.querySelector<HTMLButtonElement>("#edit-card-cancel")!,
};

function syncThemeButton(): void {
  const t = getTheme();
  el.btnTheme.textContent = t === "dark" ? "Light" : "Dark";
  el.btnTheme.setAttribute(
    "aria-label",
    t === "dark" ? "Switch to light theme" : "Switch to dark theme",
  );
}

function setTheme(theme: "light" | "dark"): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  syncHljsThemeLink();
  syncThemeButton();
}

el.btnTheme.addEventListener("click", () => {
  setTheme(getTheme() === "dark" ? "light" : "dark");
});

function toggleFlip(): void {
  const n = state.cards.length;
  if (n === 0) return;
  state.isFlipped = !state.isFlipped;
  render();
}

function flashcardFlipClick(e: MouseEvent): void {
  const t = e.target as Element;
  if (t.closest(".flashcard-resize-handle") || t.closest("a") || t.closest("button")) return;
  toggleFlip();
}

function flashcardFlipKeydown(e: KeyboardEvent): void {
  if ((e.key === "e" || e.key === "E") && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (state.cards.length === 0) return;
    e.preventDefault();
    openEditCardDialog();
    return;
  }
  if (e.key !== "Enter" && e.key !== " ") return;
  const t = e.target as Element;
  if (t.closest("a")) return;
  e.preventDefault();
  toggleFlip();
}

el.flipCard.addEventListener("click", flashcardFlipClick);
el.flipCard.addEventListener("keydown", flashcardFlipKeydown);

let resizeDragStartY = 0;
let resizeDragStartH = 0;

function syncFlashcardViewportHeight(): void {
  const vp = el.flashcardViewport;
  if (flashcardViewportHeightPx === null) {
    vp.style.removeProperty("height");
  } else {
    flashcardViewportHeightPx = clampFlashcardViewportHeight(flashcardViewportHeightPx);
    vp.style.height = `${flashcardViewportHeightPx}px`;
  }
}

function endFlashcardResizePointer(e: PointerEvent): void {
  if (el.flashcardResizeHandle.hasPointerCapture(e.pointerId)) {
    el.flashcardResizeHandle.releasePointerCapture(e.pointerId);
  }
  if (flashcardViewportHeightPx !== null) {
    flashcardViewportHeightPx = clampFlashcardViewportHeight(flashcardViewportHeightPx);
    syncFlashcardViewportHeight();
  }
}

el.flashcardResizeHandle.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const rect = el.flashcardViewport.getBoundingClientRect();
  resizeDragStartY = e.clientY;
  resizeDragStartH = flashcardViewportHeightPx ?? rect.height;
  el.flashcardResizeHandle.setPointerCapture(e.pointerId);
});

el.flashcardResizeHandle.addEventListener("pointermove", (e) => {
  if (!el.flashcardResizeHandle.hasPointerCapture(e.pointerId)) return;
  const dy = e.clientY - resizeDragStartY;
  flashcardViewportHeightPx = clampFlashcardViewportHeight(resizeDragStartH + dy);
  syncFlashcardViewportHeight();
});

el.flashcardResizeHandle.addEventListener("pointerup", endFlashcardResizePointer);
el.flashcardResizeHandle.addEventListener("pointercancel", endFlashcardResizePointer);

window.addEventListener("resize", () => {
  if (flashcardViewportHeightPx === null) return;
  flashcardViewportHeightPx = clampFlashcardViewportHeight(flashcardViewportHeightPx);
  syncFlashcardViewportHeight();
});

el.flipCard.addEventListener("contextmenu", (e) => {
  const t = e.target as Element;
  if (t.closest(".flashcard-resize-handle") || t.closest("a") || t.closest("button")) return;
  if (state.cards.length === 0) return;
  e.preventDefault();
  openEditCardDialog();
});

type MarkdownFileWritable = {
  write(chunk: Blob): Promise<void>;
  close(): Promise<void>;
};

/** Chromium file handle with write APIs (DOM `lib` typings are incomplete). */
type MarkdownFileHandle = FileSystemFileHandle & {
  queryPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  createWritable(): Promise<MarkdownFileWritable>;
};

type WindowWithFileSystemAccess = Window & {
  showOpenFilePicker?: (options: {
    types: Array<{ description: string; accept: Record<string, string[]> }>;
    multiple: boolean;
    startIn?: FileSystemHandle;
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
    startIn?: FileSystemHandle;
  }) => Promise<FileSystemFileHandle>;
};

async function writeTextToFileHandle(handle: FileSystemFileHandle, text: string): Promise<void> {
  const h = handle as MarkdownFileHandle;
  const perm = { mode: "readwrite" as const };
  if ((await h.queryPermission(perm)) !== "granted") {
    if ((await h.requestPermission(perm)) !== "granted") {
      throw new DOMException("Write permission denied", "NotAllowedError");
    }
  }
  const writable = await h.createWritable();
  try {
    await writable.write(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  } finally {
    await writable.close();
  }
}

/** Writes serialized deck to linked file, or prompts with save picker (`startIn` from `deckFolderHint` when known). */
async function syncDeckToDisk(): Promise<void> {
  const win = window as WindowWithFileSystemAccess;
  const md = serializeDeck(state.deckPreamble, state.cards);

  const markdownPickerTypes = [
    {
      description: "Markdown",
      accept: { "text/markdown": [".md", ".markdown"] },
    },
  ];

  async function pickSaveAndWrite(): Promise<void> {
    if (!win.showSaveFilePicker) {
      const n = state.cards.length;
      const label = state.fileLabel;
      if (label) {
        el.fileMeta.textContent = `${label} · ${n} card${n === 1 ? "" : "s"} — this browser cannot write the file; changes stay in this tab only.`;
      }
      return;
    }
    const startIn = state.deckFolderHint ?? state.deckFileHandle ?? undefined;
    let handle: FileSystemFileHandle;
    try {
      handle = await win.showSaveFilePicker({
        suggestedName: deckDownloadFilename(),
        types: markdownPickerTypes,
        ...(startIn ? { startIn } : {}),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        const n = state.cards.length;
        const label = state.fileLabel;
        el.fileMeta.textContent = label
          ? `${label} · ${n} card${n === 1 ? "" : "s"} — save to file was canceled; changes are only in this tab.`
          : "";
        return;
      }
      throw e;
    }
    state.deckFileHandle = handle;
    state.deckFolderHint = handle;
    state.fileLabel = handle.name;
    await writeTextToFileHandle(handle, md);
  }

  if (state.deckFileHandle) {
    try {
      await writeTextToFileHandle(state.deckFileHandle, md);
      return;
    } catch {
      await pickSaveAndWrite();
      return;
    }
  }

  await pickSaveAndWrite();
}

async function openMarkdownDeck(): Promise<void> {
  const win = window as WindowWithFileSystemAccess;
  if (win.showOpenFilePicker) {
    try {
      const startIn = state.deckFolderHint ?? state.deckFileHandle ?? undefined;
      const [handle] = await win.showOpenFilePicker({
        types: [
          {
            description: "Markdown",
            accept: { "text/markdown": [".md", ".markdown"] },
          },
        ],
        multiple: false,
        ...(startIn ? { startIn } : {}),
      });
      const file = await handle.getFile();
      const text = await file.text();
      loadDeck(text, file.name, handle);
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  el.fileInput.click();
}

function normalizeEditTitle(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/^#{1,6}\s*/, "");
  return s;
}

function canAddCard(): boolean {
  return state.fileLabel !== null || state.cards.length > 0;
}

function openEditCardDialog(): void {
  if (state.cards.length === 0) return;
  editDialogMode = "edit";
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
  editDialogMode = "create";
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

function deleteCurrentCard(): void {
  const n = state.cards.length;
  if (n === 0) return;
  if (!window.confirm("Delete this flashcard? This cannot be undone.")) return;

  const di = state.index;
  state.cards.splice(di, 1);

  const nextOutcomes = new Map<number, Outcome>();
  for (const [k, v] of state.outcomes) {
    if (k < di) nextOutcomes.set(k, v);
    else if (k > di) nextOutcomes.set(k - 1, v);
  }
  state.outcomes = nextOutcomes;

  let got = 0;
  let missed = 0;
  for (const v of nextOutcomes.values()) {
    if (v === "got") got += 1;
    else missed += 1;
  }
  state.got = got;
  state.missed = missed;

  if (state.cards.length === 0) {
    state.index = 0;
  } else if (di >= state.cards.length) {
    state.index = state.cards.length - 1;
  } else {
    state.index = di;
  }
  state.isFlipped = false;
  syncSessionComplete();
  render();
  void (async () => {
    try {
      await syncDeckToDisk();
      render();
    } catch {
      const nc = state.cards.length;
      const label = state.fileLabel;
      el.fileMeta.textContent = label
        ? `${label} · ${nc} card${nc === 1 ? "" : "s"} — could not write file.`
        : "Could not write file.";
    }
  })();
}

function deckDownloadFilename(): string {
  const label = state.fileLabel;
  if (label && /\.(md|markdown)$/i.test(label)) return label;
  return "edited-deck.md";
}

el.btnEditCard.addEventListener("click", () => openEditCardDialog());
el.btnAddCard.addEventListener("click", () => openAddCardDialog());
el.btnDeleteCard.addEventListener("click", () => deleteCurrentCard());

el.editForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = normalizeEditTitle(el.editTitle.value);
  if (!title) {
    el.editTitle.focus();
    return;
  }
  const bodyMd = el.editBody.value;
  if (editDialogMode === "create") {
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
      const n = state.cards.length;
      const label = state.fileLabel;
      el.fileMeta.textContent = label
        ? `${label} · ${n} card${n === 1 ? "" : "s"} — could not write file.`
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
  const res = await fetch("/tutorial-deck.md");
  if (!res.ok) throw new Error("Could not load tutorial deck");
  const text = await res.text();
  loadDeck(text, "tutorial-deck.md", null);
}

function renderDeckPanel(): void {
  const n = state.cards.length;
  el.missedPanel.hidden = n === 0;

  if (n === 0) {
    el.missedList.innerHTML = "";
    return;
  }

  el.missedPanelTitle.textContent = `Flashcards (${n})`;
  el.missedPanel.classList.toggle("missed-panel--collapsed", state.missedPanelCollapsed);
  el.btnMissedPanelToggle.textContent = state.missedPanelCollapsed ? "Show" : "Hide";
  el.btnMissedPanelToggle.setAttribute(
    "aria-expanded",
    state.missedPanelCollapsed ? "false" : "true",
  );

  el.missedList.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const card = state.cards[i]!;
    const li = document.createElement("li");
    li.className = "missed-panel__li";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "missed-panel__item";
    if (i === state.index) {
      btn.classList.add("missed-panel__item--active");
      btn.setAttribute("aria-current", "true");
    }
    btn.dataset.index = String(i);
    const plain = titlePlainForList(card.title);
    btn.setAttribute("aria-label", `Go to card ${i + 1}: ${plain}`);

    const status = document.createElement("span");
    status.className = "missed-panel__status";
    const outcome = state.outcomes.get(i);
    if (outcome === "got") {
      status.classList.add("missed-panel__status--got");
      const icon = document.createElement("span");
      icon.className = "missed-panel__status-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "✓";
      status.appendChild(icon);
    } else if (outcome === "missed") {
      status.classList.add("missed-panel__status--missed");
      const icon = document.createElement("span");
      icon.className = "missed-panel__status-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "✗";
      status.appendChild(icon);
    }

    const label = document.createElement("span");
    label.className = "missed-panel__label";
    label.textContent = plain;

    btn.appendChild(status);
    btn.appendChild(label);
    li.appendChild(btn);
    el.missedList.appendChild(li);
  }
}

el.missedList.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest("button[data-index]");
  if (!target || !(target instanceof HTMLButtonElement)) return;
  const i = parseInt(target.dataset.index ?? "", 10);
  if (Number.isNaN(i) || i < 0 || i >= state.cards.length) return;
  state.index = i;
  state.isFlipped = false;
  render();
});

el.btnMissedPanelToggle.addEventListener("click", () => {
  state.missedPanelCollapsed = !state.missedPanelCollapsed;
  render();
});

function render(): void {
  const n = state.cards.length;
  const hasCards = n > 0;
  const canAdd = canAddCard();

  el.emptyHint.hidden = hasCards;
  el.flashcardWrap.hidden = !hasCards;

  el.fileMeta.textContent = state.fileLabel
    ? `${state.fileLabel} · ${n} card${n === 1 ? "" : "s"}`
    : "";

  el.sessionReadout.textContent = hasCards ? `Card ${state.index + 1} / ${n}` : "Card 0 / 0";
  el.tallyGot.textContent = String(state.got);
  el.tallyMissed.textContent = String(state.missed);

  el.btnRestart.hidden = !state.sessionComplete;

  renderDeckPanel();

  if (!hasCards) {
    el.questionTitle.innerHTML = "";
    el.answer.innerHTML = "";
    el.flipPanel.classList.remove("is-back");
    el.flipCard.setAttribute("aria-pressed", "false");
    el.flipCard.setAttribute(
      "aria-label",
      "No cards loaded. Open a markdown deck to study.",
    );
    el.flipCard.setAttribute("tabindex", "-1");
    el.btnGot.disabled = true;
    el.btnMissed.disabled = true;
    el.btnGot.hidden = true;
    el.btnMissed.hidden = true;
    el.btnGot.classList.remove("btn-primary");
    el.btnGot.classList.add("btn-outline");
    el.btnMissed.classList.remove("btn-primary");
    el.btnMissed.classList.add("btn-outline");
    el.btnPrev.disabled = true;
    el.btnNext.disabled = true;
    el.btnEditCard.disabled = true;
    el.btnAddCard.disabled = !canAdd;
    el.btnDeleteCard.disabled = true;
    syncFlashcardViewportHeight();
    return;
  }

  el.flipCard.setAttribute("tabindex", "0");

  el.btnGot.disabled = false;
  el.btnMissed.disabled = false;
  el.btnGot.hidden = false;
  el.btnMissed.hidden = false;

  el.btnEditCard.disabled = false;
  el.btnAddCard.disabled = !canAdd;
  el.btnDeleteCard.disabled = false;

  el.btnPrev.disabled = state.index <= 0;
  el.btnNext.disabled = state.index >= n - 1;

  const outcomeForCard = state.outcomes.get(state.index);
  el.btnGot.classList.toggle("btn-primary", outcomeForCard === "got");
  el.btnGot.classList.toggle("btn-outline", outcomeForCard !== "got");
  el.btnMissed.classList.toggle("btn-primary", outcomeForCard === "missed");
  el.btnMissed.classList.toggle("btn-outline", outcomeForCard !== "missed");

  const card = state.cards[state.index]!;
  el.questionTitle.innerHTML = renderTitleHtml(card.title);
  el.answer.innerHTML = renderAnswerHtml(card.bodyMd);

  el.flipPanel.classList.toggle("is-back", state.isFlipped);
  el.flipCard.setAttribute("aria-pressed", state.isFlipped ? "true" : "false");
  el.flipCard.setAttribute(
    "aria-label",
    state.isFlipped
      ? "Showing answer. Click or press Enter to show the question. Press E to edit this card."
      : "Showing question. Click or press Enter to reveal the answer. Press E to edit this card.",
  );

  syncFlashcardViewportHeight();
}

function go(delta: number): void {
  const n = state.cards.length;
  if (n === 0) return;
  const next = state.index + delta;
  if (next < 0 || next >= n) return;
  state.index = next;
  state.isFlipped = false;
  render();
}

function syncSessionComplete(): void {
  const n = state.cards.length;
  state.sessionComplete = n > 0 && state.outcomes.size === n;
}

function markOutcome(kind: Outcome): void {
  const n = state.cards.length;
  if (n === 0) return;
  const i = state.index;
  const prev = state.outcomes.get(i);

  if (prev === kind) {
    state.outcomes.delete(i);
    if (kind === "got") state.got -= 1;
    else state.missed -= 1;
    state.isFlipped = false;
    syncSessionComplete();
    render();
    return;
  }

  if (prev !== undefined) {
    if (prev === "got") state.got -= 1;
    else state.missed -= 1;
    if (kind === "got") state.got += 1;
    else state.missed += 1;
    state.outcomes.set(i, kind);
    state.isFlipped = false;
    syncSessionComplete();
    render();
    return;
  }

  state.outcomes.set(i, kind);
  if (kind === "got") state.got += 1;
  else state.missed += 1;
  if (i < n - 1) {
    state.index = i + 1;
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

el.btnRestart.addEventListener("click", restartSession);

el.btnOpen.addEventListener("click", () => {
  void openMarkdownDeck();
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

el.btnPrev.addEventListener("click", (e) => {
  e.stopPropagation();
  go(-1);
});
el.btnNext.addEventListener("click", (e) => {
  e.stopPropagation();
  go(1);
});

el.btnGot.addEventListener("click", () => markOutcome("got"));
el.btnMissed.addEventListener("click", () => markOutcome("missed"));

function shouldIgnoreGotMissedShortcut(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (el.editDialog.open) return true;
  const a = document.activeElement;
  if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement) {
    return true;
  }
  if (a instanceof HTMLElement && a.isContentEditable) return true;
  return false;
}

function canMarkOutcomeFromShortcut(): boolean {
  return (
    state.cards.length > 0 && !el.btnGot.disabled && !el.btnGot.hidden && !el.btnMissed.disabled && !el.btnMissed.hidden
  );
}

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    if (state.cards.length > 0 && state.index > 0) {
      e.preventDefault();
      go(-1);
    }
  } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    const n = state.cards.length;
    if (n > 0 && state.index < n - 1) {
      e.preventDefault();
      go(1);
    }
  } else if ((e.key === "g" || e.key === "G") && !shouldIgnoreGotMissedShortcut(e)) {
    if (canMarkOutcomeFromShortcut()) {
      e.preventDefault();
      markOutcome("got");
    }
  } else if ((e.key === "m" || e.key === "M") && !shouldIgnoreGotMissedShortcut(e)) {
    if (canMarkOutcomeFromShortcut()) {
      e.preventDefault();
      markOutcome("missed");
    }
  } else if ((e.key === "r" || e.key === "R") && !shouldIgnoreGotMissedShortcut(e)) {
    if (state.sessionComplete && state.cards.length > 0) {
      e.preventDefault();
      restartSession();
    }
  }
});

function preventDefaults(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
}

["dragenter", "dragover", "dragleave", "drop"].forEach((evt) => {
  el.dropZone.addEventListener(evt, preventDefaults, false);
});

el.dropZone.addEventListener("dragenter", () => {
  el.dropZone.classList.add("is-dragover");
});
el.dropZone.addEventListener("dragleave", (e) => {
  const related = e.relatedTarget as Node | null;
  if (!related || !el.dropZone.contains(related)) {
    el.dropZone.classList.remove("is-dragover");
  }
});
el.dropZone.addEventListener("drop", (e) => {
  el.dropZone.classList.remove("is-dragover");
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".md") && !lower.endsWith(".markdown") && file.type !== "text/markdown") {
    el.fileMeta.textContent = "Please drop a Markdown (.md) file.";
    return;
  }
  void loadDeckFromDroppedFile(e.dataTransfer!, file);
});

async function loadDeckFromDroppedFile(dt: DataTransfer, file: File): Promise<void> {
  let handle: FileSystemFileHandle | null = null;
  const item = dt.items[0];
  if (item?.kind === "file") {
    const withFs = item as DataTransferItem & {
      getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
    };
    if (typeof withFs.getAsFileSystemHandle === "function") {
      try {
        const h = await withFs.getAsFileSystemHandle();
        if (h !== null && h.kind === "file") handle = h as FileSystemFileHandle;
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
