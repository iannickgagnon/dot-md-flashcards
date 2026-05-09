import "@fontsource/geist/latin-300.css";
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist-mono/latin-400.css";
import "./styles.css";
import { parseFlashcards, type Flashcard } from "./parseFlashcards";
import { renderAnswerHtml, renderTitleHtml } from "./renderMarkdown";

const THEME_KEY = "markdown-flashcards-theme";

function getTheme(): "light" | "dark" {
  const t = document.documentElement.dataset.theme;
  return t === "light" ? "light" : "dark";
}

type Outcome = "got" | "missed";

type AppState = {
  cards: Flashcard[];
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
    <h1 class="app-title">Markdown flashcards</h1>
    <div class="header-tools">
      <button type="button" class="btn-theme" id="btn-theme">Light</button>
      <button type="button" class="btn-secondary" id="btn-open" aria-controls="file-input">
        Open markdown file
      </button>
      <input class="hidden-input" id="file-input" type="file" accept=".md,.markdown,text/markdown,text/x-markdown" />
      <button type="button" class="btn-secondary" id="btn-sample">Load sample deck</button>
      <span class="mono-label" id="session-readout" aria-live="polite">Card 0 / 0</span>
      <span class="tally" id="tally" aria-live="polite">
        <span class="tally__part">Got <strong id="tally-got">0</strong></span>
        <span class="tally__part">Missed <strong id="tally-missed">0</strong></span>
      </span>
    </div>
    <p class="file-meta" id="file-meta"></p>
  </header>
  <main class="app-layout">
    <div class="app-layout__main">
      <div class="drop-zone" id="drop-zone" tabindex="-1">
        <p class="empty-hint" id="empty-hint">Drop a .md file here, use Open markdown file, or load the sample deck.</p>
        <div class="flashcard-wrap" id="flashcard-wrap" hidden>
          <article class="flashcard" aria-label="Flashcard deck">
            <button type="button" class="nav-strip nav-strip--prev" id="btn-prev" aria-label="Previous flashcard">←</button>
            <div
              class="flashcard-flip"
              id="flashcard-flip"
              tabindex="0"
              role="button"
              aria-pressed="false"
              aria-label="Showing question. Click or press Enter to reveal the answer."
            >
              <div class="flashcard-flip__panel" id="flip-panel">
                <div class="flashcard-face flashcard-face--front">
                  <h2 id="question-title"></h2>
                  <p class="flashcard-hint">Click to reveal answer</p>
                </div>
                <div class="flashcard-face flashcard-face--back">
                  <div class="answer prose" id="answer"></div>
                </div>
              </div>
            </div>
            <button type="button" class="nav-strip nav-strip--next" id="btn-next" aria-label="Next flashcard">→</button>
          </article>
        </div>
        <div class="actions">
          <button type="button" class="btn-primary" id="btn-got" disabled>GOT IT</button>
          <button type="button" class="btn-outline" id="btn-missed" disabled>MISSED IT</button>
          <button type="button" class="btn-outline" id="btn-restart" hidden>RESTART</button>
        </div>
      </div>
    </div>
    <aside class="missed-panel" id="missed-panel" hidden>
      <div class="missed-panel__head">
        <span class="missed-panel__title" id="missed-panel-title">Missed</span>
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
`;

const el = {
  fileInput: app.querySelector<HTMLInputElement>("#file-input")!,
  btnOpen: app.querySelector<HTMLButtonElement>("#btn-open")!,
  btnSample: app.querySelector<HTMLButtonElement>("#btn-sample")!,
  btnTheme: app.querySelector<HTMLButtonElement>("#btn-theme")!,
  sessionReadout: app.querySelector<HTMLSpanElement>("#session-readout")!,
  tallyGot: app.querySelector<HTMLSpanElement>("#tally-got")!,
  tallyMissed: app.querySelector<HTMLSpanElement>("#tally-missed")!,
  fileMeta: app.querySelector<HTMLParagraphElement>("#file-meta")!,
  emptyHint: app.querySelector<HTMLParagraphElement>("#empty-hint")!,
  flashcardWrap: app.querySelector<HTMLDivElement>("#flashcard-wrap")!,
  flipCard: app.querySelector<HTMLDivElement>("#flashcard-flip")!,
  flipPanel: app.querySelector<HTMLDivElement>("#flip-panel")!,
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
  if (t.closest("a") || t.closest("button")) return;
  toggleFlip();
}

function flashcardFlipKeydown(e: KeyboardEvent): void {
  if (e.key !== "Enter" && e.key !== " ") return;
  const t = e.target as Element;
  if (t.closest("a")) return;
  e.preventDefault();
  toggleFlip();
}

el.flipCard.addEventListener("click", flashcardFlipClick);
el.flipCard.addEventListener("keydown", flashcardFlipKeydown);

function loadDeck(text: string, label: string): void {
  const { cards } = parseFlashcards(text);
  state.cards = cards;
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

async function loadSample(): Promise<void> {
  const res = await fetch("/sample-deck.md");
  if (!res.ok) throw new Error("Could not load sample deck");
  const text = await res.text();
  loadDeck(text, "sample-deck.md");
}

function renderMissedPanel(): void {
  const m = state.missed;
  el.missedPanel.hidden = m === 0;

  if (m === 0) {
    el.missedList.innerHTML = "";
    return;
  }

  el.missedPanelTitle.textContent = `Missed (${m})`;
  el.missedPanel.classList.toggle("missed-panel--collapsed", state.missedPanelCollapsed);
  el.btnMissedPanelToggle.textContent = state.missedPanelCollapsed ? "Show" : "Hide";
  el.btnMissedPanelToggle.setAttribute(
    "aria-expanded",
    state.missedPanelCollapsed ? "false" : "true",
  );

  el.missedList.innerHTML = "";
  const indices = [...state.outcomes.entries()]
    .filter(([, o]) => o === "missed")
    .map(([i]) => i)
    .sort((a, b) => a - b);

  for (const i of indices) {
    const card = state.cards[i];
    if (!card) continue;
    const li = document.createElement("li");
    li.className = "missed-panel__li";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "missed-panel__item";
    btn.dataset.index = String(i);
    btn.textContent = titlePlainForList(card.title);
    btn.setAttribute("aria-label", `Go to card ${i + 1}: ${titlePlainForList(card.title)}`);
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

  el.emptyHint.hidden = hasCards;
  el.flashcardWrap.hidden = !hasCards;

  el.fileMeta.textContent = state.fileLabel
    ? `${state.fileLabel} · ${n} card${n === 1 ? "" : "s"}`
    : "";

  el.sessionReadout.textContent = hasCards ? `Card ${state.index + 1} / ${n}` : "Card 0 / 0";
  el.tallyGot.textContent = String(state.got);
  el.tallyMissed.textContent = String(state.missed);

  el.btnRestart.hidden = !state.sessionComplete;

  renderMissedPanel();

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
    el.btnPrev.disabled = true;
    el.btnNext.disabled = true;
    return;
  }

  el.flipCard.setAttribute("tabindex", "0");

  el.btnGot.disabled = false;
  el.btnMissed.disabled = false;

  el.btnPrev.disabled = state.index <= 0;
  el.btnNext.disabled = state.index >= n - 1;

  const card = state.cards[state.index]!;
  el.questionTitle.innerHTML = renderTitleHtml(card.title);
  el.answer.innerHTML = renderAnswerHtml(card.bodyMd);

  el.flipPanel.classList.toggle("is-back", state.isFlipped);
  el.flipCard.setAttribute("aria-pressed", state.isFlipped ? "true" : "false");
  el.flipCard.setAttribute(
    "aria-label",
    state.isFlipped
      ? "Showing answer. Click or press Enter to show the question."
      : "Showing question. Click or press Enter to reveal the answer.",
  );
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

function markOutcome(kind: Outcome): void {
  const n = state.cards.length;
  if (n === 0) return;
  const i = state.index;
  const prev = state.outcomes.get(i);

  if (prev === kind) return;

  if (prev !== undefined) {
    if (prev === "got") state.got -= 1;
    else state.missed -= 1;
    if (kind === "got") state.got += 1;
    else state.missed += 1;
    state.outcomes.set(i, kind);
    state.isFlipped = false;
    render();
    return;
  }

  state.outcomes.set(i, kind);
  if (kind === "got") state.got += 1;
  else state.missed += 1;
  if (i < n - 1) {
    state.index = i + 1;
  } else {
    state.sessionComplete = true;
  }
  state.isFlipped = false;
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

el.btnOpen.addEventListener("click", () => el.fileInput.click());

el.fileInput.addEventListener("change", () => {
  const file = el.fileInput.files?.[0];
  el.fileInput.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === "string" ? reader.result : "";
    loadDeck(text, file.name);
  };
  reader.readAsText(file);
});

el.btnSample.addEventListener("click", () => {
  void loadSample().catch(() => {
    el.fileMeta.textContent = "Could not load sample deck.";
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

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") {
    if (state.cards.length > 0 && state.index > 0) {
      e.preventDefault();
      go(-1);
    }
  } else if (e.key === "ArrowRight") {
    const n = state.cards.length;
    if (n > 0 && state.index < n - 1) {
      e.preventDefault();
      go(1);
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
  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === "string" ? reader.result : "";
    loadDeck(text, file.name);
  };
  reader.readAsText(file);
});

syncThemeButton();
render();
